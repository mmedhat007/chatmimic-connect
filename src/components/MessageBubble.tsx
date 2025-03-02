import { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble = ({ message }: MessageBubbleProps) => {
  const isOutgoing = message.sender === 'customer';
  const formattedTime = new Date(message.timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return (
    <div className={`my-2 flex ${isOutgoing ? 'justify-end' : 'justify-start'} animate-slide-in`}>
      <div className={`message-bubble ${isOutgoing ? 'outgoing' : 'incoming'}`}>
        <p className="text-sm">{message.message}</p>
        <div className="flex items-center justify-end mt-1">
          <span className="text-xs text-gray-500">{formattedTime}</span>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
