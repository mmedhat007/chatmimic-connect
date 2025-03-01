
import { Message } from '../types';
import { CheckCheck, Check } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble = ({ message }: MessageBubbleProps) => {
  const isOutgoing = message.sender === 'user';
  const formattedTime = new Date(message.timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return (
    <div className={`my-2 flex ${isOutgoing ? 'justify-end' : 'justify-start'} animate-slide-in`}>
      <div className={`message-bubble ${isOutgoing ? 'outgoing' : 'incoming'}`}>
        <p className="text-sm">{message.text}</p>
        <div className="flex items-center justify-end mt-1 gap-1">
          <span className="text-xs text-gray-500">{formattedTime}</span>
          {isOutgoing && (
            <span className="text-gray-500">
              {message.status === 'read' ? (
                <CheckCheck size={16} className="text-blue-500" />
              ) : message.status === 'delivered' ? (
                <CheckCheck size={16} />
              ) : (
                <Check size={16} />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
