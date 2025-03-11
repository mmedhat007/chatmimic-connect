import { useState, useEffect } from 'react';
import { Contact } from '../types';
import { getContacts } from '../services/firebase';
import NavSidebar from '../components/NavSidebar';
import { formatTimestamp } from '../services/firebase';
import { Search, Filter, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface FilterState {
  status: string[];
  tags: string[];
  dateRange: {
    start: string;
    end: string;
  };
}

const Contacts = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    status: [],
    tags: [],
    dateRange: {
      start: '',
      end: ''
    }
  });
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = getContacts((fetchedContacts) => {
      setContacts(fetchedContacts);
      
      // Extract unique tags for filtering only
      const tags = new Set<string>();
      fetchedContacts.forEach(contact => {
        contact.tags?.forEach(tag => tags.add(tag));
      });
      setAvailableTags(Array.from(tags));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const toggleFilter = (type: 'status' | 'tags', value: string) => {
    setFilters(prev => ({
      ...prev,
      [type]: prev[type].includes(value)
        ? prev[type].filter(item => item !== value)
        : [...prev[type], value]
    }));
  };

  const clearFilters = () => {
    setFilters({
      status: [],
      tags: [],
      dateRange: {
        start: '',
        end: ''
      }
    });
  };

  const handleContactClick = (contact: Contact) => {
    navigate('/', { state: { selectedContact: contact } });
  };

  const filteredContacts = contacts
    .sort((a, b) => b.lastTimestamp - a.lastTimestamp)
    .filter(contact => {
      const matchesSearch = 
        (contact.contactName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        contact.phoneNumber.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = 
        filters.status.length === 0 || 
        (contact.status && filters.status.includes(contact.status));

      const matchesTags = 
        filters.tags.length === 0 ||
        filters.tags.every(tag => contact.tags?.includes(tag));

      const matchesDateRange = () => {
        if (!filters.dateRange.start && !filters.dateRange.end) return true;
        
        const contactDate = new Date(contact.lastTimestamp);
        const start = filters.dateRange.start ? new Date(filters.dateRange.start) : null;
        const end = filters.dateRange.end ? new Date(filters.dateRange.end) : null;
        
        if (start && end) {
          return contactDate >= start && contactDate <= end;
        } else if (start) {
          return contactDate >= start;
        } else if (end) {
          return contactDate <= end;
        }
        
        return true;
      };

      return matchesSearch && matchesStatus && matchesTags && matchesDateRange();
    });

  return (
    <div className="flex h-screen">
      <NavSidebar />
      <div className="flex-1 overflow-auto ml-20">
        <div className="p-6">
          <div className="flex flex-col space-y-4">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-semibold text-gray-800">Contacts</h1>
              <div className="flex items-center space-x-4">
                <div className="w-64 relative">
                  <input
                    type="text"
                    placeholder="Search contacts..."
                    className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#09659c]"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-2 rounded-lg transition-colors ${
                    showFilters ? 'bg-[#09659c] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Filter className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Filters Section */}
            {showFilters && (
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-sm font-medium text-gray-700">Filters</h2>
                  <button
                    onClick={clearFilters}
                    className="text-sm text-gray-500 hover:text-gray-700 flex items-center space-x-1"
                  >
                    <X className="h-4 w-4" />
                    <span>Clear all</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Status Filter */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">
                      Status
                    </label>
                    <div className="space-y-2">
                      {['open', 'closed'].map(status => (
                        <label key={status} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={filters.status.includes(status)}
                            onChange={() => toggleFilter('status', status)}
                            className="rounded border-gray-300 text-[#09659c] focus:ring-[#09659c]"
                          />
                          <span className="text-sm text-gray-600 capitalize">{status}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Tags Filter */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">
                      Filter by Tags
                    </label>
                    <div className="space-y-2">
                      {availableTags.map(tag => (
                        <label key={tag} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={filters.tags.includes(tag)}
                            onChange={() => toggleFilter('tags', tag)}
                            className="rounded border-gray-300 text-[#09659c] focus:ring-[#09659c]"
                          />
                          <span className="text-sm text-gray-600">{tag}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Date Range Filter */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">
                      Last Interaction Date
                    </label>
                    <div className="space-y-2">
                      <input
                        type="date"
                        value={filters.dateRange.start}
                        onChange={(e) => setFilters(prev => ({
                          ...prev,
                          dateRange: { ...prev.dateRange, start: e.target.value }
                        }))}
                        className="block w-full text-sm border-gray-300 rounded-md focus:ring-[#09659c] focus:border-[#09659c]"
                      />
                      <input
                        type="date"
                        value={filters.dateRange.end}
                        onChange={(e) => setFilters(prev => ({
                          ...prev,
                          dateRange: { ...prev.dateRange, end: e.target.value }
                        }))}
                        className="block w-full text-sm border-gray-300 rounded-md focus:ring-[#09659c] focus:border-[#09659c]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Table Section */}
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#09659c] mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading contacts...</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Phone Number
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Interaction
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tags
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredContacts.map((contact) => (
                      <tr 
                        key={contact.phoneNumber} 
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => handleContactClick(contact)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 flex-shrink-0 bg-[#09659c] rounded-full flex items-center justify-center text-white">
                              {(contact.contactName?.[0] || contact.phoneNumber[0]).toUpperCase()}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {contact.contactName || 'No Name'}
                              </div>
                              <div className="text-sm text-gray-500 truncate max-w-xs">
                                {contact.lastMessage}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {contact.phoneNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatTimestamp(contact.lastTimestamp)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs rounded-full font-medium ${
                              contact.status === 'open'
                                ? 'bg-[#e6f3f8] text-[#09659c]'
                                : contact.status === 'closed'
                                ? 'bg-gray-100 text-gray-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {contact.status || 'No Status'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-wrap gap-1">
                            {contact.tags?.map((tag) => (
                              <span
                                key={tag}
                                className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contacts; 