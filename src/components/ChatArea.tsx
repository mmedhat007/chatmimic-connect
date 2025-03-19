import { useRef, useEffect, useState } from 'react';
import { Contact, Message } from '../types';
import { ArrowLeft, Send, User, ChevronDown, CheckCircle, Flame, DollarSign, Inbox, ServerCrash } from 'lucide-react';
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
  onUpdateContactStatus?: (contactId: string, status: 'new_lead' | 'vip_lead' | 'hot_lead' | 'payment' | 'customer' | 'cold_lead') => void;
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

  // Set up real-time listener for chat status
  useEffect(() => {
    if (!contact) return;

    const userUID = getCurrentUser();
    if (!userUID) return;

    const chatRef = doc(db, 'Whatsapp_Data', userUID, 'chats', contact.phoneNumber);
    
    const unsubscribe = onSnapshot(chatRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setChatStatus(data.status || 'open');
      }
    });

    return () => unsubscribe();
  }, [contact]);

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

  // Check if user has paid
  useEffect(() => {
    const userUID = getCurrentUser();
    if (!userUID) return;

    const userRef = doc(db, 'Users', userUID);
    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setIsPaid(!!data.workflows?.whatsapp_agent?.paid);
      }
    });

    return () => unsubscribe();
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
  const updateLifecycleStage = async (stageId: 'new_lead' | 'vip_lead' | 'hot_lead' | 'payment' | 'customer' | 'cold_lead') => {
    if (!contact) return;
    
    try {
      // If parent component provided an update function, use it for better state synchronization
      if (onUpdateContactStatus) {
        onUpdateContactStatus(contact.phoneNumber, stageId);
      } else {
        // Fallback to direct update if no parent handler is provided
        await updateContactField(contact.phoneNumber, 'lifecycle', stageId);
      }
      
      setShowLifecycleDropdown(false);
    } catch (error) {
      console.error('Error updating lifecycle stage:', error);
    }
  };

  // Function to get the current lifecycle stage display
  const getCurrentLifecycleStage = () => {
    if (!contact || !contact.lifecycle) return 'Set Stage';
    const stage = lifecycleStages.find(s => s.id === contact.lifecycle);
    return stage ? stage.name : 'Set Stage';
  };

  // Function to get the current lifecycle stage color
  const getCurrentLifecycleColor = () => {
    if (!contact || !contact.lifecycle) return 'bg-gray-100 text-gray-600';
    const stage = lifecycleStages.find(s => s.id === contact.lifecycle);
    return stage ? stage.color : 'bg-gray-100 text-gray-600';
  };

  // Function to get the current lifecycle stage icon
  const getCurrentLifecycleIcon = () => {
    if (!contact || !contact.lifecycle) return <User className="w-4 h-4 text-gray-500" />;
    const stage = lifecycleStages.find(s => s.id === contact.lifecycle);
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
            {/* Lifecycle Stage Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowLifecycleDropdown(!showLifecycleDropdown)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium ${getCurrentLifecycleColor()}`}
              >
                <span className="flex items-center gap-1.5">
                  {getCurrentLifecycleIcon()}
                  {getCurrentLifecycleStage()}
                </span>
                <ChevronDown className="w-3.5 h-3.5 ml-1" />
              </button>
              
              {showLifecycleDropdown && (
                <div className="absolute right-0 mt-1 bg-white border rounded-md shadow-lg z-10 w-48">
                  <div className="py-1">
                    {lifecycleStages.map((stage) => (
                      <button
                        key={stage.id}
                        className={`flex items-center w-full px-3 py-2 text-sm text-left hover:bg-gray-50 ${
                          contact.lifecycle === stage.id ? 'bg-gray-50' : ''
                        }`}
                        onClick={() => updateLifecycleStage(stage.id as 'new_lead' | 'vip_lead' | 'hot_lead' | 'payment' | 'customer' | 'cold_lead')}
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
                  : "Message sending is disabled - Enable human agent to send messages"
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
