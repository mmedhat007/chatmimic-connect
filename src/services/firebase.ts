import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  query, 
  orderBy,
  CollectionReference,
  DocumentData,
  collectionGroup,
  where, 
  limit,
  startAfter,
  onSnapshot,
  updateDoc,
  setDoc,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { 
  getAuth, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  User
} from 'firebase/auth';
import { Contact, Message, AnalyticsData, AnalyticsOptions } from '../types';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Authentication functions
export const loginUser = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    localStorage.setItem('userUID', userCredential.user.uid);
    return userCredential.user;
  } catch (error) {
    console.error('Error logging in:', error);
    throw error;
  }
};

export const registerUser = async (email: string, password: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    localStorage.setItem('userUID', userCredential.user.uid);
    
    // Create user document in Users collection with correct structure
    const userRef = doc(db, 'Users', userCredential.user.uid);
    await setDoc(userRef, {
      email,
      created_at: new Date(),
      credentials: {
        googleAuthCredentials: {},
        whatsappCredentials: {}
      },
      workflows: {}
    });

    return userCredential.user;
  } catch (error) {
    console.error('Error registering:', error);
    throw error;
  }
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
    localStorage.removeItem('userUID');
  } catch (error) {
    console.error('Error logging out:', error);
    throw error;
  }
};

export const getCurrentUser = (): string | null => {
  return localStorage.getItem('userUID');
};

// Get all contacts (phone numbers) with their last messages
export const getContacts = (onUpdate: (contacts: Contact[]) => void): () => void => {
  const userUID = getCurrentUser();
  if (!userUID) {
    console.error('No user logged in');
    onUpdate([]);
    return () => {};
  }

  try {
    const chatsRef = collection(db, `Whatsapp_Data/${userUID}/chats`);
    
    // Set up real-time listener
    const unsubscribe = onSnapshot(chatsRef, (snapshot) => {
      const contacts: Contact[] = [];
      
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        let lastMessageTime = Date.now();
        
        // Handle Firestore timestamp
        if (data.lastMessageTime?.seconds) {
          lastMessageTime = data.lastMessageTime.seconds * 1000;
        } else if (data.lastMessageTime instanceof Date) {
          lastMessageTime = data.lastMessageTime.getTime();
        } else if (data.lastMessageTime) {
          lastMessageTime = new Date(data.lastMessageTime).getTime();
        }

        console.log(`Contact ${doc.id} - Raw lastMessageTime:`, data.lastMessageTime);
        console.log(`Contact ${doc.id} - Processed lastMessageTime:`, lastMessageTime, new Date(lastMessageTime).toISOString());
        console.log(`Contact ${doc.id} - Lifecycle:`, data.lifecycle || 'none');
        
        contacts.push({
          id: doc.id,
          phone: doc.id,
          phoneNumber: doc.id,
          name: data.contactName,
          contactName: data.contactName,
          lastMessage: data.lastMessage || '',
          lastMessageTime,
          tags: data.tags || [],
          agentStatus: data.agentStatus || 'on',
          humanAgent: data.humanAgent || false,
          status: data.status || 'open',
          lifecycle: data.lifecycle || undefined
        });
      });
      
      console.log('Before sorting - Contacts:', contacts.map(c => ({
        phoneNumber: c.phoneNumber,
        lastMessageTime: c.lastMessageTime,
        date: new Date(c.lastMessageTime).toISOString()
      })));

      // Sort contacts by lastMessageTime in descending order (newest first)
      contacts.sort((a, b) => {
        // Convert both times to numbers to ensure consistent comparison
        const timeA = typeof a.lastMessageTime === 'number' ? a.lastMessageTime : new Date(a.lastMessageTime).getTime();
        const timeB = typeof b.lastMessageTime === 'number' ? b.lastMessageTime : new Date(b.lastMessageTime).getTime();
        return timeB - timeA;
      });
      
      console.log('After sorting - Contacts:', contacts.map(c => ({
        phoneNumber: c.phoneNumber,
        lastMessageTime: c.lastMessageTime,
        date: new Date(c.lastMessageTime).toISOString()
      })));

      onUpdate(contacts);
    }, (error) => {
      console.error('Error in contacts listener:', error);
      onUpdate([]);
    });
    
    return unsubscribe;
  } catch (error) {
    console.error('Error setting up contacts listener:', error);
    onUpdate([]);
    return () => {};
  }
};

