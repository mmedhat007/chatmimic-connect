import { useRef, useEffect, useState } from 'react';
import { Contact, Message } from '../types';
import { ArrowLeft, Send, User, ChevronDown, CheckCircle, Flame, DollarSign, Inbox, ServerCrash, RotateCcw } from 'lucide-react';
import { formatTimestamp } from '../services/firebase';
import AgentControls from './AgentControls';
import TagControls from './TagControls';
import { doc, collection, addDoc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db, getCurrentUser, updateContactField, getStageNames } from '../services/firebase';

// Define default lifecycle stages with icons and colors
const defaultLifecycleStages = [
  {
    id: 'new_lead',
    name: 'New Lead',
    icon: <Inbox className="w-4 h-4 text-blue-600" />,
    color: 'bg-blue-100 text-blue-600'
  },
  {
    id: 'vip_lead',
    name: 'VIP Lead',
    icon: <CheckCircle className="w-4 h-4 text-indigo-600" />,
    color: 'bg-indigo-100 text-indigo-600'
  },
  {
    id: 'hot_lead',
    name: 'Hot Lead',
    icon: <Flame className="w-4 h-4 text-orange-600" />,
    color: 'bg-orange-100 text-orange-600'
  },
  {
    id: 'payment',
    name: 'Payment',
    icon: <DollarSign className="w-4 h-4 text-yellow-600" />,
    color: 'bg-yellow-100 text-yellow-600'
  },
  {
    id: 'customer',
    name: 'Customer',
    icon: <User className="w-4 h-4 text-green-600" />,
    color: 'bg-green-100 text-green-600'
  },
  {
    id: 'cold_lead',
    name: 'Cold Lead',
    icon: <ServerCrash className="w-4 h-4 text-red-600" />,
    color: 'bg-red-100 text-red-600'
  }
];

interface ChatAreaProps {
  contact: Contact | null;
  messages: Message[];
  onBack?: () => void;
  isMobile?: boolean;
  onViewLifecycle?: () => void;
  onUpdateContactStatus?: (contactId: string, status: string) => void;
}

