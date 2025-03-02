import { useState } from 'react';
import { Contact } from '../types';
import { Search } from 'lucide-react';
import { formatTimestamp } from '../services/firebase';

interface SidebarProps {
  contacts: Contact[];
  activeContact: Contact | null;
  onSelectContact: (contact: Contact) => void;
}

const Sidebar = ({ contacts, activeContact, onSelectContact }: SidebarProps) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredContacts = contacts.filter(contact =>
    contact.phoneNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.lastMessage.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-white border-r">
      {/* Search Bar */}
      <div className="p-4 border-b">
        <div className="relative">
          <input
            type="text"
            placeholder="Search or start new chat"
            className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
        </div>
      </div>

      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto">
        {filteredContacts.map((contact) => (
          <div
            key={contact.phoneNumber}
            className={`flex items-center p-4 cursor-pointer hover:bg-gray-100 ${
              activeContact?.phoneNumber === contact.phoneNumber ? 'bg-gray-100' : ''
            }`}
            onClick={() => onSelectContact(contact)}
          >
            <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center text-white text-lg">
              {contact.phoneNumber[0]}
            </div>
            <div className="ml-4 flex-1">
              <div className="flex justify-between items-center">
                <span className="font-medium">{contact.phoneNumber}</span>
                <span className="text-sm text-gray-500">
                  {formatTimestamp(contact.lastTimestamp)}
                </span>
              </div>
              <div className="text-sm text-gray-500 truncate">
                {contact.lastMessage}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;
