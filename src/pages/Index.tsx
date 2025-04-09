import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';
import NavSidebar from '../components/NavSidebar';
import LifecycleSidebar from '../components/LifecycleSidebar';
import { Contact, Message } from '../types';
import { useIsMobile } from '../hooks/use-mobile';
import { getContacts, getMessages, getCurrentUser, updateContactField, getStageNames } from '../services/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

// Import default lifecycle stages - copy from LifecycleSidebar.tsx
import { Inbox, CheckCircle, Flame, DollarSign, User, ServerCrash } from 'lucide-react';

// Define the default lifecycle stages to match with
const defaultLifecycleStages = [
  {
    id: 'new_lead',
    name: 'New Lead'
  },
  {
    id: 'vip_lead',
    name: 'VIP Lead'
  },
  {
    id: 'hot_lead',
    name: 'Hot Lead'
  },
  {
    id: 'payment',
    name: 'Payment'
  },
  {
    id: 'customer',
    name: 'Customer'
  },
  {
    id: 'cold_lead',
    name: 'Cold Lead'
  }
];

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
  const [customStageNames, setCustomStageNames] = useState<{[key: string]: string}>({});
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

  // Fetch custom stage names on component mount
  useEffect(() => {
    const fetchCustomStageNames = async () => {
      try {
        const names = await getStageNames();
        if (names) {
          setCustomStageNames(names);
        }
      } catch (error) {
        console.error('Error fetching custom stage names:', error);
      }
    };
    
    fetchCustomStageNames();
  }, []);

  // Filter contacts when activeLifecycleFilter changes
  useEffect(() => {
    if (activeLifecycleFilter) {
      // Create combined lifecycle stages with custom names
      const lifecycleStages = defaultLifecycleStages.map(stage => ({
        ...stage,
        name: customStageNames[stage.id] || stage.name
      }));
      
      // Filter contacts
      const filteredResults = contacts.filter(contact => {
        // Skip if no lifecycle
        if (!contact.lifecycle) {
          return false;
        }
        
        // 1. Direct ID match (most reliable)
        if (contact.lifecycle === activeLifecycleFilter) {
          return true;
        }
        
        // 2. Case-insensitive ID match
        if (contact.lifecycle.toLowerCase() === activeLifecycleFilter.toLowerCase()) {
          return true;
        }
        
        // 3. Normalize underscores and try ID and name matching
        const normalizedContactLC = contact.lifecycle.toLowerCase().replace(/_/g, ' ');
        const normalizedFilterLC = activeLifecycleFilter.toLowerCase().replace(/_/g, ' ');
        
        // Try normalized ID match
        if (normalizedContactLC === normalizedFilterLC) {
          return true;
        }
        
        // 4. Try with underscores explicitly
        const contactWithUnderscores = normalizedContactLC.replace(/\s+/g, '_');
        const filterWithUnderscores = normalizedFilterLC.replace(/\s+/g, '_');
        
        if (contactWithUnderscores === filterWithUnderscores) {
          return true;
        }
        
        // 5. No separator match (remove all spaces and underscores)
        const contactNoSeparator = contact.lifecycle.toLowerCase().replace(/[_\s]/g, '');
        const filterNoSeparator = activeLifecycleFilter.toLowerCase().replace(/[_\s]/g, '');
        
        if (contactNoSeparator === filterNoSeparator) {
          return true;
        }
        
        // 6. Check against all stage IDs and names
        for (const stage of lifecycleStages) {
          // If filtering by this stage ID, check if contact has matching name
          if (activeLifecycleFilter === stage.id) {
            if (normalizedContactLC === stage.name.toLowerCase()) {
              return true;
            }
          }
          
          // If filtering by this stage name, check if contact has matching ID
          if (normalizedFilterLC === stage.name.toLowerCase()) {
            if (normalizedContactLC === stage.id.toLowerCase().replace(/_/g, ' ')) {
              return true;
            }
          }
          
          // Additional check: Filter by stage ID but contact has normalized stage ID without underscores
          if (activeLifecycleFilter === stage.id && 
              normalizedContactLC === stage.id.toLowerCase().replace(/_/g, ' ')) {
            return true;
          }
          
          // No separator match for stage names
          const stageNameNoSeparator = stage.name.toLowerCase().replace(/[_\s]/g, '');
          const stageIdNoSeparator = stage.id.toLowerCase().replace(/[_\s]/g, '');
          
          if (contactNoSeparator === stageNameNoSeparator && 
             (activeLifecycleFilter === stage.id || filterNoSeparator === stageNameNoSeparator)) {
            return true;
          }
          
          if (contactNoSeparator === stageIdNoSeparator && 
             (activeLifecycleFilter === stage.id || filterNoSeparator === stageIdNoSeparator)) {
            return true;
          }
        }

        // Special case handling for "hot_lead" vs "hot lead" vs "Hot Lead" etc.
        // This is a fallback for any edge cases
        const directCompare = [
          contact.lifecycle,  
          contact.lifecycle.toLowerCase(),
          contact.lifecycle.toLowerCase().replace(/_/g, ' '),
          contact.lifecycle.toLowerCase().replace(/\s+/g, '_'),
          contact.lifecycle.toLowerCase().replace(/[_\s]/g, '')
        ];
        
        const filterCompare = [
          activeLifecycleFilter,
          activeLifecycleFilter.toLowerCase(),
          activeLifecycleFilter.toLowerCase().replace(/_/g, ' '),
          activeLifecycleFilter.toLowerCase().replace(/\s+/g, '_'),
          activeLifecycleFilter.toLowerCase().replace(/[_\s]/g, '')
        ];
        
        // Try all combinations
        for (const contactFormat of directCompare) {
          for (const filterFormat of filterCompare) {
            if (contactFormat === filterFormat) {
              return true;
            }
          }
        }
        
        // No match found after all checks
        return false;
      });
      
      setFilteredContacts(filteredResults);
    } else {
      setFilteredContacts(contacts);
    }
  }, [activeLifecycleFilter, contacts, customStageNames]);

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

  const handleDeleteContact = (deletedPhoneNumber: string) => {
    // If the deleted contact was the active one, clear the active state
    if (activeContact?.phoneNumber === deletedPhoneNumber) {
      setActiveContact(null);
      setMessages([]); // Clear messages as well
      if (isMobile) {
        setShowChat(false); // Go back to list view on mobile
      }
    }
    // The contact list will update automatically due to the real-time listener
  };

  const handleUpdateContactStatus = async (contactId: string, status: string) => {
    try {
      // Store the exact status value to ensure we don't lose it
      const exactStatusValue = status;
      
      // Add global tracking for debugging
      // @ts-ignore
      window.lastHandleUpdateCall = {
        contactId,
        status: exactStatusValue,
        timestamp: new Date().toISOString()
      };
      
      // Get the current user ID
      const userUID = getCurrentUser();
      if (!userUID) {
        console.error('Error: User not authenticated');
        throw new Error('User not authenticated');
      }
      
      // Reference to the contact document
      const contactRef = doc(db, 'Whatsapp_Data', userUID, 'chats', contactId);
      
      // First check if contact exists and get its current lifecycle value
      const contactSnap = await getDoc(contactRef);
      if (!contactSnap.exists()) {
        console.error(`Error: Contact ${contactId} does not exist`);
        throw new Error(`Contact ${contactId} does not exist`);
      }
      
      const currentData = contactSnap.data();
      
      // Try to update the database
      let databaseUpdated = false;
      try {
        if (currentData.lifecycle !== exactStatusValue) {
          // Only update if the value is different to avoid unnecessary writes
          await updateDoc(contactRef, {
            lifecycle: exactStatusValue, // Use the exact value
            manually_set_lifecycle: true // Add flag to prevent automatic updates
          });
          
          // Verify the write was successful
          const verifySnapshot = await getDoc(contactRef);
          if (verifySnapshot.exists()) {
            const verifiedValue = verifySnapshot.data().lifecycle;
            
            if (verifiedValue !== exactStatusValue) {
              // Try a more forceful approach if verification fails
              const { setDoc } = await import('firebase/firestore');
              await setDoc(contactRef, { 
                lifecycle: exactStatusValue,
                manually_set_lifecycle: true 
              }, { merge: true });
            }
          }
        } else {
          // Check if we need to set the manual flag
          if (currentData.manually_set_lifecycle !== true) {
            await updateDoc(contactRef, {
              manually_set_lifecycle: true
            });
          }
        }
        databaseUpdated = true;
      } catch (dbError) {
        console.error(`Warning: Couldn't update database:`, dbError);
        // Continue with state updates even if this fails, as ChatArea should have already updated the DB
      }
      
      // STATE UPDATE SECTION - Ensure UI reflects changes
      // 1. Update main contacts array
      setContacts(prevContacts => {
        const newContacts = prevContacts.map(contact => 
          contact.phoneNumber === contactId 
            ? { ...contact, lifecycle: exactStatusValue } // Use exact value
            : contact
        );
        return newContacts;
      });
      
      // 2. Update filtered contacts
      setFilteredContacts(prevContacts => {
        const newFilteredContacts = prevContacts.map(contact => 
          contact.phoneNumber === contactId 
            ? { ...contact, lifecycle: exactStatusValue } // Use exact value
            : contact
        );
        return newFilteredContacts;
      });
      
      // 3. Update active contact if it's the one being modified
      if (activeContact && activeContact.phoneNumber === contactId) {
        setActiveContact(prev => prev ? { ...prev, lifecycle: exactStatusValue } : null); // Use exact value
      }
      
      // Verify state updates took effect
      setTimeout(() => {
        // Verify in database (again)
        getDoc(contactRef)
          .then(snapshot => {
            if (snapshot.exists()) {
              const data = snapshot.data();
              
              if (data.lifecycle !== exactStatusValue) {
                // If still wrong, try one last update
                updateDoc(contactRef, { 
                  lifecycle: exactStatusValue,
                  manually_set_lifecycle: true 
                })
                  .catch(err => console.error(`Final correction failed:`, err));
              }
            }
          })
          .catch(err => {
            console.error(`Error in post-verification:`, err);
          });
      }, 1000);
      
      return true;
    } catch (error) {
      console.error('Error updating contact status:', error);
      alert(`Failed to update contact status: ${error}\nPlease try again.`);
      return false;
    }
  };

  const handleFilterByLifecycle = (lifecycleId: string | null) => {
    setActiveLifecycleFilter(lifecycleId);
    
    // If on mobile, return to contacts list view
    if (isMobile) {
      setShowChat(false);
      setShowLifecycle(false);
    }
    
    // Don't clear active contact immediately if:
    // 1. We're removing a filter (showing all contacts)
    // 2. The active contact already has the lifecycle we're filtering by
    const shouldClearActiveContact = 
      activeContact && 
      lifecycleId !== null && 
      !(
        // Skip if contact lifecycle matches the filter exactly
        activeContact.lifecycle === lifecycleId ||
        // Skip if contact lifecycle matches with case insensitivity
        (activeContact.lifecycle && lifecycleId && 
         activeContact.lifecycle.toLowerCase() === lifecycleId.toLowerCase()) ||
        // Skip if contact lifecycle matches after normalization
        (activeContact.lifecycle && lifecycleId &&
         activeContact.lifecycle.toLowerCase().replace(/[_\s]/g, '') === 
         lifecycleId.toLowerCase().replace(/[_\s]/g, ''))
      );
    
    if (shouldClearActiveContact) {
      setActiveContact(null);
    }
    
    // Force a state refresh of the filtered contacts to ensure sync with the filter
    setFilteredContacts(prevContacts => {
      // Re-apply the filter logic with the new filter immediately
      if (lifecycleId === null) {
        return [...contacts]; // Create a new array to trigger re-render
      } else {
        return [...prevContacts]; // Create a new array to trigger re-render
      }
    });
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
                onDeleteContact={handleDeleteContact}
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
