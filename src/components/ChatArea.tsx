
import { useState, useEffect, useRef } from 'react';
import { Contact, Message } from '../types';
import MessageBubble from './MessageBubble';
import { getMessages } from '../services/firebase';
import { ArrowLeft, MoreVertical, Phone, Paperclip, Smile, Mic, Send } from 'lucide-react';

interface ChatAreaProps {
  contact: Contact | null;
  onBack?: () => void;
  isMobile?: boolean;
}

const ChatArea = ({ contact, onBack, isMobile = false }: ChatAreaProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!contact) return;
      
      setIsLoading(true);
      try {
        const messagesData = await getMessages(contact.id);
        setMessages(messagesData);
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, [contact]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = () => {
    if (!inputMessage.trim() || !contact) return;

    // In a real app, you would save to Firestore here
    const newMessage: Message = {
      id: Date.now().toString(),
      contactId: contact.id,
      text: inputMessage,
      timestamp: new Date().toISOString(),
      sender: 'user',
      status: 'sent'
    };

    setMessages(prev => [...prev, newMessage]);
    setInputMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!contact) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-xl text-gray-500">Select a contact to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Chat Header */}
      <div className="flex items-center p-3 bg-gray-50 border-b">
        {isMobile && (
          <button 
            onClick={onBack} 
            className="mr-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="flex items-center flex-1">
          <img 
            src={contact.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}&background=random`} 
            alt={contact.name} 
            className="w-10 h-10 rounded-full mr-3 object-cover"
          />
          <div>
            <h2 className="font-medium text-gray-900">{contact.name}</h2>
            <p className="text-xs text-gray-500">
              {contact.status === 'online' ? 'Online' : 'Last seen recently'}
            </p>
          </div>
        </div>
        <div className="flex gap-4">
          <button className="text-gray-600 hover:text-gray-900 transition-colors">
            <Phone size={20} />
          </button>
          <button className="text-gray-600 hover:text-gray-900 transition-colors">
            <MoreVertical size={20} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 chat-background">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
          </div>
        ) : messages.length > 0 ? (
          <>
            {messages.map(message => (
              <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No messages yet. Start the conversation!
          </div>
        )}
      </div>

      {/* Message Input */}
      <div className="p-3 bg-gray-50 border-t">
        <div className="flex items-center gap-2">
          <button className="text-gray-600 hover:text-gray-900 transition-colors">
            <Smile size={20} />
          </button>
          <button className="text-gray-600 hover:text-gray-900 transition-colors">
            <Paperclip size={20} />
          </button>
          <div className="flex-1">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type a message"
              className="w-full p-2 bg-white rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all resize-none max-h-24"
              rows={1}
            />
          </div>
          {inputMessage.trim() ? (
            <button 
              onClick={handleSendMessage}
              className="p-2 rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors"
            >
              <Send size={20} />
            </button>
          ) : (
            <button className="text-gray-600 hover:text-gray-900 transition-colors">
              <Mic size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatArea;
