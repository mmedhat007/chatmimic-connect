import { useRef, useEffect } from 'react';
import { Contact, Message } from '../types';
import { ArrowLeft } from 'lucide-react';
import { formatTimestamp } from '../services/firebase';

interface ChatAreaProps {
  contact: Contact | null;
  messages: Message[];
  onBack: () => void;
  isMobile: boolean;
}

const ChatArea = ({ contact, messages, onBack, isMobile }: ChatAreaProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      <div className="bg-white border-b px-4 py-3 flex items-center">
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
          <div className="ml-3">
            <div className="font-medium">{contact.phoneNumber}</div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-100">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'agent' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] rounded-lg px-4 py-2 ${
                message.sender === 'agent'
                  ? 'bg-whatsapp-teal-green text-white rounded-tr-none'
                  : 'bg-white text-gray-800 rounded-tl-none'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap break-words">{message.message}</p>
              <div
                className={`text-xs mt-1 ${
                  message.sender === 'agent' ? 'text-white/80' : 'text-gray-500'
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
      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="relative">
          <input
            type="text"
            placeholder="Message sending is currently disabled"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
            disabled
          />
          <button
            className="absolute right-2 top-1/2 transform -translate-y-1/2 px-4 py-1 bg-gray-400 text-white rounded-lg cursor-not-allowed"
            disabled
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatArea;
