
import { Contact } from '../types';

interface ContactItemProps {
  contact: Contact;
  isActive: boolean;
  onClick: () => void;
}

const ContactItem = ({ contact, isActive, onClick }: ContactItemProps) => {
  return (
    <div 
      className={`contact-item flex items-center p-3 cursor-pointer border-b border-gray-100 transition-all duration-200 ${isActive ? 'sidebar-item-active' : ''}`} 
      onClick={onClick}
    >
      <div className="relative">
        <img 
          src={contact.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}&background=random`} 
          alt={contact.name} 
          className="w-12 h-12 rounded-full mr-3 object-cover"
        />
        {contact.status === 'online' && (
          <span className="absolute bottom-0 right-2 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center">
          <h3 className="font-medium text-gray-900 truncate">{contact.name}</h3>
          <span className="text-xs text-gray-500">{contact.lastMessageTime}</span>
        </div>
        <div className="flex justify-between items-center mt-1">
          <p className="text-sm text-gray-500 truncate">{contact.lastMessage}</p>
          {contact.unreadCount && contact.unreadCount > 0 ? (
            <span className="ml-2 bg-green-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {contact.unreadCount}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ContactItem;