const ChatArea = ({ contact, messages, onBack, isMobile, onViewLifecycle, onUpdateContactStatus }: ChatAreaProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isHumanAgent, setIsHumanAgent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [chatStatus, setChatStatus] = useState<string>('open');
  const [isPaid, setIsPaid] = useState(false);
  const [showLifecycleDropdown, setShowLifecycleDropdown] = useState(false);
  const [customStageNames, setCustomStageNames] = useState<{[key: string]: string}>({});
  const [currentLifecycle, setCurrentLifecycle] = useState<string | undefined>(undefined);
  
  // Combined lifecycle stages with custom names
  const lifecycleStages = defaultLifecycleStages.map(stage => ({
    ...stage,
    name: customStageNames[stage.id] || stage.name
  }));

  // Fetch custom stage names
  useEffect(() => {
    const fetchCustomStageNames = async () => {
      const names = await getStageNames();
      if (names) {
        setCustomStageNames(names);
      }
    };
    
    fetchCustomStageNames();
  }, []);

  // Click-away listener for dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowLifecycleDropdown(false);
      }
    };

    // Add event listener
    document.addEventListener('mousedown', handleClickOutside);
    
    // Cleanup
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Set up real-time listener for chat status and lifecycle
  useEffect(() => {
    if (!contact) return;

    const userUID = getCurrentUser();
    if (!userUID) return;

    const chatRef = doc(db, 'Whatsapp_Data', userUID, 'chats', contact.phoneNumber);
    
    const unsubscribe = onSnapshot(chatRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setChatStatus(data.status || 'open');
        // Update the lifecycle value from database in real-time
        setCurrentLifecycle(data.lifecycle);
      }
    });

    return () => unsubscribe();
  }, [contact]);

  // Update current lifecycle when contact changes
  useEffect(() => {
    if (contact) {
      setCurrentLifecycle(contact.lifecycle);
    }
  }, [contact?.phoneNumber]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check if human agent is active
  useEffect(() => {
    if (!contact) return;
    
    const userUID = getCurrentUser();
    if (!userUID) return;

    const chatRef = doc(db, 'Whatsapp_Data', userUID, 'chats', contact.phoneNumber);
    
    // Set up real-time listener for human agent status
    const unsubscribe = onSnapshot(chatRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setIsHumanAgent(data.humanAgent === true);
      }
    }, (error) => {
      console.error('Error checking human agent status:', error);
    });

    return () => unsubscribe();
  }, [contact]);

  // Check if user has paid - one-time check instead of continuous subscription
  useEffect(() => {
    const checkPaidStatus = async () => {
      const userUID = getCurrentUser();
      if (!userUID) return;

      try {
        const userRef = doc(db, 'Users', userUID);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const data = userDoc.data();
          setIsPaid(!!data.workflows?.whatsapp_agent?.paid);
        }
      } catch (error) {
        console.error('Error checking paid status:', error);
      }
    };

    checkPaidStatus();
  }, []);

  const handleSendMessage = async () => {
    if (!contact || !newMessage.trim() || !isHumanAgent) return;

    const userUID = getCurrentUser();
    if (!userUID) return;

    setIsLoading(true);
    try {
      // Get user's WhatsApp credentials and check paid status
      const userRef = doc(db, 'Users', userUID);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        throw new Error('User document not found');
      }

      const userData = userDoc.data();
      const whatsappCredentials = userData.credentials?.whatsappCredentials;
      const isPaidUser = !!userData.workflows?.whatsapp_agent?.paid;
      
      if (!isPaidUser) {
        throw new Error('Please upgrade to the paid plan to send messages');
      }
      
      if (!whatsappCredentials?.access_token || !whatsappCredentials?.phone_number_id) {
        throw new Error('WhatsApp credentials not found');
      }

      // Format the phone number to ensure it includes country code
      const formattedPhoneNumber = contact.phoneNumber.startsWith('+') ? contact.phoneNumber : `+${contact.phoneNumber}`;

      // Send message through WhatsApp API
      console.log('Sending message with credentials:', {
        phoneNumberId: whatsappCredentials.phone_number_id,
        to: formattedPhoneNumber
      });

      const response = await fetch(`https://graph.facebook.com/v17.0/${whatsappCredentials.phone_number_id}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${whatsappCredentials.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedPhoneNumber,
          type: "text",
          text: {
            preview_url: false,
            body: newMessage.trim()
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('WhatsApp API Error:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          phoneNumber: formattedPhoneNumber
        });
        throw new Error(`WhatsApp API Error (${response.status}): ${errorData?.error?.message || response.statusText}`);
      }

      // Parse the successful response
      const responseData = await response.json();
      console.log('WhatsApp API Success:', responseData);

      const timestamp = new Date();
      const messagesRef = collection(
        db,
        'Whatsapp_Data',
        userUID,
        'chats',
        contact.phoneNumber,
        'messages'
      );

      const messageData = {
        message: newMessage.trim(),
        timestamp,
        sender: 'human',
        date: timestamp.toLocaleDateString()
      };

      // Add the message to Firestore
      await addDoc(messagesRef, messageData);

      // Update the chat's last message and timestamp
      const chatRef = doc(db, 'Whatsapp_Data', userUID, 'chats', contact.phoneNumber);
      await updateDoc(chatRef, {
        lastMessage: newMessage.trim(),
        lastMessageTime: timestamp,
        lastMessageSender: 'human'
      });

      // Clear the input
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleChatStatus = async () => {
    if (!contact) return;
    
    const userUID = getCurrentUser();
    if (!userUID) return;
    
    const newStatus = chatStatus === 'open' ? 'closed' : 'open';
    
    try {
      const chatRef = doc(db, 'Whatsapp_Data', userUID, 'chats', contact.phoneNumber);
      await updateDoc(chatRef, {
        status: newStatus
      });
    } catch (error) {
      console.error('Error updating chat status:', error);
    }
  };

  // Helper function to update lifecycle stage
  const updateLifecycleStage = async (stageId: string) => {
    if (!contact || !contact.phoneNumber) {
      console.error('No contact selected');
      return false;
    }
    
    try {
      // Store the exact stage ID to ensure we don't lose it
      const exactStageId = stageId;
      
      // Add global tracking for debugging
      // @ts-ignore
      window.lastLifecycleUpdate = {
        contactId: contact.phoneNumber,
        stageId: exactStageId,
        timestamp: new Date().toISOString()
      };
      
      // Get the current user ID
      const userUID = getCurrentUser();
      if (!userUID) {
        throw new Error('User not authenticated');
      }
      
      // Reference to the contact document
      const contactRef = doc(db, 'Whatsapp_Data', userUID, 'chats', contact.phoneNumber);
      
      // Read the current value before making any updates
      const beforeSnapshot = await getDoc(contactRef);
      const currentValue = beforeSnapshot.exists() ? beforeSnapshot.data().lifecycle : undefined;
      
      // Only update if it's actually changed
      if (currentValue !== exactStageId) {
        // UPDATE WITH MANUAL FLAG: Add manually_set_lifecycle: true to indicate a user manually set this
        await updateDoc(contactRef, {
          lifecycle: exactStageId,
          manually_set_lifecycle: true // Add flag to prevent automatic overwrites
        });
        
        // Verify if the update was successful
        const afterSnapshot = await getDoc(contactRef);
        const newValue = afterSnapshot.exists() ? afterSnapshot.data().lifecycle : undefined;
        
        if (newValue !== exactStageId) {
          console.warn(`Verification failed: expected "${exactStageId}" but got "${newValue || 'none'}"`);
          alert(`Warning: Update failed verification. Expected "${exactStageId}" but found "${newValue || 'none'}" in the database.`);
          return false;
        }
        
        // Update the parent component too
        if (onUpdateContactStatus) {
          await onUpdateContactStatus(contact.phoneNumber, exactStageId);
        }
        
        return true;
      } else {
        // Check if the manual flag is set and update if needed
        const manuallySetFlag = beforeSnapshot.exists() ? beforeSnapshot.data().manually_set_lifecycle : undefined;
        
        if (manuallySetFlag !== true) {
          // Just update the manual flag
          await updateDoc(contactRef, {
            manually_set_lifecycle: true
          });
        }
        
        return true;
      }
    } catch (error) {
      console.error('Error updating lifecycle:', error);
      alert(`Failed to update lifecycle: ${error}`);
      return false;
    }
  };

  // Function to get the current lifecycle stage display
  const getCurrentLifecycleStage = () => {
    // Use real-time lifecycle value first, then fall back to the contact prop
    const lifecycle = currentLifecycle !== undefined ? currentLifecycle : contact?.lifecycle;
    if (!lifecycle) return 'Set Stage';
    
    console.log(`DEBUG - Current lifecycle: "${lifecycle}"`);
    
    // Try different matching strategies in order of preference
    // 1. Direct ID match
    let stage = lifecycleStages.find(s => s.id === lifecycle);
    if (stage) return stage.name;
    
    // 2. Case-insensitive ID match
    stage = lifecycleStages.find(s => s.id.toLowerCase() === lifecycle.toLowerCase());
    if (stage) return stage.name;
    
    // 3. Normalize underscores and try matching
    const normalizedLifecycle = lifecycle.toLowerCase().replace(/_/g, ' ');
    
    stage = lifecycleStages.find(s => 
      s.id.replace(/_/g, ' ').toLowerCase() === normalizedLifecycle ||
      s.name.toLowerCase() === normalizedLifecycle
    );
    
    if (stage) return stage.name;
    
    // 4. NEW: No separator match
    const lifecycleNoSeparator = lifecycle.toLowerCase().replace(/[_\s]/g, '');
    
    stage = lifecycleStages.find(s => 
      s.id.toLowerCase().replace(/[_\s]/g, '') === lifecycleNoSeparator ||
      s.name.toLowerCase().replace(/[_\s]/g, '') === lifecycleNoSeparator
    );
    
    if (stage) return stage.name;
    
    // 5. Format raw value for display
    if (lifecycle.includes('_')) {
      return lifecycle
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
    
    return lifecycle.charAt(0).toUpperCase() + lifecycle.slice(1);
  };

  // Function to get the current lifecycle stage color
  const getCurrentLifecycleColor = () => {
    const lifecycle = currentLifecycle !== undefined ? currentLifecycle : contact?.lifecycle;
    if (!lifecycle) return 'bg-gray-100 text-gray-600';
    
    // 1. Direct ID match
    let stage = lifecycleStages.find(s => s.id === lifecycle);
    if (stage) return stage.color;
    
    // 2. Case-insensitive ID match  
    stage = lifecycleStages.find(s => s.id.toLowerCase() === lifecycle.toLowerCase());
    if (stage) return stage.color;
    
    // 3. Normalize and try more flexible matching
    const normalizedLifecycle = lifecycle.toLowerCase().replace(/_/g, ' ');
    
    stage = lifecycleStages.find(s => 
      s.id.replace(/_/g, ' ').toLowerCase() === normalizedLifecycle ||
      s.name.toLowerCase() === normalizedLifecycle
    );
    
    if (stage) return stage.color;
    
    // 4. NEW: No separator match
    const lifecycleNoSeparator = lifecycle.toLowerCase().replace(/[_\s]/g, '');
    
    stage = lifecycleStages.find(s => 
      s.id.toLowerCase().replace(/[_\s]/g, '') === lifecycleNoSeparator ||
      s.name.toLowerCase().replace(/[_\s]/g, '') === lifecycleNoSeparator
    );
    
    return stage ? stage.color : 'bg-gray-100 text-gray-600';
  };

  // Function to get the current lifecycle stage icon
  const getCurrentLifecycleIcon = () => {
    const lifecycle = currentLifecycle !== undefined ? currentLifecycle : contact?.lifecycle;
    if (!lifecycle) return <User className="w-4 h-4 text-gray-500" />;
    
    // 1. Direct ID match
    let stage = lifecycleStages.find(s => s.id === lifecycle);
    if (stage) return stage.icon;
    
    // 2. Case-insensitive ID match
    stage = lifecycleStages.find(s => s.id.toLowerCase() === lifecycle.toLowerCase());
    if (stage) return stage.icon;
    
    // 3. Normalize and try more flexible matching
    const normalizedLifecycle = lifecycle.toLowerCase().replace(/_/g, ' ');
    
    stage = lifecycleStages.find(s => 
      s.id.replace(/_/g, ' ').toLowerCase() === normalizedLifecycle ||
      s.name.toLowerCase() === normalizedLifecycle
    );
    
    if (stage) return stage.icon;
    
    // 4. NEW: No separator match
    const lifecycleNoSeparator = lifecycle.toLowerCase().replace(/[_\s]/g, '');
    
    stage = lifecycleStages.find(s => 
      s.id.toLowerCase().replace(/[_\s]/g, '') === lifecycleNoSeparator ||
      s.name.toLowerCase().replace(/[_\s]/g, '') === lifecycleNoSeparator
    );
    
    return stage ? stage.icon : <User className="w-4 h-4 text-gray-500" />;
  };

  if (!contact) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <img 
          src="/original icon.png" 
          alt="Chatmimic" 
          className="w-[700px] opacity-10"
          style={{ objectFit: 'contain' }}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Chat Header */}
      <div className="bg-white border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {isMobile && (
              <button
                onClick={onBack}
                className="mr-4 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft size={24} />
              </button>
            )}
            <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-white">
              {contact.phoneNumber[0]}
            </div>
            <div className="ml-3">
              <div className="font-medium">{contact.phoneNumber}</div>
              <div className="text-sm text-gray-500">
                {contact.contactName || 'No contact name'}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Lifecycle Status Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <div 
                onClick={() => setShowLifecycleDropdown(!showLifecycleDropdown)}
                className="flex items-center space-x-1 px-2 py-1 border rounded-md bg-white text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                <div className="flex items-center">
                  {getCurrentLifecycleIcon()}
                  <span className="ml-1 text-sm font-medium">{lifecycleStages.find(s => s.id === currentLifecycle)?.name || 'Set Stage'}</span>
                  {contact?.manually_set_lifecycle && (
                    <span className="ml-1 text-xs px-1 py-0.5 rounded-full bg-blue-100 text-blue-800" title="Manual mode - automatic tagging disabled">M</span>
                  )}
                </div>
                <ChevronDown className="h-4 w-4 text-gray-500" />
              </div>
              
              {showLifecycleDropdown && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white border rounded-md shadow-lg z-10 py-1">
                  <div className="px-3 py-2 border-b">
                    <h3 className="text-xs font-medium text-gray-500">Set Contact Stage</h3>
                    {contact?.manually_set_lifecycle && (
                      <p className="text-xs text-blue-600 mt-1">Manual mode active</p>
                    )}
                  </div>
                  
                  {/* Add option to enable auto-tagging if in manual mode */}
                  {contact?.manually_set_lifecycle && (
                    <button
                      className="flex items-center w-full px-3 py-2 text-sm text-left hover:bg-gray-50 bg-blue-50 text-blue-700"
                      onClick={async (event) => {
                        // Disable button to prevent double-clicks
                        const btn = event.currentTarget as HTMLButtonElement;
                        btn.disabled = true;
                        
                        try {
                          // Close dropdown
                          setShowLifecycleDropdown(false);
                          
                          // Get user ID
                          const userUID = getCurrentUser();
                          if (!userUID) {
                            throw new Error('No user logged in');
                          }
                          
                          // Reference to contact document
                          const contactRef = doc(db, 'Whatsapp_Data', userUID, 'chats', contact.phoneNumber);
                          
                          // Update to remove manual override flag
                          await updateDoc(contactRef, {
                            manually_set_lifecycle: false
                          });
                          
                          // Show success message
                          alert('Automatic lifecycle tagging has been re-enabled for this contact.');
                        } catch (error) {
                          console.error('Error enabling auto-tagging:', error);
                          alert(`Failed to enable automatic tagging: ${error}`);
                        } finally {
                          // Re-enable button
                          setTimeout(() => {
                            btn.disabled = false;
                          }, 1000);
                        }
                      }}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      <span>Enable Auto-Tagging</span>
                    </button>
                  )}
                  
                  <div className="py-1">
                    {lifecycleStages.map((stage) => (
                      <button
                        key={stage.id}
                        className={`flex items-center w-full px-3 py-2 text-sm text-left hover:bg-gray-50 ${
                          (() => {
                            // Use real-time lifecycle value first, then fall back to the contact prop
                            const lifecycle = currentLifecycle !== undefined ? currentLifecycle : contact?.lifecycle;
                            if (!lifecycle) return '';
                            
                            // 1. Direct ID match
                            if (lifecycle === stage.id) {
                              return 'bg-gray-50';
                            }
                            
                            // 2. Case-insensitive ID match
                            if (lifecycle.toLowerCase() === stage.id.toLowerCase()) {
                              return 'bg-gray-50';
                            }
                            
                            // 3. Normalize underscores and try matching
                            const normalizedLifecycle = lifecycle.toLowerCase().replace(/_/g, ' ');
                            const normalizedStageId = stage.id.replace(/_/g, ' ').toLowerCase();
                            const normalizedStageName = stage.name.toLowerCase();
                            
                            if (normalizedLifecycle === normalizedStageId || 
                                normalizedLifecycle === normalizedStageName) {
                              return 'bg-gray-50';
                            }
                            
                            // 4. NEW: No separator match
                            const lifecycleNoSeparator = lifecycle.toLowerCase().replace(/[_\s]/g, '');
                            const stageIdNoSeparator = stage.id.toLowerCase().replace(/[_\s]/g, '');
                            const stageNameNoSeparator = stage.name.toLowerCase().replace(/[_\s]/g, '');
                            
                            if (lifecycleNoSeparator === stageIdNoSeparator || 
                                lifecycleNoSeparator === stageNameNoSeparator) {
                              return 'bg-gray-50';
                            }
                            
                            return '';
                          })()
                        }`}
                        onClick={async (event) => {
                          // First, disable the button to prevent double-clicks
                          const btn = event.currentTarget as HTMLButtonElement;
                          btn.disabled = true;
                          
                          try {
                            // Log the exact stage ID we're trying to set
                            console.log(`DROPDOWN CLICK - Selected stage: "${stage.id}" (${stage.name})`);
                            console.log(`DROPDOWN CLICK - Current state before update:
                              currentLifecycle: "${currentLifecycle || 'none'}"
                              contact?.lifecycle: "${contact?.lifecycle || 'none'}"
                            `);
                            
                            // Store the exact ID we want to set
                            const exactStageId = stage.id;
                            
                            // Pre-emptively update the local state for immediate feedback
                            setCurrentLifecycle(exactStageId);
                            
                            // Close the dropdown right away
                            setShowLifecycleDropdown(false);
                            
                            // Add a global tracking variable to debug
                            // @ts-ignore
                            window.lastClickedLifecycle = {
                              id: exactStageId,
                              name: stage.name,
                              timestamp: new Date().toISOString()
                            };
                            
                            // Perform the actual update with the exact ID
                            console.log(`DROPDOWN CLICK - Calling updateLifecycleStage with EXACT stage.id="${exactStageId}"`);
                            await updateLifecycleStage(exactStageId);
                            
                            // Force a UI refresh to ensure everything is in sync
                            // This won't actually change the value but will trigger a re-render
                            setCurrentLifecycle(prev => {
                              console.log(`DROPDOWN CLICK - Forcing state refresh: "${prev}" -> "${exactStageId}"`);
                              return exactStageId; 
                            });
                            
                            // Extra step: If we have a direct parent handler, call it again
                            // to ensure state is updated even if the main function had issues
                            if (onUpdateContactStatus) {
                              console.log(`DROPDOWN CLICK - Calling onUpdateContactStatus directly as backup`);
                              try {
                                await onUpdateContactStatus(contact.phoneNumber, exactStageId);
                              } catch (backupError) {
                                console.error(`DROPDOWN CLICK - Backup state update failed:`, backupError);
                              }
                            }
                            
                            console.log(`DROPDOWN CLICK - Update process completed for stage "${exactStageId}"`);
                            
                            // Display a success message
                            alert(`Successfully updated lifecycle to "${stage.name}" (${exactStageId})`);
                          } catch (clickError) {
                            console.error(`DROPDOWN CLICK - Error during update:`, clickError);
                            // If we fail, revert the local state
                            setCurrentLifecycle(contact?.lifecycle);
                            alert(`Failed to update lifecycle: ${clickError}`);
                          } finally {
                            // Re-enable the button
                            setTimeout(() => {
                              btn.disabled = false;
                            }, 1000);
                          }
                        }}
                      >
                        <div className={`flex items-center justify-center w-5 h-5 rounded-md mr-2 ${stage.color.split(' ')[0]}`}>
                          {stage.icon}
                        </div>
                        <span>{stage.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Lifecycle view button - for mobile */}
            {isMobile && onViewLifecycle && (
              <button
                onClick={onViewLifecycle}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
                title="View Contact Details"
              >
                <User className="w-5 h-5" />
              </button>
            )}
            
            <TagControls phoneNumber={contact.phoneNumber} />
            
            <button
              onClick={toggleChatStatus}
              className={`px-2 py-0.5 text-xs rounded-full font-medium transition-colors ${
                chatStatus === 'open'
                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                  : 'bg-red-100 text-red-800 hover:bg-red-200'
              }`}
            >
              {chatStatus === 'open' ? 'Open' : 'Closed'}
            </button>
          </div>
        </div>
        
        <div className="mt-3">
          <AgentControls phoneNumber={contact.phoneNumber} />
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 chat-background relative">
        {!isPaid && (
          <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-md text-center">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Upgrade Required</h3>
              <p className="text-gray-600 mb-4">
                Please upgrade to our paid plan to view and send messages. The basic plan includes:
              </p>
              <ul className="text-left text-gray-600 mb-4 space-y-2">
                <li>• Unlimited conversations</li>
                <li>• Full access to all features</li>
                <li>• 24/7 support</li>
                <li>• Flat rate: 4,000 EGP</li>
              </ul>
              <p className="text-sm text-gray-500">
                Contact our support team to upgrade your plan.
              </p>
            </div>
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.sender === 'user' ? 'justify-start' : 'justify-end'
            }`}
          >
            <div
              className={`max-w-[70%] rounded-lg px-4 py-2 shadow-sm ${
                message.sender === 'user'
                  ? 'bg-white text-gray-800'
                  : message.sender === 'human'
                  ? 'bg-blue-500 text-white'
                  : 'bg-whatsapp-teal-green text-white'
              } message-bubble ${message.sender === 'user' ? 'incoming' : 'outgoing'}`}
            >
              <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{message.message}</p>
              <div
                className={`text-[11px] mt-1 ${
                  message.sender === 'user' ? 'text-gray-500' : 'text-white/80'
                }`}
              >
                {formatTimestamp(message.timestamp)}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="px-4 py-3 border-t border-gray-200 bg-white">
        <div className="relative flex items-center">
          <input
            type="text"
            placeholder={
              !isPaid 
                ? "Please upgrade to the paid plan to send messages" 
                : isHumanAgent 
                  ? "Type a message..." 
                  : "AI agent is responding to messages - Switch to human agent to send messages"
            }
            className={`w-full pr-12 pl-4 py-2 border border-gray-300 rounded-lg ${
              isHumanAgent && isPaid
                ? 'bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500' 
                : 'bg-gray-100 text-gray-500 cursor-not-allowed'
            }`}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={!isHumanAgent || isLoading || !isPaid}
          />
          <button
            onClick={handleSendMessage}
            disabled={!isHumanAgent || !newMessage.trim() || isLoading || !isPaid}
            className={`absolute right-2 p-2 rounded-lg flex items-center justify-center ${
              isHumanAgent && newMessage.trim() && isPaid
                ? 'text-blue-500 hover:text-blue-600'
                : 'text-gray-400 cursor-not-allowed'
            }`}
          >
            <Send size={20} className={isLoading ? 'animate-pulse' : ''} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatArea;
