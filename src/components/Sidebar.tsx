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
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'open' | 'closed'>('all');

  // Get all unique tags
  const allTags = Array.from(new Set(contacts.flatMap(contact => contact.tags || [])));

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = 
      contact.phoneNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.lastMessage.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTag = !selectedTag || (contact.tags && contact.tags.includes(selectedTag));
    
    const matchesStatus = selectedStatus === 'all' || contact.status === selectedStatus;
    
    return matchesSearch && matchesTag && matchesStatus;
  });

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Search Bar */}
      <div className="p-4 border-b flex-shrink-0">
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

      {/* Filters Section */}
      <div className="p-4 border-b flex-shrink-0">
        {/* Status Filter */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setSelectedStatus('all')}
            className={`px-3 py-1 text-sm rounded-full flex-1 ${
              selectedStatus === 'all'
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setSelectedStatus('open')}
            className={`px-3 py-1 text-sm rounded-full flex-1 ${
              selectedStatus === 'open'
                ? 'bg-green-600 text-white'
                : 'bg-green-50 text-green-700 hover:bg-green-100'
            }`}
          >
            Open
          </button>
          <button
            onClick={() => setSelectedStatus('closed')}
            className={`px-3 py-1 text-sm rounded-full flex-1 ${
              selectedStatus === 'closed'
                ? 'bg-red-600 text-white'
                : 'bg-red-50 text-red-700 hover:bg-red-100'
            }`}
          >
            Closed
          </button>
        </div>

        {/* Tags Dropdown */}
        <div className="relative">
          <select
            value={selectedTag || ''}
            onChange={(e) => setSelectedTag(e.target.value || null)}
            className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none"
          >
            <option value="">All Tags</option>
            {allTags.map(tag => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto">
        {filteredContacts.map((contact) => (
          <div
            key={contact.phoneNumber}
            className={`flex items-start p-4 cursor-pointer hover:bg-gray-100 ${
              activeContact?.phoneNumber === contact.phoneNumber ? 'bg-gray-100' : ''
            }`}
            onClick={() => onSelectContact(contact)}
          >
            <div className="w-12 h-12 flex-shrink-0 bg-gray-300 rounded-full flex items-center justify-center text-white text-lg">
              {contact.phoneNumber[0]}
            </div>
            <div className="ml-4 flex-1 min-w-0">
              <div className="flex justify-between items-start gap-2">
                <span className="font-medium truncate">{contact.phoneNumber}</span>
                <div className="flex items-center gap-2">
                  {contact.status && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        contact.status === 'open'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {contact.status}
                    </span>
                  )}
                  <span className="text-sm text-gray-500 flex-shrink-0">
                    {formatTimestamp(contact.lastTimestamp)}
                  </span>
                </div>
              </div>
              <div className="text-sm text-gray-500 truncate max-w-full">
                {contact.lastMessage}
              </div>
              {contact.tags && contact.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {contact.tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-0.5 text-xs bg-gray-100 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;
