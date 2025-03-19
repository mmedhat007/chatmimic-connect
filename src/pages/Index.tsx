import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';
import NavSidebar from '../components/NavSidebar';
import LifecycleSidebar from '../components/LifecycleSidebar';
import { Contact, Message } from '../types';
import { useIsMobile } from '../hooks/use-mobile';
import { getContacts, getMessages, getCurrentUser, updateContactField } from '../services/firebase';

// Mock function to replace Supabase
const getAgentConfig = async (uid: string) => {
  // Try to get from localStorage first
  const storedConfig = localStorage.getItem(`user_${uid}_config`);
  if (storedConfig) {
    try {
      return JSON.parse(storedConfig);
    } catch (e) {
      console.error('Error parsing stored config:', e);
    }
  }
  return null;
};

const Index = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [showLifecycle, setShowLifecycle] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeLifecycleFilter, setActiveLifecycleFilter] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const userUID = getCurrentUser();

  // Check if the user has completed the agent setup
  useEffect(() => {
    const checkSetup = async () => {
      if (!userUID) return;
      
      try {
        // Check if agent config exists
        const agentConfig = await getAgentConfig(userUID);
        
        if (!agentConfig) {
          // If the agent config doesn't exist, redirect to the agent setup page
          navigate('/agent-setup');
          return;
        }
        
        // Create a default WhatsApp config if it doesn't exist yet
        // This prevents the need to show a separate WhatsApp setup page
        if (!localStorage.getItem(`user_${userUID}_whatsapp_config`)) {
          const defaultWhatsAppConfig = {
            setup_skipped: true,
            timestamp: new Date().toISOString(),
            note: "WhatsApp setup skipped - user can configure later from settings"
          };
          localStorage.setItem(`user_${userUID}_whatsapp_config`, JSON.stringify(defaultWhatsAppConfig));
          console.log('Created default WhatsApp config to skip setup page');
        }
      } catch (error) {
        console.error('Error checking agent setup:', error);
      }
    };
    
    checkSetup();
  }, [userUID, navigate]);

  // Fetch contacts on component mount
  useEffect(() => {
    const unsubscribe = getContacts((fetchedContacts) => {
      setContacts(fetchedContacts);
      setFilteredContacts(fetchedContacts); // Initialize filtered contacts with all contacts
      
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

  // Filter contacts when activeLifecycleFilter changes
  useEffect(() => {
    if (activeLifecycleFilter) {
      setFilteredContacts(contacts.filter(contact => contact.lifecycle === activeLifecycleFilter));
    } else {
      setFilteredContacts(contacts);
    }
  }, [activeLifecycleFilter, contacts]);

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
      setShowLifecycle(false);
    }
  };

  const handleBack = () => {
    setShowChat(false);
  };

  const handleUpdateContactStatus = async (contactId: string, status: 'new_lead' | 'vip_lead' | 'hot_lead' | 'payment' | 'customer' | 'cold_lead') => {
    try {
      // Update in Firebase
      await updateContactField(contactId, 'lifecycle', status);
      
      // Update local state immediately for better UI responsiveness
      setContacts(prevContacts => 
        prevContacts.map(contact => 
          contact.phoneNumber === contactId 
            ? { ...contact, lifecycle: status } 
            : contact
        )
      );
      
      // Also update the filtered contacts to ensure the sidebar reflects changes
      setFilteredContacts(prevContacts => 
        prevContacts.map(contact => 
          contact.phoneNumber === contactId 
            ? { ...contact, lifecycle: status } 
            : contact
        )
      );
      
      // Update active contact if it's the one being modified
      if (activeContact && activeContact.phoneNumber === contactId) {
        setActiveContact(prev => prev ? { ...prev, lifecycle: status } : null);
      }

      console.log(`Updated contact ${contactId} lifecycle to ${status}`);
    } catch (error) {
      console.error('Error updating contact status:', error);
    }
  };

  const handleFilterByLifecycle = (lifecycleId: string | null) => {
    setActiveLifecycleFilter(lifecycleId);
    // If on mobile, return to contacts list view
    if (isMobile) {
      setShowChat(false);
      setShowLifecycle(false);
    }
    // Clear active contact if filter changes
    if (activeContact && activeContact.lifecycle !== lifecycleId && lifecycleId !== null) {
      setActiveContact(null);
    }
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
      <div className="flex-1 flex ml-16 overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Lifecycle Sidebar - Always show on desktop, conditionally on mobile */}
          {(!isMobile || showLifecycle) && (
            <div className={`${isMobile ? 'w-full' : 'w-64'} h-full flex-shrink-0 border-r`}>
              <LifecycleSidebar
                contact={activeContact}
                onUpdateContactStatus={handleUpdateContactStatus}
                onClose={() => setShowLifecycle(false)}
                isMobile={isMobile}
                onFilterByLifecycle={handleFilterByLifecycle}
                activeFilter={activeLifecycleFilter}
              />
            </div>
          )}
          
          {/* Chat List Sidebar */}
          {(!isMobile || (!showChat && !showLifecycle)) && (
            <div className={`${isMobile ? 'w-full' : 'w-[320px]'} h-full flex-shrink-0 border-r`}>
              <Sidebar
                contacts={filteredContacts}
                activeContact={activeContact}
                onSelectContact={handleSelectContact}
                lifecycleFilter={activeLifecycleFilter}
              />
            </div>
          )}
          
          {/* Chat Area */}
          {(isMobile ? showChat : true) && activeContact && (
            <div className={`${isMobile ? 'w-full' : 'flex-1'} h-full`}>
              <ChatArea
                contact={activeContact}
                messages={messages}
                onBack={handleBack}
                isMobile={isMobile}
                onUpdateContactStatus={handleUpdateContactStatus}
                onViewLifecycle={() => {
                  if (isMobile) {
                    setShowLifecycle(true);
                    setShowChat(false);
                  }
                }}
              />
            </div>
          )}
          
          {/* Empty state when no contact is selected */}
          {!isMobile && !activeContact && (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-700 mb-2">Select a conversation</h3>
                <p className="text-gray-500">Choose a contact from the sidebar to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