// Helper function to check if two timestamps are within 24 hours
const isWithin24Hours = (timestamp1: number, timestamp2: number): boolean => {
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  return Math.abs(timestamp1 - timestamp2) < TWENTY_FOUR_HOURS;
};

// Track WhatsApp executions
const trackWhatsAppExecution = async (userUID: string, phoneNumber: string, messages: Message[]): Promise<void> => {
  try {
    const userRef = doc(db, 'Users', userUID);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.error('User document not found');
      return;
    }

    const workflowData = userDoc.data()?.workflows?.whatsapp_agent || {};
    const now = Date.now();

    // Check if we need to reset executions
    if (workflowData.reset_date && now >= new Date(workflowData.reset_date).getTime()) {
      workflowData.executions_used = 0;
      workflowData.reset_date = new Date(now + 30 * 24 * 60 * 60 * 1000); // Next reset in 30 days
    }

    // Sort messages by timestamp
    const sortedMessages = [...messages].sort((a, b) => a.timestamp - b.timestamp);
    
    // Find message groups within 24-hour windows
    let lastMessageTime = 0;
    let newConversationStarted = false;

    for (const message of sortedMessages) {
      // If this message is more than 24 hours after the last message, it starts a new conversation
      if (!isWithin24Hours(message.timestamp, lastMessageTime)) {
        newConversationStarted = true;
      }

      if (newConversationStarted) {
        // Increment executions_used for each new 24-hour conversation window
        workflowData.executions_used = (workflowData.executions_used || 0) + 1;
        newConversationStarted = false;
      }

      lastMessageTime = message.timestamp;
    }

    // Update only specific fields instead of replacing the entire object
    // This preserves all other fields like 'paid' and 'setup_completed'
    await updateDoc(userRef, {
      'workflows.whatsapp_agent.executions_used': workflowData.executions_used || 0,
      'workflows.whatsapp_agent.limit': workflowData.limit || 1000,
      'workflows.whatsapp_agent.reset_date': workflowData.reset_date || new Date(now + 30 * 24 * 60 * 60 * 1000)
    });

  } catch (error) {
    console.error('Error tracking WhatsApp execution:', error);
  }
};

// Get messages for a specific contact (phone number)
export const getMessages = (phoneNumber: string, onUpdate: (messages: Message[]) => void): () => void => {
  const userUID = getCurrentUser();
  if (!userUID) {
    console.error('No user logged in');
    onUpdate([]);
    return () => {};
  }

  try {
    const messagesRef = collection(
      db,
      `Whatsapp_Data/${userUID}/chats/${phoneNumber}/messages`
    );
    const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'));
    
    // Set up real-time listener
    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const messages = snapshot.docs.map(doc => {
        const data = doc.data();
        let timestamp = Date.now();
        
        // Handle Firestore timestamp
        if (data.timestamp?.seconds) {
          timestamp = data.timestamp.seconds * 1000;
        }

        // Map old sender values to new ones if necessary
        let sender = data.sender;
        if (sender === 'customer') {
          sender = 'user';
        }

        return {
          id: doc.id,
          content: data.message || '',
          message: data.message || '',
          timestamp,
          sender: sender as 'agent' | 'human' | 'user',
          isFromCustomer: sender === 'user',
          date: data.date
        };
      });
      
      // Track executions whenever messages are updated
      if (userUID) {
        trackWhatsAppExecution(userUID, phoneNumber, messages);
      }
      
      onUpdate(messages);
    }, (error) => {
      console.error('Error in messages listener:', error);
      onUpdate([]);
    });

    return unsubscribe;
  } catch (error) {
    console.error('Error setting up messages listener:', error);
    onUpdate([]);
    return () => {};
  }
};

