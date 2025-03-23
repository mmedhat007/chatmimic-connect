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

  console.log('Saving lifecycle tag config:', { config });

  const userDoc = await getDoc(doc(db, 'Users', userUID));
  if (!userDoc.exists()) throw new Error('User document not found');
  
  const userData = userDoc.data();
  
  // Get current workflows or initialize if it doesn't exist
  const workflows = userData.workflows || {};
  
  // Get current whatsapp_agent config or initialize if it doesn't exist
  const whatsappAgent = workflows.whatsapp_agent || {};
  
  // Get current lifecycleTagConfigs or initialize if it doesn't exist
  const lifecycleTagConfigs = whatsappAgent.lifecycleTagConfigs || [];
  
  console.log('Current lifecycle configs:', lifecycleTagConfigs);
  
  // Update or add the config
  const existingIndex = lifecycleTagConfigs.findIndex((c: LifecycleTagConfig) => 
    c.id === config.id || c.name === config.name
  );
  
  let updatedConfig: LifecycleTagConfig;
  
  if (existingIndex >= 0) {
    updatedConfig = {
      ...config,
      id: config.id || lifecycleTagConfigs[existingIndex].id
    };
    lifecycleTagConfigs[existingIndex] = updatedConfig;
    console.log('Updated existing config at index', existingIndex, updatedConfig);
  } else {
    // Generate a new ID if one isn't provided
    const newId = config.id || `lifecycle_${Date.now()}`;
    updatedConfig = {
      ...config,
      id: newId
    };
    lifecycleTagConfigs.push(updatedConfig);
    console.log('Added new config with ID', newId, updatedConfig);
  }
  
  console.log('Final lifecycle configs to save:', lifecycleTagConfigs);
  
  // Save back to Firebase - only update the specific nested field
  await updateDoc(doc(db, 'Users', userUID), {
    'workflows.whatsapp_agent.lifecycleTagConfigs': lifecycleTagConfigs
  });
  
  return updatedConfig;
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
    
    if (activeConfigs.length === 0) return false;
    
    // FIRST CHECK: Is this contact manually overridden?
    // If the lifecycle has been manually set, we should not automatically change it
    const chatDocRef = doc(db, `Whatsapp_Data/${userUID}/chats/${phoneNumber}`);
    const chatDoc = await getDoc(chatDocRef);
    
    if (chatDoc.exists()) {
      const contactData = chatDoc.data();
      
      // If the contact has a manually_set_lifecycle flag, skip automatic tagging
      if (contactData.manually_set_lifecycle === true) {
        return false;
      }
    }
    
    // Normalize the message text for easier matching
    const normalizedMessage = message.toLowerCase();
    
    // Standard lifecycle names for reference only (no conversion)
    // Using these IDs directly in your tagging rules is recommended for consistency
    const standardStageReferences = [
      'new_lead',
      'vip_lead',
      'hot_lead',
      'payment',
      'customer',
      'cold_lead',
      'interested'
    ];
    
    // Check each config for keyword matches
    for (const config of activeConfigs) {
      const keywordMatch = config.keywords.some(keyword => {
        return normalizedMessage.includes(keyword.toLowerCase());
      });
      
      if (keywordMatch) {
        // Use the EXACT lifecycle value as defined in the config
        // Get the exact lifecycle value from the config
        const exactLifecycleValue = config.name;
        
        try {
          // First read the current value to avoid unnecessary updates
          if (!chatDoc.exists()) {
            return false;
          }
          
          const currentLifecycle = chatDoc.data().lifecycle;
          
          if (currentLifecycle === exactLifecycleValue) {
            return true;
          }
          
          // Update with the exact value
          await updateDoc(chatDocRef, { lifecycle: exactLifecycleValue });
          
          // Verify the update was successful
          const verifyDoc = await getDoc(chatDocRef);
          if (verifyDoc.exists()) {
            const verifiedValue = verifyDoc.data().lifecycle;
            
            if (verifiedValue !== exactLifecycleValue) {
              // Try again with stronger method
              await updateDoc(chatDocRef, { lifecycle: exactLifecycleValue });
            }
          }
          
          // IMPORTANT: Log the exact value for tracking
          // @ts-ignore
          window.lastAutomaticLifecycleUpdate = {
            phoneNumber,
            value: exactLifecycleValue,
            timestamp: new Date().toISOString()
          };
          
          return true;
        } catch (error) {
          console.error(`Error updating lifecycle to "${exactLifecycleValue}":`, error);
          return false;
        }
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
 * Get the suggested lifecycle stages for the application
 * These are suggested values but users can define their own custom lifecycle stages
 */
export const getAvailableLifecycleStages = (): string[] => {
  // These are just suggestions - users can create custom lifecycle names
  return [
    "new_lead",
    "vip_lead", 
    "hot_lead",
    "payment",
    "customer", 
    "cold_lead",
    "interested"
  ];
}; 