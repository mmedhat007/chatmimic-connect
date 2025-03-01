
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  query, 
  where, 
  orderBy 
} from 'firebase/firestore';
import { Contact, Message } from '../types';

// Replace with your Firebase config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Get all contacts
export const getContacts = async (): Promise<Contact[]> => {
  try {
    const contactsCollection = collection(db, 'contacts');
    const contactsSnapshot = await getDocs(contactsCollection);
    return contactsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Contact));
  } catch (error) {
    console.error("Error fetching contacts:", error);
    // Return mock data for development if Firestore is not set up yet
    return [
      {
        id: '1',
        name: 'John Doe',
        avatar: 'https://ui-avatars.com/api/?name=John+Doe&background=random',
        lastMessage: 'Hey, how are you?',
        lastMessageTime: '10:30 AM',
        unreadCount: 2,
        status: 'online',
        phoneNumber: '+1234567890'
      },
      {
        id: '2',
        name: 'Jane Smith',
        avatar: 'https://ui-avatars.com/api/?name=Jane+Smith&background=random',
        lastMessage: 'Can we meet tomorrow?',
        lastMessageTime: 'Yesterday',
        unreadCount: 0,
        status: 'offline',
        phoneNumber: '+0987654321'
      },
      {
        id: '3',
        name: 'Mike Johnson',
        avatar: 'https://ui-avatars.com/api/?name=Mike+Johnson&background=random',
        lastMessage: 'I sent you the document',
        lastMessageTime: '2:45 PM',
        unreadCount: 1,
        status: 'online',
        phoneNumber: '+1122334455'
      },
      {
        id: '4',
        name: 'Sarah Williams',
        avatar: 'https://ui-avatars.com/api/?name=Sarah+Williams&background=random',
        lastMessage: 'Thanks for your help!',
        lastMessageTime: 'Monday',
        unreadCount: 0,
        status: 'offline',
        phoneNumber: '+5566778899'
      },
      {
        id: '5',
        name: 'Robert Brown',
        avatar: 'https://ui-avatars.com/api/?name=Robert+Brown&background=random',
        lastMessage: 'Let\'s catch up soon',
        lastMessageTime: '5:18 PM',
        unreadCount: 0,
        status: 'online',
        phoneNumber: '+2233445566'
      },
    ];
  }
};

// Get messages for a specific contact
export const getMessages = async (contactId: string): Promise<Message[]> => {
  try {
    const messagesCollection = collection(db, 'messages');
    const q = query(
      messagesCollection,
      where('contactId', '==', contactId),
      orderBy('timestamp', 'asc')
    );
    const messagesSnapshot = await getDocs(q);
    return messagesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Message));
  } catch (error) {
    console.error(`Error fetching messages for contact ${contactId}:`, error);
    // Return mock data for development if Firestore is not set up yet
    return [
      {
        id: '1',
        contactId,
        text: 'Hey there!',
        timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        sender: 'contact',
        status: 'read',
      },
      {
        id: '2',
        contactId,
        text: 'Hi! How are you doing?',
        timestamp: new Date(Date.now() - 82800000).toISOString(), // 23 hours ago
        sender: 'user',
        status: 'read',
      },
      {
        id: '3',
        contactId,
        text: 'I\'m good, thanks! Just working on some projects.',
        timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        sender: 'contact',
        status: 'read',
      },
      {
        id: '4',
        contactId,
        text: 'Sounds interesting. What kind of projects?',
        timestamp: new Date(Date.now() - 1800000).toISOString(), // 30 mins ago
        sender: 'user',
        status: 'read',
      },
      {
        id: '5',
        contactId,
        text: 'Mostly web development stuff. I\'m learning React and Firebase.',
        timestamp: new Date(Date.now() - 900000).toISOString(), // 15 mins ago
        sender: 'contact',
        status: 'read',
      },
      {
        id: '6',
        contactId,
        text: 'That\'s awesome! I can help you with that if you need any assistance.',
        timestamp: new Date(Date.now() - 60000).toISOString(), // 1 min ago
        sender: 'user',
        status: 'delivered',
      },
    ];
  }
};

// Get a specific contact
export const getContact = async (contactId: string): Promise<Contact | null> => {
  try {
    const contactRef = doc(db, 'contacts', contactId);
    const contactSnap = await getDoc(contactRef);
    
    if (contactSnap.exists()) {
      return {
        id: contactSnap.id,
        ...contactSnap.data()
      } as Contact;
    } else {
      console.log("No such contact!");
      return null;
    }
  } catch (error) {
    console.error(`Error fetching contact ${contactId}:`, error);
    return null;
  }
};
