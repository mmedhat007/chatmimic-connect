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
  onSnapshot
} from 'firebase/firestore';
import { 
  getAuth, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { Contact, Message, AnalyticsData } from '../types';

const firebaseConfig = {
  apiKey: "REMOVED_FIREBASE_API_KEY",
  authDomain: "denoteai.firebaseapp.com",
  projectId: "denoteai",
  storageBucket: "denoteai.appspot.com",
  messagingSenderId: "107310167146502582562",
  appId: "1:717748658681:web:77ffa59605736e43301d28"
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
export const getContacts = async (): Promise<Contact[]> => {
  const userUID = getCurrentUser();
  if (!userUID) {
    console.error('No user logged in');
    return [];
  }

  try {
    const chatsRef = collection(db, `Whatsapp_Data/${userUID}/chats`);
    const chatsSnapshot = await getDocs(chatsRef);
    
    const contacts: Contact[] = [];
    
    for (const doc of chatsSnapshot.docs) {
      const data = doc.data();
      let lastTimestamp = Date.now();
      
      // Handle Firestore timestamp
      if (data.lastTimestamp?.seconds) {
        lastTimestamp = data.lastTimestamp.seconds * 1000;
      }
      
      contacts.push({
        phoneNumber: doc.id,
        lastMessage: data.lastMessage || '',
        lastTimestamp
      });
    }
    
    return contacts.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return [];
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

        return {
          id: doc.id,
          message: data.message || '',
          timestamp,
          sender: data.sender || 'customer'
        };
      });
      
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
      let lastTimestamp = Date.now();
      
      if (data.lastTimestamp?.seconds) {
        lastTimestamp = data.lastTimestamp.seconds * 1000;
      }

      return {
        phoneNumber: contactSnap.id,
        lastMessage: data.lastMessage || '',
        lastTimestamp
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