// Format timestamp for display
export const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  
  // If message is from today, show time only
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  // If message is from this week, show day name
  const daysAgo = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (daysAgo < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  
  // Otherwise show date
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

// Get a specific contact
export const getContact = async (phoneNumber: string): Promise<Contact | null> => {
  const userUID = getCurrentUser();
  if (!userUID) {
    console.error('No user logged in');
    return null;
  }

  try {
    const contactRef = doc(db, `Whatsapp_Data/${userUID}/chats`, phoneNumber);
    const contactSnap = await getDoc(contactRef);
    
    if (contactSnap.exists()) {
      const data = contactSnap.data();
      let lastMessageTime = Date.now();
      
      if (data.lastMessageTime?.seconds) {
        lastMessageTime = data.lastMessageTime.seconds * 1000;
      }

      return {
        id: contactSnap.id,
        phone: contactSnap.id,
        phoneNumber: contactSnap.id,
        name: data.contactName,
        contactName: data.contactName,
        lastMessage: data.lastMessage || '',
        lastMessageTime,
        tags: data.tags || [],
        agentStatus: data.agentStatus || 'on',
        humanAgent: data.humanAgent || false,
        status: data.status || 'open',
        lifecycle: data.lifecycle || undefined
      };
    } else {
      console.log("No such contact!");
      return null;
    }
  } catch (error) {
    console.error(`Error fetching contact ${phoneNumber}:`, error);
    return null;
  }
};

// Message document type
interface MessageDoc {
  message: string;
  timestamp: {
    seconds: number;
    nanoseconds: number;
  };
  sender: 'agent' | 'customer';
}

// Get analytics data
export const getAnalyticsData = async (options?: AnalyticsOptions): Promise<AnalyticsData> => {
  const userUID = getCurrentUser();
  if (!userUID) {
    console.error('No user logged in');
    return {
      totalMessages: 0,
      totalContacts: 0,
      messagesByHour: Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 })),
      messagesByDay: {
        'Sunday': 0, 'Monday': 0, 'Tuesday': 0, 'Wednesday': 0,
        'Thursday': 0, 'Friday': 0, 'Saturday': 0
      },
      messagesByTag: {},
      messagesByLifecycle: {},
      contactsByLifecycle: {}
    };
  }

  const dateRange = options?.dateRange;
  const selectedTags = options?.tags || [];
  const selectedLifecycles = options?.lifecycles || [];

  try {
    console.log('Analytics: Starting analytics data retrieval for user', userUID);
    if (selectedTags.length > 0) {
      console.log('Analytics: Filtering by tags:', selectedTags);
    }
    if (selectedLifecycles.length > 0) {
      console.log('Analytics: Filtering by lifecycles:', selectedLifecycles);
    }
    
    // Initialize analytics data
    const messagesByHour: { [hour: number]: number } = {};
    const messagesByDay: { [day: string]: number } = {
      'Sunday': 0, 'Monday': 0, 'Tuesday': 0, 'Wednesday': 0,
      'Thursday': 0, 'Friday': 0, 'Saturday': 0
    };
    const messagesByTag: { [tag: string]: number } = {};
    const messagesByLifecycle: { [lifecycle: string]: number } = {};
    const contactsByLifecycle: { [lifecycle: string]: number } = {};
    
    for (let i = 0; i < 24; i++) messagesByHour[i] = 0;

    let totalMessages = 0;
    const activeContacts = new Set<string>(); // Using a Set to avoid duplicates
    
    // First get all chats to count contacts
    console.log('Analytics: Fetching all contacts');
    const chatsRef = collection(db, 'Whatsapp_Data', userUID, 'chats');
    const chatsSnapshot = await getDocs(chatsRef);
    
    // Count chats and collect phone numbers
    const now = new Date();
    const phoneNumbers: string[] = [];
    
    chatsSnapshot.forEach(chatDoc => {
      const chatData = chatDoc.data();
      const phoneNumber = chatDoc.id;
      const lifecycle = chatData.lifecycle || 'none';
      
      // Filter by tags if any are selected
      if (selectedTags.length > 0) {
        const contactTags = chatData.tags || [];
        // Skip contacts that don't have any of the selected tags
        if (!selectedTags.some(tag => contactTags.includes(tag))) {
          return; // Skip this contact
        }
      }
      
      // Filter by lifecycle if any are selected
      if (selectedLifecycles.length > 0) {
        // Skip contacts that don't have the selected lifecycle
        if (!selectedLifecycles.includes(lifecycle)) {
          return; // Skip this contact
        }
      }
      
      // Apply date filter if needed
      if (dateRange && dateRange !== 'all') {
        const lastMessageTime = chatData.lastMessageTime?.toDate ? 
          chatData.lastMessageTime.toDate() : 
          chatData.lastMessageTime ? new Date(chatData.lastMessageTime) : null;
          
        if (lastMessageTime) {
          const daysDiff = Math.floor((now.getTime() - lastMessageTime.getTime()) / (1000 * 60 * 60 * 24));
          
          if ((dateRange === 'today' && lastMessageTime.toDateString() !== now.toDateString()) ||
              (dateRange === 'week' && daysDiff > 7) ||
              (dateRange === 'month' && daysDiff > 30)) {
            return; // Skip this contact
          }
        }
      }
      
      // Add to active contacts
      activeContacts.add(phoneNumber);
      phoneNumbers.push(phoneNumber);
      
      // Initialize tag counts
      const contactTags = chatData.tags || [];
      contactTags.forEach(tag => {
        if (!messagesByTag[tag]) {
          messagesByTag[tag] = 0;
        }
      });
      
      // Track contacts by lifecycle
      if (!contactsByLifecycle[lifecycle]) {
        contactsByLifecycle[lifecycle] = 0;
      }
      contactsByLifecycle[lifecycle]++;
      
      // Initialize lifecycle message counts
      if (!messagesByLifecycle[lifecycle]) {
        messagesByLifecycle[lifecycle] = 0;
      }
    });
    
    console.log(`Analytics: Found ${activeContacts.size} contacts after filtering`);
    
    // Process messages for each contact
    for (const phoneNumber of phoneNumbers) {
      console.log(`Analytics: Processing messages for contact ${phoneNumber}`);
      
      // Get all messages for this contact
      const messagesRef = collection(db, 'Whatsapp_Data', userUID, 'chats', phoneNumber, 'messages');
      const messagesSnapshot = await getDocs(messagesRef);
      
      console.log(`Analytics: Found ${messagesSnapshot.size} messages for contact ${phoneNumber}`);
      
      // Get contact tags and lifecycle for this phone number
      const contactRef = doc(db, 'Whatsapp_Data', userUID, 'chats', phoneNumber);
      const contactDoc = await getDoc(contactRef);
      const contactData = contactDoc.exists() ? contactDoc.data() : null;
      const contactTags = contactData?.tags || [];
      const contactLifecycle = contactData?.lifecycle || 'none';
      
      // Process each message
      messagesSnapshot.forEach(messageDoc => {
        const messageData = messageDoc.data();
        
        // Get timestamp - handle both Firestore Timestamp and JS Date
        let timestamp: Date | null = null;
        if (messageData.timestamp?.toDate) {
          // Firestore Timestamp
          timestamp = messageData.timestamp.toDate();
        } else if (messageData.timestamp?.seconds) {
          // Firestore Timestamp as object
          timestamp = new Date(messageData.timestamp.seconds * 1000);
        } else if (messageData.timestamp) {
          // JS timestamp or ISO string
          timestamp = new Date(messageData.timestamp);
        }
        
        if (!timestamp) {
          console.log('Analytics: Message has no valid timestamp, skipping');
          return; // Skip this message
        }
        
        // Apply date filter
        if (dateRange) {
          const daysDiff = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60 * 60 * 24));
          
          if (dateRange === 'today' && timestamp.toDateString() !== now.toDateString()) {
            return; // Skip messages from other days
          } else if (dateRange === 'week' && daysDiff > 7) {
            return; // Skip messages older than a week
          } else if (dateRange === 'month' && daysDiff > 30) {
            return; // Skip messages older than a month
          }
        }
        
        // Update statistics
        const hour = timestamp.getHours();
        const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][timestamp.getDay()];
        
        messagesByHour[hour]++;
        messagesByDay[dayOfWeek]++;
        totalMessages++;
        
        // Update tag message counts
        contactTags.forEach(tag => {
          if (messagesByTag[tag] !== undefined) {
            messagesByTag[tag]++;
          }
        });
        
        // Update lifecycle message counts
        if (messagesByLifecycle[contactLifecycle] !== undefined) {
          messagesByLifecycle[contactLifecycle]++;
        }
      });
    }
    
    console.log(`Analytics: Finished processing. Found ${totalMessages} messages across ${activeContacts.size} contacts`);
    if (selectedTags.length > 0) {
      console.log('Analytics: Message counts by tag:', messagesByTag);
    }
    if (selectedLifecycles.length > 0) {
      console.log('Analytics: Message counts by lifecycle:', messagesByLifecycle);
      console.log('Analytics: Contacts by lifecycle:', contactsByLifecycle);
    }
    
    return {
      totalMessages,
      totalContacts: activeContacts.size,
      messagesByHour: Object.entries(messagesByHour).map(([hour, count]) => ({
        hour: parseInt(hour),
        count
      })),
      messagesByDay,
      messagesByTag,
      messagesByLifecycle,
      contactsByLifecycle,
      selectedTags: selectedTags.length > 0 ? selectedTags : undefined,
      selectedLifecycles: selectedLifecycles.length > 0 ? selectedLifecycles : undefined
    };
  } catch (error) {
    console.error("Error fetching analytics data:", error);
    return {
      totalMessages: 0,
      totalContacts: 0,
      messagesByHour: Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 })),
      messagesByDay: {
        'Sunday': 0, 'Monday': 0, 'Tuesday': 0, 'Wednesday': 0,
        'Thursday': 0, 'Friday': 0, 'Saturday': 0
      },
      messagesByTag: {},
      messagesByLifecycle: {},
      contactsByLifecycle: {}
    };
  }
};

