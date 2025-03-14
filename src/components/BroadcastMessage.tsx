import { useState, useEffect } from 'react';
import { doc, getDoc, collection, getDocs, addDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db, getCurrentUser } from '../services/firebase';
import { useToast } from '../hooks/use-toast';
import * as XLSX from 'xlsx';
import { Send, Plus, AlertCircle } from 'lucide-react';

interface Contact {
  phoneNumber: string;
  contactName?: string;
  tags?: string[];
}

interface ImportedContact {
  phoneNumber: string;
  name?: string;
  tags?: string;
}

interface Template {
  id: string;
  name: string;
  category: 'UTILITY' | 'AUTHENTICATION' | 'MARKETING';
  language: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  components: {
    type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
    text?: string;
    format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';
    mediaUrl?: string;
    buttons?: Array<{
      type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
      text: string;
      url?: string;
      phone_number?: string;
    }>;
  }[];
  rejectionReason?: string;
}

const BroadcastMessage = () => {
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [newTemplate, setNewTemplate] = useState<Partial<Template>>({
    category: 'UTILITY',
    language: 'en',
    components: [
      { type: 'BODY', text: '' }
    ]
  });

  useEffect(() => {
    fetchTagsAndContacts();
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const userUID = getCurrentUser();
    if (!userUID) return;

    try {
      const templatesRef = collection(db, 'Whatsapp_Data', userUID, 'templates');
      const templatesSnapshot = await getDocs(templatesRef);
      const templatesList = templatesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || '',
          category: data.category || 'UTILITY',
          language: data.language || 'en',
          status: data.status || 'PENDING',
          components: Array.isArray(data.components) ? data.components : [{ type: 'BODY', text: '' }],
          rejectionReason: data.rejectionReason
        } as Template;
      });
      
      setTemplates(templatesList);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: "Error",
        description: "Failed to load message templates",
        variant: "destructive",
      });
    }
  };

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template);
    // Extract variables from template text ({{1}}, {{2}}, etc.)
    const variables: Record<string, string> = {};
    template.components.forEach(component => {
      if (component.text) {
        const matches = component.text.match(/{{[1-9][0-9]*}}/g);
        matches?.forEach(match => {
          const varNum = match.replace(/[{}]/g, '');
          variables[varNum] = '';
        });
      }
    });
    setTemplateVariables(variables);
  };

  const validateTemplate = (template: Partial<Template>): string[] => {
    const errors: string[] = [];
    
    if (!template.name?.trim()) {
      errors.push('Template name is required');
    }

    if (!template.category) {
      errors.push('Template category is required');
    }

    if (!template.language) {
      errors.push('Template language is required');
    }

    template.components?.forEach(component => {
      if (component.type === 'HEADER' && component.text && component.text.length > 60) {
        errors.push('Header text must not exceed 60 characters');
      }
      if (component.type === 'BODY' && component.text && component.text.length > 1024) {
        errors.push('Body text must not exceed 1024 characters');
      }
      if (component.type === 'FOOTER' && component.text && component.text.length > 60) {
        errors.push('Footer text must not exceed 60 characters');
      }
      if (component.type === 'BUTTONS' && component.buttons) {
        component.buttons.forEach(button => {
          if (button.text.length > 20) {
            errors.push('Button text must not exceed 20 characters');
          }
        });
        if (component.buttons.length > 3) {
          errors.push('Maximum 3 buttons allowed');
        }
      }
    });

    return errors;
  };

  const handleCreateTemplate = async () => {
    const errors = validateTemplate(newTemplate);
    if (errors.length > 0) {
      toast({
        title: "Validation Error",
        description: errors.join('\n'),
        variant: "destructive",
      });
      return;
    }

    const userUID = getCurrentUser();
    if (!userUID) return;

    try {
      const templatesRef = collection(db, 'Whatsapp_Data', userUID, 'templates');
      await addDoc(templatesRef, {
        ...newTemplate,
        status: 'PENDING',
        createdAt: new Date()
      });

      toast({
        title: "Success",
        description: "Template submitted for approval",
      });

      setShowTemplateForm(false);
      setNewTemplate({
        category: 'UTILITY',
        language: 'en',
        components: [
          { type: 'BODY', text: '' }
        ]
      });
      fetchTemplates();
    } catch (error) {
      console.error('Error creating template:', error);
      toast({
        title: "Error",
        description: "Failed to create template",
        variant: "destructive",
      });
    }
  };

  const fetchTagsAndContacts = async () => {
    const userUID = getCurrentUser();
    if (!userUID) return;

    try {
      const chatsRef = collection(db, 'Whatsapp_Data', userUID, 'chats');
      const chatsSnapshot = await getDocs(chatsRef);
      
      const allTags = new Set<string>();
      const contactsList: Contact[] = [];

      chatsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.tags) {
          data.tags.forEach((tag: string) => allTags.add(tag));
        }
        if (doc.id !== 'system') {
          contactsList.push({
            phoneNumber: doc.id,
            contactName: data.contactName,
            tags: data.tags || []
          });
        }
      });

      setAvailableTags(Array.from(allTags));
      setContacts(contactsList);
    } catch (error) {
      console.error('Error fetching tags and contacts:', error);
      toast({
        title: "Error",
        description: "Failed to load contacts and tags",
        variant: "destructive",
      });
    }
  };

  const handleTagSelect = (tag: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag);
      }
      return [...prev, tag];
    });
  };

  const handleContactSelect = (phoneNumber: string) => {
    setSelectedContacts(prev => {
      if (prev.includes(phoneNumber)) {
        return prev.filter(p => p !== phoneNumber);
      }
      return [...prev, phoneNumber];
    });
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<ImportedContact>(worksheet);

      const userUID = getCurrentUser();
      if (!userUID) throw new Error('User not found');

      // Process each contact
      const processedContacts: Contact[] = [];
      const newContacts: Contact[] = [];
      
      for (const row of jsonData) {
        // Format phone number
        let phoneNumber = row.phoneNumber.toString().trim();
        if (!phoneNumber.startsWith('+')) {
          phoneNumber = '+' + phoneNumber;
        }

        // Process tags
        const tags = row.tags?.split(',').map(tag => tag.trim()).filter(Boolean) || [];

        const contact: Contact = {
          phoneNumber,
          contactName: row.name,
          tags
        };

        processedContacts.push(contact);

        // Check if contact already exists
        const existingContact = contacts.find(c => c.phoneNumber === phoneNumber);
        if (!existingContact) {
          newContacts.push(contact);
        }
      }

      // Add new contacts to Firestore
      for (const contact of newContacts) {
        const chatRef = doc(db, 'Whatsapp_Data', userUID, 'chats', contact.phoneNumber);
        await setDoc(chatRef, {
          phoneNumber: contact.phoneNumber,
          contactName: contact.contactName,
          tags: contact.tags,
          createdAt: new Date(),
          lastMessage: '',
          lastMessageTime: new Date(),
          lastMessageSender: 'system',
          status: 'open'
        });
      }

      // Update contacts list and available tags
      const updatedContacts = [...contacts];
      const updatedTags = new Set(availableTags);

      for (const contact of processedContacts) {
        const existingIndex = updatedContacts.findIndex(c => c.phoneNumber === contact.phoneNumber);
        if (existingIndex >= 0) {
          updatedContacts[existingIndex] = contact;
        } else {
          updatedContacts.push(contact);
        }

        contact.tags?.forEach(tag => updatedTags.add(tag));
      }

      setContacts(updatedContacts);
      setAvailableTags(Array.from(updatedTags));

      toast({
        title: "Success",
        description: `Imported ${newContacts.length} new contacts and updated ${processedContacts.length - newContacts.length} existing contacts.`,
      });

      // Reset file input
      event.target.value = '';
    } catch (error) {
      console.error('Error importing contacts:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to import contacts",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const sendBroadcastMessage = async () => {
    if (!selectedTemplate) {
      toast({
        title: "Error",
        description: "Please select a message template",
        variant: "destructive",
      });
      return;
    }

    const userUID = getCurrentUser();
    if (!userUID) return;

    setIsSending(true);
    try {
      // Get user's WhatsApp credentials
      const userRef = doc(db, 'Users', userUID);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        throw new Error('User document not found');
      }

      const userData = userDoc.data();
      const whatsappCredentials = userData.credentials?.whatsappCredentials;
      
      if (!whatsappCredentials?.access_token || !whatsappCredentials?.phone_number_id) {
        throw new Error('WhatsApp credentials not found');
      }

      // Filter contacts based on selected tags and contacts
      const targetContacts = contacts.filter(contact => {
        if (selectedContacts.includes(contact.phoneNumber)) return true;
        if (selectedTags.length === 0) return false;
        return contact.tags?.some(tag => selectedTags.includes(tag));
      });

      if (targetContacts.length === 0) {
        throw new Error('No contacts selected');
      }

      // Send message to each contact using the selected template
      const timestamp = new Date();
      const results = await Promise.all(targetContacts.map(async contact => {
        try {
          const formattedPhoneNumber = contact.phoneNumber.startsWith('+') 
            ? contact.phoneNumber 
            : `+${contact.phoneNumber}`;

          // Prepare template message payload
          const messageData = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: formattedPhoneNumber,
            type: "template",
            template: {
              name: selectedTemplate.name,
              language: {
                code: selectedTemplate.language
              },
              components: selectedTemplate.components.map(component => ({
                type: component.type,
                parameters: Object.entries(templateVariables).map(([key, value]) => ({
                  type: "text",
                  text: value
                }))
              }))
            }
          };

          // Send message through WhatsApp API
          const response = await fetch(`https://graph.facebook.com/v17.0/${whatsappCredentials.phone_number_id}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${whatsappCredentials.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(messageData)
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Failed to send message');
          }

          // Add message to Firestore
          const messagesRef = collection(db, 'Whatsapp_Data', userUID, 'chats', contact.phoneNumber, 'messages');
          await addDoc(messagesRef, {
            message: selectedTemplate.components.find(c => c.type === 'BODY')?.text || '',
            timestamp,
            sender: 'human',
            date: timestamp.toLocaleDateString(),
            template: selectedTemplate.name
          });

          // Update chat's last message
          const chatRef = doc(db, 'Whatsapp_Data', userUID, 'chats', contact.phoneNumber);
          await updateDoc(chatRef, {
            lastMessage: selectedTemplate.components.find(c => c.type === 'BODY')?.text || '',
            lastMessageTime: timestamp,
            lastMessageSender: 'human'
          });

          return { success: true, phoneNumber: contact.phoneNumber };
        } catch (error) {
          console.error(`Error sending to ${contact.phoneNumber}:`, error);
          return { 
            success: false, 
            phoneNumber: contact.phoneNumber, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
      }));

      // Show results
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      if (failed > 0) {
        toast({
          title: "Partial Success",
          description: `Message sent to ${successful} contacts, failed for ${failed} contacts.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: `Message sent to ${successful} contacts.`,
        });
      }

      // Clear form
      setSelectedTemplate(null);
      setTemplateVariables({});
      setSelectedTags([]);
      setSelectedContacts([]);
    } catch (error) {
      console.error('Error sending broadcast:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send broadcast message",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-medium mb-4">Send Broadcast Message</h2>
      
      {/* Import Contacts Section */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-medium mb-2">Import Contacts</h3>
        <p className="text-xs text-gray-600 mb-3">
          Import contacts from CSV or Excel file. File should have columns: phoneNumber (required), name (optional), tags (optional, comma-separated)
        </p>
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileImport}
          disabled={isImporting}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-full file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100
            disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {isImporting && (
          <p className="text-sm text-blue-600 mt-2">Importing contacts...</p>
        )}
      </div>

      {/* Template Selection */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium">Select Message Template</label>
          <button
            onClick={() => setShowTemplateForm(true)}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <Plus size={16} />
            Create New Template
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {templates.map(template => (
            <button
              key={template.id}
              onClick={() => handleTemplateSelect(template)}
              className={`p-3 border rounded-lg text-left hover:bg-gray-50 transition-colors ${
                selectedTemplate?.id === template.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{template.name}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  template.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                  template.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {template.status}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {template.components?.find(c => c.type === 'BODY')?.text || 'No body content'}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs px-2 py-1 bg-gray-100 rounded-full">
                  {template.category}
                </span>
                <span className="text-xs px-2 py-1 bg-gray-100 rounded-full">
                  {template.language}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Template Variables */}
      {selectedTemplate && Object.keys(templateVariables).length > 0 && (
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Template Variables</label>
          <div className="space-y-3">
            {Object.entries(templateVariables).map(([key, value]) => (
              <div key={key}>
                <label className="block text-xs text-gray-600 mb-1">
                  Variable {key}
                </label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setTemplateVariables(prev => ({
                    ...prev,
                    [key]: e.target.value
                  }))}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={`Enter value for {{${key}}}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tags Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Filter by Tags</label>
        <div className="flex flex-wrap gap-2">
          {availableTags.map(tag => (
            <button
              key={tag}
              onClick={() => handleTagSelect(tag)}
              className={`px-3 py-1 rounded-full text-sm ${
                selectedTags.includes(tag)
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Contacts List */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Select Contacts</label>
        <div className="max-h-60 overflow-y-auto border rounded-md">
          {contacts.map(contact => (
            <div
              key={contact.phoneNumber}
              className={`flex items-center p-3 hover:bg-gray-50 cursor-pointer ${
                selectedContacts.includes(contact.phoneNumber) ? 'bg-blue-50' : ''
              }`}
              onClick={() => handleContactSelect(contact.phoneNumber)}
            >
              <input
                type="checkbox"
                checked={selectedContacts.includes(contact.phoneNumber)}
                onChange={() => {}}
                className="h-4 w-4 text-blue-600 rounded border-gray-300"
              />
              <div className="ml-3">
                <p className="text-sm font-medium">{contact.contactName || contact.phoneNumber}</p>
                {contact.tags && contact.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {contact.tags.map(tag => (
                      <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
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

      {/* Send Button */}
      <button
        onClick={sendBroadcastMessage}
        disabled={isSending || !selectedTemplate || (selectedContacts.length === 0 && selectedTags.length === 0)}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isSending ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            Sending...
          </>
        ) : (
          <>
            <Send size={16} />
            Send Broadcast Message
          </>
        )}
      </button>

      {/* Template Creation Modal */}
      {showTemplateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium mb-4">Create New Template</h3>
            
            <div className="space-y-4">
              {/* Template Name */}
              <div>
                <label className="block text-sm font-medium mb-1">Template Name</label>
                <input
                  type="text"
                  value={newTemplate.name || ''}
                  onChange={(e) => setNewTemplate(prev => ({
                    ...prev,
                    name: e.target.value
                  }))}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="e.g., order_confirmation"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  value={newTemplate.category}
                  onChange={(e) => setNewTemplate(prev => ({
                    ...prev,
                    category: e.target.value as Template['category']
                  }))}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="UTILITY">Utility</option>
                  <option value="AUTHENTICATION">Authentication</option>
                  <option value="MARKETING">Marketing</option>
                </select>
              </div>

              {/* Language */}
              <div>
                <label className="block text-sm font-medium mb-1">Language</label>
                <select
                  value={newTemplate.language}
                  onChange={(e) => setNewTemplate(prev => ({
                    ...prev,
                    language: e.target.value
                  }))}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="pt_BR">Portuguese (Brazil)</option>
                  <option value="ar">Arabic</option>
                  {/* Add more languages as needed */}
                </select>
              </div>

              {/* Components */}
              <div>
                <label className="block text-sm font-medium mb-2">Components</label>
                <div className="space-y-4">
                  {newTemplate.components?.map((component, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <select
                          value={component.type}
                          onChange={(e) => {
                            const components = [...(newTemplate.components || [])];
                            components[index] = {
                              ...components[index],
                              type: e.target.value as Template['components'][0]['type']
                            };
                            setNewTemplate(prev => ({
                              ...prev,
                              components
                            }));
                          }}
                          className="px-2 py-1 border rounded"
                        >
                          <option value="HEADER">Header</option>
                          <option value="BODY">Body</option>
                          <option value="FOOTER">Footer</option>
                          <option value="BUTTONS">Buttons</option>
                        </select>
                        <button
                          onClick={() => {
                            const components = newTemplate.components?.filter((_, i) => i !== index);
                            setNewTemplate(prev => ({
                              ...prev,
                              components
                            }));
                          }}
                          className="text-red-600 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>

                      {component.type === 'BUTTONS' ? (
                        <div className="space-y-2">
                          {component.buttons?.map((button, buttonIndex) => (
                            <div key={buttonIndex} className="flex gap-2">
                              <input
                                type="text"
                                value={button.text}
                                onChange={(e) => {
                                  const components = [...(newTemplate.components || [])];
                                  const buttons = [...(components[index].buttons || [])];
                                  buttons[buttonIndex] = {
                                    ...buttons[buttonIndex],
                                    text: e.target.value
                                  };
                                  components[index] = {
                                    ...components[index],
                                    buttons
                                  };
                                  setNewTemplate(prev => ({
                                    ...prev,
                                    components
                                  }));
                                }}
                                className="flex-1 px-3 py-2 border rounded-md"
                                placeholder="Button text"
                              />
                              <select
                                value={button.type}
                                onChange={(e) => {
                                  const components = [...(newTemplate.components || [])];
                                  const buttons = [...(components[index].buttons || [])];
                                  buttons[buttonIndex] = {
                                    ...buttons[buttonIndex],
                                    type: e.target.value as Template['components'][0]['buttons'][0]['type']
                                  };
                                  components[index] = {
                                    ...components[index],
                                    buttons
                                  };
                                  setNewTemplate(prev => ({
                                    ...prev,
                                    components
                                  }));
                                }}
                                className="px-2 py-1 border rounded"
                              >
                                <option value="QUICK_REPLY">Quick Reply</option>
                                <option value="URL">URL</option>
                                <option value="PHONE_NUMBER">Phone Number</option>
                              </select>
                            </div>
                          ))}
                          {(!component.buttons || component.buttons.length < 3) && (
                            <button
                              onClick={() => {
                                const components = [...(newTemplate.components || [])];
                                const buttons = [...(components[index].buttons || [])];
                                buttons.push({
                                  type: 'QUICK_REPLY',
                                  text: ''
                                });
                                components[index] = {
                                  ...components[index],
                                  buttons
                                };
                                setNewTemplate(prev => ({
                                  ...prev,
                                  components
                                }));
                              }}
                              className="text-blue-600 hover:text-blue-700 text-sm"
                            >
                              Add Button
                            </button>
                          )}
                        </div>
                      ) : (
                        <textarea
                          value={component.text || ''}
                          onChange={(e) => {
                            const components = [...(newTemplate.components || [])];
                            components[index] = {
                              ...components[index],
                              text: e.target.value
                            };
                            setNewTemplate(prev => ({
                              ...prev,
                              components
                            }));
                          }}
                          className="w-full px-3 py-2 border rounded-md"
                          placeholder={`Enter ${component.type.toLowerCase()} text...`}
                          rows={3}
                        />
                      )}

                      {/* Character count and limit warning */}
                      {component.text && (
                        <div className="mt-1 flex items-center justify-between text-xs">
                          <span className="text-gray-500">
                            {component.text.length} characters
                          </span>
                          {(
                            (component.type === 'HEADER' && component.text.length > 60) ||
                            (component.type === 'BODY' && component.text.length > 1024) ||
                            (component.type === 'FOOTER' && component.text.length > 60)
                          ) && (
                            <span className="text-red-600 flex items-center gap-1">
                              <AlertCircle size={12} />
                              Exceeds limit
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      setNewTemplate(prev => ({
                        ...prev,
                        components: [
                          ...(prev.components || []),
                          { type: 'BODY', text: '' }
                        ]
                      }));
                    }}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    Add Component
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowTemplateForm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTemplate}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Create Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BroadcastMessage; 