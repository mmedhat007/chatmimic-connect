import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';
import NavSidebar from '../components/NavSidebar';
import GoogleSheetsButton from '../components/GoogleSheetsButton';
import { Contact, Message } from '../types';
import { useIsMobile } from '../hooks/use-mobile';
import { getContacts, getMessages } from '../services/firebase';

const Index = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();

  // Fetch contacts on component mount
  useEffect(() => {
    const unsubscribe = getContacts((fetchedContacts) => {
      setContacts(fetchedContacts);
      
      // If there's a selected contact in the navigation state, set it as active
      if (location.state?.selectedContact) {
        const selectedContact = location.state.selectedContact;
        const contact = fetchedContacts.find(c => c.phoneNumber === selectedContact.phoneNumber);
        if (contact) {
          setActiveContact(contact);
          if (isMobile) {
            setShowChat(true);
          }
        }
        // Clear the navigation state
        navigate('/', { replace: true });
      }
      
      setLoading(false);
    });

    // Clean up listener when component unmounts
    return () => unsubscribe();
  }, [location.state, navigate, isMobile]);

  // Set up real-time messages listener when active contact changes
  useEffect(() => {
    let unsubscribe: () => void = () => {};

    if (activeContact) {
      unsubscribe = getMessages(activeContact.phoneNumber, (updatedMessages) => {
        setMessages(updatedMessages);
      });
    } else {
      setMessages([]);
    }

    // Clean up listener when component unmounts or active contact changes
    return () => {
      unsubscribe();
    };
  }, [activeContact]);

  useEffect(() => {
    if (!isMobile) {
      setShowChat(false);
    }
  }, [isMobile]);

  const handleSelectContact = (contact: Contact) => {
    setActiveContact(contact);
    if (isMobile) {
      setShowChat(true);
    }
  };

  const handleBack = () => {
    setShowChat(false);
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-50">
      <NavSidebar />
      <div className="flex-1 flex flex-col ml-16">
        {/* Header */}
        <div className="bg-white border-b px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-gray-800">ChatMimic</h1>
          <GoogleSheetsButton />
        </div>
        
        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {(!isMobile || !showChat) && (
            <div className={`${isMobile ? 'w-full' : 'w-[380px]'} h-full flex-shrink-0 border-r`}>
              <Sidebar
                contacts={contacts}
                activeContact={activeContact}
                onSelectContact={handleSelectContact}
              />
            </div>
          )}
          {(isMobile ? showChat : true) && (
            <div className={`${isMobile ? 'w-full' : 'flex-1'} h-full`}>
              <ChatArea
                contact={activeContact}
                messages={messages}
                onBack={handleBack}
                isMobile={isMobile}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