export const resetPassword = async (email: string) => {
  try {
    await firebaseSendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};

/**
 * Updates a specific field for a contact
 * @param phoneNumber The phone number of the contact to update
 * @param field The field to update
 * @param value The new value for the field
 * @returns Promise that resolves when the update is complete
 */
export const updateContactField = async (phoneNumber: string, field: string, value: any) => {
  try {
    const uid = getCurrentUser();
    if (!uid) {
      console.error('Error: User not authenticated');
      throw new Error('User not authenticated');
    }

    console.log(`FIREBASE SERVICE - Updating ${field} for contact ${phoneNumber} to "${value}"`);
    
    const contactRef = doc(db, 'Whatsapp_Data', uid, 'chats', phoneNumber);
    
    // First check if the contact exists
    const contactSnap = await getDoc(contactRef);
    if (!contactSnap.exists()) {
      console.error(`FIREBASE SERVICE - Error: Contact ${phoneNumber} does not exist`);
      throw new Error(`Contact ${phoneNumber} does not exist`);
    }
    
    // Compare with current value
    const currentData = contactSnap.data();
    console.log(`FIREBASE SERVICE - Current ${field} value: "${currentData[field]}", New value: "${value}"`);
    
    // Create an update object with just the field to update
    const updateData = {
      [field]: value
    };
    
    // Perform the update
    await updateDoc(contactRef, updateData);
    console.log(`FIREBASE SERVICE - ✅ Successfully updated ${field} for contact ${phoneNumber} to "${value}"`);
    return true;
  } catch (error) {
    console.error(`FIREBASE SERVICE - ❌ Error updating ${field} for contact ${phoneNumber}:`, error);
    throw error;
  }
};

/**
 * Get custom stage names from Firebase
 * @returns Promise that resolves with the stage names object or null if not found
 */
export const getStageNames = async () => {
  try {
    const uid = getCurrentUser();
    if (!uid) throw new Error('User not authenticated');

    const userRef = doc(db, 'Users', uid);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData.stageNames || null;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting stage names:', error);
    return null;
  }
};

/**
 * Update a custom stage name
 * @param stageId The ID of the stage to update
 * @param newName The new name for the stage
 * @returns Promise that resolves when the update is complete
 */
export const updateStageName = async (stageId: string, newName: string) => {
  try {
    const uid = getCurrentUser();
    if (!uid) throw new Error('User not authenticated');

    const userRef = doc(db, 'Users', uid);
    const userDoc = await getDoc(userRef);
    
    let stageNames = {};
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      stageNames = userData.stageNames || {};
    }
    
    // Update the stage name
    stageNames = {
      ...stageNames,
      [stageId]: newName
    };
    
    // Save back to Firebase
    await updateDoc(userRef, {
      stageNames
    });
    
    console.log(`Updated stage name for ${stageId} to ${newName}`);
    return true;
  } catch (error) {
    console.error('Error updating stage name:', error);
    throw error;
  }
};

