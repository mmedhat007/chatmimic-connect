import axios from 'axios';
import { db } from './firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { supabase } from './supabase';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});

interface WebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: {
            name: string;
          };
          wa_id: string;
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          text?: {
            body: string;
          };
          type: string;
        }>;
      };
      field: string;
    }>;
  }>;
}

interface ProcessedMessage {
  message_body: string;
  sender_id: string;
  sender_name: string;
  phone_number_id: string;
  timestamp: number;
}

/**
 * Process incoming webhook payload from WhatsApp
 */
export const processWebhookPayload = async (payload: WebhookPayload): Promise<{ success: boolean; error?: string; response?: string }> => {
  try {
    // Validate the payload structure
    if (!payload.object || payload.object !== 'whatsapp_business_account') {
      return { success: false, error: 'Invalid payload object' };
    }

    if (!payload.entry || !payload.entry.length) {
      return { success: false, error: 'No entries in payload' };
    }

    const entry = payload.entry[0];
    if (!entry.changes || !entry.changes.length) {
      return { success: false, error: 'No changes in entry' };
    }

    const change = entry.changes[0];
    if (change.field !== 'messages') {
      return { success: false, error: 'Change field is not messages' };
    }

    const value = change.value;
    if (!value.messages || !value.messages.length) {
      return { success: false, error: 'No messages in value' };
    }

    const message = value.messages[0];
    if (message.type !== 'text' || !message.text) {
      return { success: false, error: 'Message is not text type' };
    }

    // Extract the required data
    const processedMessage: ProcessedMessage = {
      message_body: message.text.body,
      sender_id: message.from,
      sender_name: value.contacts?.[0]?.profile?.name || 'Unknown',
      phone_number_id: value.metadata.phone_number_id,
      timestamp: parseInt(message.timestamp) * 1000, // Convert to milliseconds
    };

    // Fetch user data from Firebase
    const userData = await getUserData(processedMessage.phone_number_id);
    if (!userData) {
      return { success: false, error: 'User not found in Firebase' };
    }

    // Check execution limits
    if (await hasExceededLimit(userData.uid)) {
      return { success: false, error: 'Execution limit exceeded' };
    }

    // Process the message with AI
    const aiResponse = await processWithAI(processedMessage, userData.uid);

    // Save the conversation to Firebase
    await saveConversation(processedMessage, aiResponse, userData.uid);

    // Send the response back to WhatsApp
    await sendWhatsAppResponse(processedMessage.sender_id, aiResponse, processedMessage.phone_number_id, userData.whatsappCredentials.accessToken);

    return { success: true, response: aiResponse };
  } catch (error) {
    console.error('Error processing webhook payload:', error);
    return { success: false, error: 'Internal server error' };
  }
};

/**
 * Fetch user data from Firebase using phone_number_id
 */
const getUserData = async (phoneNumberId: string) => {
  try {
    // Query the Users collection to find the user with the matching phone_number_id
    const usersRef = collection(db, 'Users');
    const q = query(usersRef, where('credentials.whatsappCredentials.phoneNumberId', '==', phoneNumberId));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.error('No user found with phone_number_id:', phoneNumberId);
      return null;
    }

    // Get the first matching user
    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();

    return {
      uid: userDoc.id,
      whatsappCredentials: userData.credentials?.whatsappCredentials || {},
      workflows: userData.workflows || {},
    };
  } catch (error) {
    console.error('Error fetching user data:', error);
    return null;
  }
};

/**
 * Check if the user has exceeded their execution limit
 */
const hasExceededLimit = async (uid: string): Promise<boolean> => {
  try {
    const userRef = doc(db, 'Users', uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return true; // If user doesn't exist, consider limit exceeded
    }
    
    const userData = userDoc.data();
    const limit = userData.workflows?.whatsapp_agent?.limit || 0;
    const usage = userData.workflows?.whatsapp_agent?.usage || 0;
    
    return usage >= limit;
  } catch (error) {
    console.error('Error checking execution limit:', error);
    return true; // If there's an error, consider limit exceeded for safety
  }
};

/**
 * Process the message with OpenAI and retrieve relevant information from Supabase
 */
const processWithAI = async (message: ProcessedMessage, uid: string): Promise<string> => {
  try {
    // Retrieve relevant information from Supabase vector store
    const { data: relevantDocs, error } = await supabase.rpc('match_documents', {
      query_embedding: await getEmbedding(message.message_body),
      match_threshold: 0.5,
      match_count: 5,
      p_table_name: `${uid}_embeddings`
    });

    if (error) {
      console.error('Error retrieving relevant documents:', error);
    }

    // Prepare context from relevant documents
    const context = relevantDocs?.map((doc: any) => doc.content).join('\n\n') || '';

    // Generate response with OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a helpful WhatsApp AI assistant. Use the following information about the company and products to answer customer queries: ${context}`
        },
        {
          role: "user",
          content: message.message_body
        }
      ],
      max_tokens: 500
    });

    return completion.choices[0].message.content || "I'm sorry, I couldn't process your request.";
  } catch (error) {
    console.error('Error processing with AI:', error);
    return "I'm sorry, I encountered an error while processing your message.";
  }
};

/**
 * Get embedding for a text using OpenAI
 */
const getEmbedding = async (text: string): Promise<number[]> => {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error getting embedding:', error);
    throw error;
  }
};

/**
 * Save the conversation to Firebase
 */
const saveConversation = async (message: ProcessedMessage, aiResponse: string, uid: string): Promise<void> => {
  try {
    // Save customer message
    const customerMessageRef = collection(db, `Whatsapp_Data/${uid}/chats/${message.sender_id}/messages`);
    await addDoc(customerMessageRef, {
      message: message.message_body,
      timestamp: serverTimestamp(),
      sender: 'customer'
    });

    // Save AI response
    const aiMessageRef = collection(db, `Whatsapp_Data/${uid}/chats/${message.sender_id}/messages`);
    await addDoc(aiMessageRef, {
      message: aiResponse,
      timestamp: serverTimestamp(),
      sender: 'agent'
    });

    // Update usage count
    const userRef = doc(db, 'Users', uid);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const currentUsage = userData.workflows?.whatsapp_agent?.usage || 0;
      
      await updateDoc(userRef, {
        'workflows.whatsapp_agent.usage': currentUsage + 1
      });
    }
  } catch (error) {
    console.error('Error saving conversation:', error);
    throw error;
  }
};

/**
 * Send response back to WhatsApp
 */
const sendWhatsAppResponse = async (recipientId: string, message: string, phoneNumberId: string, accessToken: string): Promise<void> => {
  try {
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    
    const response = await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientId,
        type: 'text',
        text: {
          body: message
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.status !== 200) {
      console.error('Error sending WhatsApp response:', response.data);
      throw new Error('Failed to send WhatsApp response');
    }
  } catch (error) {
    console.error('Error sending WhatsApp response:', error);
    throw error;
  }
}; 