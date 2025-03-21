import { getCurrentUser } from './firebase';
import { doc, getDoc, updateDoc, collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { Message } from '../types';

// Interface for lifecycle tag configuration
export interface LifecycleTagConfig {
  id?: string;
  name: string;          // Name of the lifecycle (e.g., "interested", "new_lead", "hot_lead")
  keywords: string[];    // Keywords/phrases that trigger this lifecycle tag
  active: boolean;       // Whether this tagging rule is active
}

/**
 * Get all lifecycle tag configurations for the current user
 */
export const getAllLifecycleTagConfigs = async (): Promise<LifecycleTagConfig[]> => {
  const userUID = getCurrentUser();
  if (!userUID) return [];

  const userDoc = await getDoc(doc(db, 'Users', userUID));
  if (!userDoc.exists()) return [];
  
  const userData = userDoc.data();
  // Get from workflows.whatsapp_agent.lifecycleTagConfigs
  return userData.workflows?.whatsapp_agent?.lifecycleTagConfigs || [];
};

/**
 * Save a lifecycle tag configuration
 */
export const saveLifecycleTagConfig = async (config: LifecycleTagConfig) => {
  const userUID = getCurrentUser();
  if (!userUID) throw new Error('No user logged in');

  const userDoc = await getDoc(doc(db, 'Users', userUID));
  if (!userDoc.exists()) throw new Error('User document not found');
  
  const userData = userDoc.data();
  
  // Get current workflows or initialize if it doesn't exist
  const workflows = userData.workflows || {};
  
  // Get current whatsapp_agent config or initialize if it doesn't exist
  const whatsappAgent = workflows.whatsapp_agent || {};
  
  // Get current lifecycleTagConfigs or initialize if it doesn't exist
  const lifecycleTagConfigs = whatsappAgent.lifecycleTagConfigs || [];
  
  // Update or add the config
  const existingIndex = lifecycleTagConfigs.findIndex((c: LifecycleTagConfig) => 
    c.id === config.id || c.name === config.name
  );
  
  if (existingIndex >= 0) {
    lifecycleTagConfigs[existingIndex] = {
      ...config,
      id: config.id || lifecycleTagConfigs[existingIndex].id
    };
  } else {
    // Generate a new ID if one isn't provided
    const newId = config.id || `lifecycle_${Date.now()}`;
    lifecycleTagConfigs.push({
      ...config,
      id: newId
    });
  }
  
  // Save back to Firebase - only update the specific nested field
  await updateDoc(doc(db, 'Users', userUID), {
    'workflows.whatsapp_agent.lifecycleTagConfigs': lifecycleTagConfigs
  });
  
  return config;
};

/**
 * Delete a lifecycle tag configuration
 */
export const deleteLifecycleTagConfig = async (configId: string) => {
  const userUID = getCurrentUser();
  if (!userUID) throw new Error('No user logged in');

  const userDoc = await getDoc(doc(db, 'Users', userUID));
  if (!userDoc.exists()) throw new Error('User document not found');
  
  const userData = userDoc.data();
  const lifecycleTagConfigs = userData.workflows?.whatsapp_agent?.lifecycleTagConfigs || [];
  
  // Filter out the config to delete
  const updatedConfigs = lifecycleTagConfigs.filter((config: LifecycleTagConfig) => config.id !== configId);
  
  // Save back to Firebase
  await updateDoc(doc(db, 'Users', userUID), {
    'workflows.whatsapp_agent.lifecycleTagConfigs': updatedConfigs
  });
  
  return true;
};

/**
 * Process a message and update the contact's lifecycle if keywords match
 * @param phoneNumber - The contact's phone number
 * @param message - The message content
 * @param sender - Who sent the message ("agent", "user", or "human")
 * @returns Promise<boolean> - Whether a lifecycle was updated
 */
export const processMessageForLifecycle = async (
  phoneNumber: string,
  message: string,
  sender: string
): Promise<boolean> => {
  try {
    const userUID = getCurrentUser();
    if (!userUID) return false;
    
    // Get all active lifecycle configurations
    const lifecycleConfigs = await getAllLifecycleTagConfigs();
    const activeConfigs = lifecycleConfigs.filter(config => config.active);
    
    if (activeConfigs.length === 0) {
      return false;
    }
    
    // Normalize the message text for easier matching
    const normalizedMessage = message.toLowerCase();
    
    // Check each config for keyword matches
    for (const config of activeConfigs) {
      const keywordMatch = config.keywords.some(keyword => 
        normalizedMessage.includes(keyword.toLowerCase())
      );
      
      if (keywordMatch) {
        // Update the contact's lifecycle
        await updateDoc(
          doc(db, `Whatsapp_Data/${userUID}/chats/${phoneNumber}`),
          { lifecycle: config.name }
        );
        
        console.log(`Updated lifecycle for ${phoneNumber} to "${config.name}" based on message content`);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error processing message for lifecycle tagging:', error);
    return false;
  }
};

/**
 * Start listening for new WhatsApp messages and update lifecycles based on active configurations
 * @returns A cleanup function to stop listening
 */
export const startLifecycleTaggingIntegration = async (): Promise<() => void> => {
  const userUID = getCurrentUser();
  if (!userUID) {
    console.error('No user logged in');
    return () => {};
  }
  
  // Get active lifecycle tag configurations
  const lifecycleConfigs = await getAllLifecycleTagConfigs();
  const activeConfigs = lifecycleConfigs.filter(config => config.active);
  
  if (activeConfigs.length === 0) {
    console.log('No active lifecycle tagging rules found');
    return () => {};
  }
  
  console.log(`Starting WhatsApp lifecycle tagging with ${activeConfigs.length} active configurations`);
  
  // Set up a listener for all chats
  const chatsRef = collection(db, `Whatsapp_Data/${userUID}/chats`);
  
  const unsubscribe = onSnapshot(chatsRef, async (snapshot) => {
    // For each chat that changes, check for new messages
    snapshot.docChanges().forEach(async (change) => {
      if (change.type === 'added' || change.type === 'modified') {
        const phoneNumber = change.doc.id;
        
        // Set up a listener for messages in this chat
        const messagesRef = collection(db, `Whatsapp_Data/${userUID}/chats/${phoneNumber}/messages`);
        
        // We don't need to store this unsubscribe since it will be cleaned up when the parent unsubscribes
        onSnapshot(messagesRef, async (messagesSnapshot) => {
          // Get the most recent message
          const messages = messagesSnapshot.docs
            .map(doc => ({ 
              id: doc.id, 
              ...doc.data() as Message 
            }))
            .sort((a, b) => b.timestamp - a.timestamp);
          
          if (messages.length > 0) {
            const latestMessage = messages[0];
            
            // Process the message for lifecycle tagging
            await processMessageForLifecycle(
              phoneNumber, 
              latestMessage.message, 
              latestMessage.sender
            );
          }
        });
      }
    });
  });
  
  return unsubscribe;
};

/**
 * Get the available lifecycle stages for the application
 * These are the predefined lifecycle stages that users can select from
 */
export const getAvailableLifecycleStages = (): string[] => {
  return [
    "new_lead",
    "interested",
    "hot_lead",
    "payment",
    "customer",
    "cold_lead",
    "vip_lead"
  ];
}; 