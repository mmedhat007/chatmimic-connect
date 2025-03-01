
import { useState, useEffect } from 'react';
import { Contact } from '../types';
import ContactItem from './ContactItem';
import { Search, Users } from 'lucide-react';
import { getContacts } from '../services/firebase';

interface SidebarProps {
  activeContact: Contact | null;
  onSelectContact: (contact: Contact) => void;
}

const Sidebar = ({ activeContact, onSelectContact }: SidebarProps) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const contactsData = await getContacts();
        setContacts(contactsData);
      } catch (error) {
        console.error('Error fetching contacts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchContacts();
  }, []);

  const filteredContacts = contacts.filter(contact => 
    contact.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-white border-r">
      {/* Header */}
      <div className="py-4 px-3 bg-gray-50 border-b">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-gray-800">WhatsApp</h1>
          <button className="text-gray-600 hover:text-gray-900 transition-colors">
            <Users size={20} />
          </button>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Search or start new chat"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-2 pl-10 bg-white rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
        </div>
      </div>

      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
          </div>
        ) : filteredContacts.length > 0 ? (
          filteredContacts.map(contact => (
            <ContactItem
              key={contact.id}
              contact={contact}
              isActive={activeContact?.id === contact.id}
              onClick={() => onSelectContact(contact)}
            />
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            {searchTerm ? "No contacts found" : "No contacts available"}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