/**
 * Reset a stage name to its default by removing it from the custom names
 * @param stageId The ID of the stage to reset
 * @returns Promise that resolves when the update is complete
 */
export const resetStageName = async (stageId: string) => {
  try {
    const uid = getCurrentUser();
    if (!uid) throw new Error('User not authenticated');

    const userRef = doc(db, 'Users', uid);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const stageNames = userData.stageNames || {};
      
      // Create a copy of the object without the stage to reset
      const updatedStageNames = { ...stageNames };
      delete updatedStageNames[stageId];
      
      // Save back to Firebase
      await updateDoc(userRef, {
        stageNames: updatedStageNames
      });
      
      console.log(`Reset stage name for ${stageId} to default`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error resetting stage name:', error);
    throw error;
  }
};

/**
 * Get a contact by phone number
 */
export const getContactByPhone = async (phone: string): Promise<Contact | null> => {
  const contactsRef = collection(db, 'Contacts');
  const q = query(contactsRef, where('phone', '==', phone));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) return null;
  
  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data()
  } as Contact;
};

/**
 * Update a contact's information
 */
export const updateContact = async (contactId: string, updates: Partial<Contact>): Promise<void> => {
  const contactRef = doc(db, 'Contacts', contactId);
  await updateDoc(contactRef, updates);
};

