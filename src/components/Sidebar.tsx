import React, { useState, useEffect, useRef } from 'react';
import { Contact } from '../types';
import { Search, Filter } from 'lucide-react';
import { formatTimestamp, deleteContact } from '../services/firebase';
import { useToast } from '../hooks/use-toast';
import ContactContextMenu from './ContactContextMenu';
import ConfirmationDialog from './ui/ConfirmationDialog';

interface SidebarProps {
  contacts: Contact[];
  activeContact: Contact | null;
  onSelectContact: (contact: Contact) => void;
  onDeleteContact: (phoneNumber: string) => void;
  lifecycleFilter?: string | null;
}

// Helper function to get lifecycle color class based on lifecycle value
const getLifecycleColorClass = (lifecycle?: string) => {
  if (!lifecycle) return '';
  
  // First try direct match
  switch (lifecycle.toLowerCase()) {
    case 'new_lead': return 'bg-blue-100 text-blue-800';
    case 'vip_lead': return 'bg-indigo-100 text-indigo-800';
    case 'hot_lead': return 'bg-orange-100 text-orange-800';
    case 'payment': return 'bg-yellow-100 text-yellow-800';
    case 'customer': return 'bg-green-100 text-green-800';
    case 'cold_lead': return 'bg-red-100 text-red-800';
  }
  
  // Then try normalized match (for values with spaces instead of underscores)
  const normalized = lifecycle.toLowerCase().replace(/\s+/g, '_');
  switch (normalized) {
    case 'new_lead': return 'bg-blue-100 text-blue-800';
    case 'vip_lead': return 'bg-indigo-100 text-indigo-800';
    case 'hot_lead': return 'bg-orange-100 text-orange-800';
    case 'payment': return 'bg-yellow-100 text-yellow-800';
    case 'customer': return 'bg-green-100 text-green-800';
    case 'cold_lead': return 'bg-red-100 text-red-800';
  }
  
  // Finally try matching without separators
  const noSeparator = lifecycle.toLowerCase().replace(/[_\s]/g, '');
  switch (noSeparator) {
    case 'newlead': return 'bg-blue-100 text-blue-800';
    case 'viplead': return 'bg-indigo-100 text-indigo-800';
    case 'hotlead': return 'bg-orange-100 text-orange-800';
    case 'payment': return 'bg-yellow-100 text-yellow-800';
    case 'customer': return 'bg-green-100 text-green-800';
    case 'coldlead': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

// Helper function to get lifecycle display name based on lifecycle value
const getLifecycleDisplayName = (lifecycle?: string) => {
  if (!lifecycle) return '';
  
  // First try direct match
  switch (lifecycle.toLowerCase()) {
    case 'new_lead': return 'New';
    case 'vip_lead': return 'VIP';
    case 'hot_lead': return 'Hot';
    case 'payment': return 'Payment';
    case 'customer': return 'Customer';
    case 'cold_lead': return 'Cold';
  }
  
  // Then try normalized match
  const normalized = lifecycle.toLowerCase().replace(/\s+/g, '_');
  switch (normalized) {
    case 'new_lead': return 'New';
    case 'vip_lead': return 'VIP';
    case 'hot_lead': return 'Hot';
    case 'payment': return 'Payment';
    case 'customer': return 'Customer';
    case 'cold_lead': return 'Cold';
  }
  
  // Finally try matching without separators
  const noSeparator = lifecycle.toLowerCase().replace(/[_\s]/g, '');
  switch (noSeparator) {
    case 'newlead': return 'New';
    case 'viplead': return 'VIP';
    case 'hotlead': return 'Hot';
    case 'payment': return 'Payment';
    case 'customer': return 'Customer';
    case 'coldlead': return 'Cold';
    default: return lifecycle.charAt(0).toUpperCase() + lifecycle.slice(1);
  }
};

const Sidebar = ({ contacts, activeContact, onSelectContact, onDeleteContact, lifecycleFilter }: SidebarProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'open' | 'closed'>('all');
  const { toast } = useToast();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; phoneNumber: string } | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<string | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Effect to handle clicks outside the context menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };
    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [contextMenu]);

  // Filter contacts without re-sorting
  const filteredContacts = contacts
    .filter(contact => {
      const matchesSearch = 
        contact.phoneNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (contact.contactName && contact.contactName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        contact.lastMessage.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = selectedStatus === 'all' || contact.status === selectedStatus;
      
      return matchesSearch && matchesStatus;
    });

  // Get the name of the current lifecycle filter
  const getLifecycleFilterName = () => {
    if (!lifecycleFilter) return null;
    switch (lifecycleFilter) {
      case 'new_lead': return 'New Lead';
      case 'vip_lead': return 'VIP Lead';
      case 'hot_lead': return 'Hot Lead';
      case 'payment': return 'Payment';
      case 'customer': return 'Customer';
      case 'cold_lead': return 'Cold Lead';
      default: return lifecycleFilter;
    }
  };

  // Handle right-click for context menu
  const handleContextMenu = (event: React.MouseEvent, phoneNumber: string) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      phoneNumber: phoneNumber,
    });
  };
  
  // Close context menu
  const closeContextMenu = () => {
    setContextMenu(null);
  };

  // Initiate deletion process (show confirmation)
  const handleDeleteRequest = (phoneNumber: string) => {
    setContactToDelete(phoneNumber);
    setShowConfirmDialog(true);
    closeContextMenu();
  };

  // Confirm deletion (called by modal)
  const confirmDelete = async () => {
    if (!contactToDelete) return;
    
    try {
      await deleteContact(contactToDelete);
      toast({
        title: "Contact Deleted",
        description: `${contactToDelete} has been removed.`,
      });
      onDeleteContact(contactToDelete); // Notify parent component
    } catch (error) {
      console.error("Error deleting contact:", error);
      toast({
        title: "Error",
        description: `Failed to delete contact ${contactToDelete}.`,
        variant: "destructive",
      });
    } finally {
      setShowConfirmDialog(false);
      setContactToDelete(null);
    }
  };

  const lifecycleFilterName = getLifecycleFilterName();

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

      {/* Active Filter Badge */}
      {lifecycleFilterName && (
        <div className="px-4 py-2 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">Filter: {lifecycleFilterName}</span>
          </div>
        </div>
      )}

      {/* Filters Section */}
      <div className="p-4 border-b flex-shrink-0">
        {/* Status Filter */}
        <div className="flex gap-2">
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
      </div>

      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto">
        {filteredContacts.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <p>No contacts found</p>
            {lifecycleFilterName && (
              <p className="mt-2 text-sm">Try clearing the {lifecycleFilterName} filter</p>
            )}
          </div>
        ) : (
          filteredContacts.map((contact) => (
            <div
              key={contact.phoneNumber}
              className={`flex items-start p-4 cursor-pointer hover:bg-gray-100 group relative ${
                activeContact?.phoneNumber === contact.phoneNumber ? 'bg-gray-100' : ''
              }`}
              onClick={() => onSelectContact(contact)}
              onContextMenu={(e) => handleContextMenu(e, contact.phoneNumber)}
            >
              <div 
                className="w-12 h-12 flex-shrink-0 bg-gray-300 rounded-full flex items-center justify-center text-white text-lg"
              >
                {contact.phoneNumber[0]}
              </div>
              <div className="ml-4 flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2">
                  <span className="font-medium truncate">
                    {contact.contactName || contact.phoneNumber}
                  </span>
                  <div className="flex items-center gap-2">
                    {/* Lifecycle Badge */}
                    {contact.lifecycle && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getLifecycleColorClass(contact.lifecycle)}`}>
                        {getLifecycleDisplayName(contact.lifecycle)}
                      </span>
                    )}
                    
                    {/* Agent Status */}
                    {(contact.humanAgent || contact.agentStatus === 'on') && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          contact.humanAgent
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {contact.humanAgent ? 'Human' : 'AI'}
                      </span>
                    )}
                    
                    {/* Chat Status */}
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
                      {formatTimestamp(contact.lastMessageTime)}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-end mt-1">
                  <p className="text-sm text-gray-500 truncate pr-4">
                    {contact.lastMessage}
                  </p>
                </div>
                {contact.tags && contact.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {contact.tags.map(tag => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Render Context Menu */}
      {contextMenu && (
        <ContactContextMenu
          ref={contextMenuRef}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
          onDelete={() => handleDeleteRequest(contextMenu.phoneNumber)}
        />
      )}

      {/* Render Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={confirmDelete}
        title="Delete Contact?"
        description={`Are you sure you want to delete contact ${contactToDelete}? This action cannot be undone.`}
      />
    </div>
  );
};

export default Sidebar;
