import { useState, useEffect } from 'react';
import { Contact } from '../types';
import { getContacts } from '../services/firebase';
import NavSidebar from '../components/NavSidebar';
import { formatTimestamp } from '../services/firebase';
import { Search } from 'lucide-react';

const Contacts = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const fetchedContacts = await getContacts();
        setContacts(fetchedContacts);
      } catch (error) {
        console.error('Error fetching contacts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchContacts();
  }, []);

  const filteredContacts = contacts.filter(contact =>
    (contact.contactName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    contact.phoneNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-screen">
      <NavSidebar />
      <div className="flex-1 overflow-auto ml-20">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-semibold text-gray-800">Contacts</h1>
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
          </div>

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
                    <tr key={contact.phoneNumber} className="hover:bg-gray-50">
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
                              className="px-2 py-0.5 text-xs bg-[#e6f3f8] text-[#09659c] rounded-full"
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
  );
};

export default Contacts; 