import { useRef, useEffect, useState } from 'react';
import { Contact, Message } from '../types';
import { ArrowLeft, Send } from 'lucide-react';
import { formatTimestamp } from '../services/firebase';
import AgentControls from './AgentControls';
import { doc, collection, addDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db, getCurrentUser } from '../services/firebase';

interface ChatAreaProps {
  contact: Contact | null;
  messages: Message[];
  onBack: () => void;
  isMobile: boolean;
}

const ChatArea = ({ contact, messages, onBack, isMobile }: ChatAreaProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isHumanAgent, setIsHumanAgent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [chatStatus, setChatStatus] = useState(contact?.status || 'open');

  // Update chat status when contact changes
  useEffect(() => {
    setChatStatus(contact?.status || 'open');
  }, [contact?.status]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check if human agent is active
  useEffect(() => {
    const checkHumanAgentStatus = async () => {
      if (!contact) return;
      
      const userUID = getCurrentUser();
      if (!userUID) return;

      try {
        const chatRef = doc(db, 'Whatsapp_Data', userUID, 'chats', contact.phoneNumber);
        const chatDoc = await getDoc(chatRef);
        
        if (chatDoc.exists()) {
          const data = chatDoc.data();
          // Only need to check if human agent is active, AI status doesn't affect messaging
          setIsHumanAgent(data.humanAgent === true);
        }
      } catch (error) {
        console.error('Error checking human agent status:', error);
      }
    };

    checkHumanAgentStatus();
  }, [contact]);

  const handleSendMessage = async () => {
    if (!contact || !newMessage.trim() || !isHumanAgent) return;

    const userUID = getCurrentUser();
    if (!userUID) return;

    setIsLoading(true);
    try {
      const messagesRef = collection(
        db,
        'Whatsapp_Data',
        userUID,
        'chats',
        contact.phoneNumber,
        'messages'
      );

      const timestamp = new Date();
      const messageData = {
        message: newMessage.trim(),
        timestamp,
        sender: 'human',
        date: timestamp.toLocaleDateString()
      };

      // Add the new message
      await addDoc(messagesRef, messageData);

      // Update the chat's last message
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
      setChatStatus(newStatus);
    } catch (error) {
      console.error('Error updating chat status:', error);
    }
  };

  if (!contact) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <p className="text-xl">Select a contact to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Chat Header */}
      <div className="bg-white border-b px-4 py-3">
        <div className="flex items-center">
          {isMobile && (
            <button
              onClick={onBack}
              className="mr-4 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft size={24} />
            </button>
          )}
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-white">
              {contact.phoneNumber[0]}
            </div>
            <div className="ml-3 flex items-center gap-3">
              <div className="font-medium">{contact.phoneNumber}</div>
              <button
                onClick={toggleChatStatus}
                className={`px-2 py-0.5 text-xs rounded-full font-medium transition-colors ${
                  chatStatus === 'open'
                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                    : chatStatus === 'closed'
                    ? 'bg-red-100 text-red-800 hover:bg-red-200'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                {chatStatus || 'Set Status'}
              </button>
            </div>
          </div>
        </div>
        
        {/* Agent Controls */}
        <div className="mt-3">
          <AgentControls phoneNumber={contact.phoneNumber} />
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 chat-background">
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
            placeholder={isHumanAgent ? "Type a message..." : "Message sending is disabled - Enable human agent to send messages"}
            className={`w-full pr-12 pl-4 py-2 border border-gray-300 rounded-lg ${
              isHumanAgent 
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
            disabled={!isHumanAgent || isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={!isHumanAgent || !newMessage.trim() || isLoading}
            className={`absolute right-2 p-2 rounded-lg flex items-center justify-center ${
              isHumanAgent && newMessage.trim()
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
