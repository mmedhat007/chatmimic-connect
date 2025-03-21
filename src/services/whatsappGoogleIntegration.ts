import { getCurrentUser } from './firebase';
import { doc, getDoc, collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { Message } from '../types';
import { extractDataFromMessage } from './ai';
import { getAllSheetConfigs, appendSheetRow, SheetConfig } from './googleSheets';

// Interface for processed messages to avoid duplicate processing
interface ProcessedMessage {
  id: string;
  timestamp: number;
}

// Keep track of processed messages to avoid duplicates
const processedMessages: Record<string, ProcessedMessage[]> = {};

/**
 * Start listening for new WhatsApp messages and update Google Sheets based on active configurations
 * @returns A cleanup function to stop listening
 */
export const startWhatsAppGoogleSheetsIntegration = async (): Promise<() => void> => {
  const userUID = getCurrentUser();
  if (!userUID) {
    console.error('No user logged in');
    return () => {};
  }

  // Get active sheet configurations
  const sheetConfigs = await getAllSheetConfigs();
  const activeConfigs = sheetConfigs.filter(config => config.active);
  
  if (activeConfigs.length === 0) {
    console.log('No active Google Sheets integrations found');
    return () => {};
  }

  console.log(`Starting WhatsApp to Google Sheets integration with ${activeConfigs.length} active configurations`);

  // Set up a listener for all chats
  const chatsRef = collection(db, `Whatsapp_Data/${userUID}/chats`);
  
  const unsubscribe = onSnapshot(chatsRef, async (snapshot) => {
    // For each chat that changes, check for new messages
    snapshot.docChanges().forEach(async (change) => {
      if (change.type === 'added' || change.type === 'modified') {
        const phoneNumber = change.doc.id;
        
        // Initialize processed messages array for this chat if it doesn't exist
        if (!processedMessages[phoneNumber]) {
          processedMessages[phoneNumber] = [];
        }
        
        // Set up a listener for messages in this chat
        const messagesRef = collection(db, `Whatsapp_Data/${userUID}/chats/${phoneNumber}/messages`);
        
        // We don't need to store this unsubscribe since it will be cleaned up when the parent unsubscribes
        onSnapshot(messagesRef, async (messagesSnapshot) => {
          // Process only user messages (from the customer, not our own replies)
          const userMessages = messagesSnapshot.docs
            .filter(doc => doc.data().sender === 'user')
            .map(doc => ({ 
              id: doc.id, 
              ...doc.data() as Message 
            }));
          
          // Process each new message
          for (const message of userMessages) {
            // Skip if we've already processed this message
            if (processedMessages[phoneNumber].some(pm => pm.id === message.id)) {
              continue;
            }
            
            console.log(`Processing new message from ${phoneNumber}: ${message.message.substring(0, 50)}...`);
            
            // Process each active sheet configuration
            for (const config of activeConfigs) {
              try {
                // Extract data using AI
                const extractedData = await extractDataFromMessage(message.message, config.columns);
                
                // Add the phone number as a reference
                extractedData['phone_number'] = phoneNumber;
                
                // Append the data to the Google Sheet
                await appendSheetRow(config.sheetId, extractedData);
                
                console.log(`Added data to sheet "${config.name}" for message ${message.id}`);
              } catch (error) {
                console.error(`Error processing message for sheet "${config.name}":`, error);
              }
            }
            
            // Mark message as processed
            processedMessages[phoneNumber].push({
              id: message.id,
              timestamp: message.timestamp
            });
            
            // Clean up old processed messages (older than 24 hours)
            const ONE_DAY = 24 * 60 * 60 * 1000;
            const now = Date.now();
            processedMessages[phoneNumber] = processedMessages[phoneNumber].filter(
              pm => now - pm.timestamp < ONE_DAY
            );
          }
        });
      }
    });
  });

  return unsubscribe;
};

/**
 * Process a specific WhatsApp message and update Google Sheets
 * @param phoneNumber The phone number the message is from
 * @param messageId The ID of the message to process
 * @returns True if processing was successful
 */
export const processWhatsAppMessage = async (
  phoneNumber: string, 
  messageId: string
): Promise<boolean> => {
  try {
    const userUID = getCurrentUser();
    if (!userUID) throw new Error('No user logged in');

    // Get the message
    const messageDoc = await getDoc(doc(db, `Whatsapp_Data/${userUID}/chats/${phoneNumber}/messages/${messageId}`));
    if (!messageDoc.exists()) throw new Error('Message not found');
    
    const message = messageDoc.data() as Message;
    
    // Get active sheet configurations
    const sheetConfigs = await getAllSheetConfigs();
    const activeConfigs = sheetConfigs.filter(config => config.active);
    
    if (activeConfigs.length === 0) {
      console.log('No active Google Sheets integrations found');
      return false;
    }
    
    // Process each active sheet configuration
    for (const config of activeConfigs) {
      // Extract data using AI
      const extractedData = await extractDataFromMessage(message.message, config.columns);
      
      // Add the phone number as a reference
      extractedData['phone_number'] = phoneNumber;
      
      // Append the data to the Google Sheet
      await appendSheetRow(config.sheetId, extractedData);
      
      console.log(`Added data to sheet "${config.name}" for message ${messageId}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error processing WhatsApp message:', error);
    return false;
  }
}; 