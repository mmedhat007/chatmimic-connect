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
  setDoc
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
import { Contact, Message, AnalyticsData } from '../types';

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
        
        contacts.push({
          phoneNumber: doc.id,
          contactName: data.contactName,
          lastMessage: data.lastMessage || '',
          lastMessageTime,
          tags: data.tags || [],
          agentStatus: data.agentStatus || 'off',
          humanAgent: data.humanAgent || false,
          status: data.status || 'open'
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

    // Update the workflow data in Firestore
    await updateDoc(userRef, {
      'workflows.whatsapp_agent': {
        executions_used: workflowData.executions_used || 0,
        limit: workflowData.limit || 1000,
        reset_date: workflowData.reset_date || new Date(now + 30 * 24 * 60 * 60 * 1000)
      }
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
          message: data.message || '',
          timestamp,
          sender: sender as 'agent' | 'human' | 'user',
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
        phoneNumber: contactSnap.id,
        contactName: data.contactName,
        lastMessage: data.lastMessage || '',
        lastMessageTime
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
export const getAnalyticsData = async (dateRange?: 'today' | 'week' | 'month' | 'all'): Promise<AnalyticsData> => {
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
      }
    };
  }

  try {
    // Initialize analytics data
    const messagesByHour: { [hour: number]: number } = {};
    const messagesByDay: { [day: string]: number } = {
      'Sunday': 0, 'Monday': 0, 'Tuesday': 0, 'Wednesday': 0,
      'Thursday': 0, 'Friday': 0, 'Saturday': 0
    };
    for (let i = 0; i < 24; i++) messagesByHour[i] = 0;

    let totalMessages = 0;
    let lastDoc = null;
    const BATCH_SIZE = 500;
    const activeContacts = new Map<string, number>(); // phoneNumber -> first message timestamp

    // Fetch and process messages in batches
    while (true) {
      let messagesQuery;
      if (lastDoc) {
        messagesQuery = query(
          collectionGroup(db, 'messages'),
          orderBy('timestamp', 'desc'),
          startAfter(lastDoc),
          limit(BATCH_SIZE)
        );
      } else {
        messagesQuery = query(
          collectionGroup(db, 'messages'),
          orderBy('timestamp', 'desc'),
          limit(BATCH_SIZE)
        );
      }

      const messagesSnapshot = await getDocs(messagesQuery);
      
      if (messagesSnapshot.empty) break;

      lastDoc = messagesSnapshot.docs[messagesSnapshot.docs.length - 1];

      // Process this batch of messages
      const messages = messagesSnapshot.docs
        .filter(doc => {
          const path = doc.ref.path.split('/');
          return path[0] === 'Whatsapp_Data' && path[1] === userUID;
        })
        .map(doc => {
          const data = doc.data() as MessageDoc;
          const path = doc.ref.path.split('/');
          const phoneNumber = path[3]; // Get phone number from path
          let timestamp = Date.now();
          
          if (data.timestamp?.seconds) {
            timestamp = data.timestamp.seconds * 1000;
          }

          // Track the earliest message timestamp for each contact
          if (!activeContacts.has(phoneNumber) || timestamp < activeContacts.get(phoneNumber)!) {
            activeContacts.set(phoneNumber, timestamp);
          }

          return {
            id: doc.id,
            message: data.message || '',
            timestamp,
            sender: data.sender || 'customer',
            phoneNumber
          };
        });

      // Filter messages based on time interval
      const now = new Date();
      const filteredMessages = messages.filter(message => {
        const messageDate = new Date(message.timestamp);
        switch (dateRange) {
          case 'today':
            return messageDate.toDateString() === now.toDateString();
          case 'week':
            return (now.getTime() - messageDate.getTime()) <= 7 * 24 * 60 * 60 * 1000;
          case 'month':
            return (now.getTime() - messageDate.getTime()) <= 30 * 24 * 60 * 60 * 1000;
          case 'all':
            return true;
          default:
            return true;
        }
      });

      // Update analytics data with this batch
      filteredMessages.forEach(message => {
    const date = new Date(message.timestamp);
    const hour = date.getHours();
    const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
    
    messagesByHour[hour]++;
    messagesByDay[dayOfWeek]++;
      });

      totalMessages += filteredMessages.length;

      if (messagesSnapshot.docs.length < BATCH_SIZE) break;
    }

    // Count contacts based on their first message timestamp
    let activeContactCount = 0;
    const now = new Date();
    activeContacts.forEach((firstMessageTimestamp, phoneNumber) => {
      const firstMessageDate = new Date(firstMessageTimestamp);
      switch (dateRange) {
        case 'today':
          if (firstMessageDate.toDateString() === now.toDateString()) {
            activeContactCount++;
          }
          break;
        case 'week':
          if ((now.getTime() - firstMessageTimestamp) <= 7 * 24 * 60 * 60 * 1000) {
            activeContactCount++;
          }
          break;
        case 'month':
          if ((now.getTime() - firstMessageTimestamp) <= 30 * 24 * 60 * 60 * 1000) {
            activeContactCount++;
          }
          break;
        default:
          activeContactCount = activeContacts.size;
      }
  });
  
  return {
      totalMessages,
      totalContacts: activeContactCount,
    messagesByHour: Object.entries(messagesByHour).map(([hour, count]) => ({
      hour: parseInt(hour),
      count
    })),
      messagesByDay
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
      }
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
 * Update WhatsApp agent configuration in Firebase
 */
export const updateWhatsAppAgentConfig = async (
  uid: string,
  config: {
    enabled: boolean;
    executionLimit: number;
  }
): Promise<void> => {
  try {
    const userRef = doc(db, 'Users', uid);
    
    await updateDoc(userRef, {
      'workflows.whatsapp_agent': {
        enabled: config.enabled,
        limit: config.executionLimit,
        usage: 0 // Reset usage when updating configuration
      }
    });
  } catch (error) {
    console.error('Error updating WhatsApp agent config:', error);
    throw error;
  }
};

/**
 * Get WhatsApp agent configuration from Firebase
 */
export const getWhatsAppAgentConfig = async (uid: string): Promise<{
  enabled: boolean;
  limit: number;
  usage: number;
} | null> => {
  try {
    const userRef = doc(db, 'Users', uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return null;
    }
    
    const userData = userDoc.data();
    const whatsappAgent = userData.workflows?.whatsapp_agent;
    
    if (!whatsappAgent) {
      return {
        enabled: false,
        limit: 100,
        usage: 0
      };
    }
    
    return {
      enabled: whatsappAgent.enabled || false,
      limit: whatsappAgent.limit || 100,
      usage: whatsappAgent.usage || 0
    };
  } catch (error) {
    console.error('Error getting WhatsApp agent config:', error);
    throw error;
  }
};
