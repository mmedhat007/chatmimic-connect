import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';
import NavSidebar from '../components/NavSidebar';
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

  // Fetch contacts on component mount
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const fetchedContacts = await getContacts();
        setContacts(fetchedContacts);
      } catch (error) {
        console.error('Error fetching contacts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchContacts();
  }, []);

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
    <div className="min-h-screen bg-gray-100 flex">
      {!isMobile && <NavSidebar />}
      <div className="flex-1 flex">
        {/* Sidebar - show on desktop or when chat is not shown on mobile */}
        {(!isMobile || !showChat) && (
          <div className={`${isMobile ? 'w-full' : 'w-1/3'} h-full`}>
            <Sidebar
              contacts={contacts}
              activeContact={activeContact}
              onSelectContact={handleSelectContact}
            />
          </div>
        )}
        
        {/* Chat Area - show on desktop or when chat is shown on mobile */}
        {(!isMobile || showChat) && (
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
  );
};

export default Index;