/**
 * Delete a contact and all their associated messages.
 * @param {string} phoneNumber The phone number of the contact to delete.
 */
export const deleteContact = async (phoneNumber: string): Promise<void> => {
  const userUID = getCurrentUser();
  if (!userUID) {
    console.error('No user logged in, cannot delete contact.');
    throw new Error('User not authenticated');
  }

  console.log(`Attempting to delete contact: ${phoneNumber} for user: ${userUID}`);
  const contactRef = doc(db, 'Whatsapp_Data', userUID, 'chats', phoneNumber);
  const messagesRef = collection(contactRef, 'messages');

  try {
    // 1. Delete all messages in the subcollection
    console.log(`Deleting messages for ${phoneNumber}...`);
    const messagesSnapshot = await getDocs(messagesRef);
    const batch = writeBatch(db);
    messagesSnapshot.docs.forEach((messageDoc) => {
      batch.delete(messageDoc.ref);
    });
    await batch.commit();
    console.log(`Successfully deleted ${messagesSnapshot.size} messages for ${phoneNumber}.`);

    // 2. Delete the contact document itself
    console.log(`Deleting contact document ${phoneNumber}...`);
    await deleteDoc(contactRef);
    console.log(`Successfully deleted contact document ${phoneNumber}.`);

  } catch (error) {
    console.error(`Error deleting contact ${phoneNumber}:`, error);
    throw new Error(`Failed to delete contact ${phoneNumber}.`);
  }
};
