import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import GoogleSheetsButton from '../components/GoogleSheetsButton';
import { getCurrentUser } from '../services/firebase';
import { doc, setDoc, collection, addDoc, getDocs, getDoc, updateDoc, query, orderBy, deleteDoc, writeBatch, collectionGroup } from 'firebase/firestore';
import { db } from '../services/firebase';
import NavSidebar from '../components/NavSidebar';
import JSZip from 'jszip';
import { getContacts } from '../services/firebase';
import { useToast } from "@/hooks/use-toast";

interface ChatFile {
  file: File;
  phoneNumber: string;
  content?: string;
}

interface Contact {
  phoneNumber: string;
  tags: string[];
}

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [importProgress, setImportProgress] = useState<string>('');
  const [exportProgress, setExportProgress] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<ChatFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Remove contacts and tag management related code
  useEffect(() => {
    setLoading(false);
  }, []);

  const handleAddTag = async (phoneNumber: string, tag: string) => {
    if (!tag.trim()) return;

    const userUID = getCurrentUser();
    if (!userUID) return;

    try {
      const chatRef = doc(db, 'Whatsapp_Data', userUID, 'chats', phoneNumber);
      const chatDoc = await getDoc(chatRef);
      
      if (chatDoc.exists()) {
        const currentTags = chatDoc.data().tags || [];
        if (!currentTags.includes(tag)) {
          await updateDoc(chatRef, {
            tags: [...currentTags, tag]
          });
        }
      }
    } catch (error) {
      console.error('Error adding tag:', error);
    }
  };

  const handleRemoveTag = async (phoneNumber: string, tagToRemove: string) => {
    const userUID = getCurrentUser();
    if (!userUID) return;

    try {
      const chatRef = doc(db, 'Whatsapp_Data', userUID, 'chats', phoneNumber);
      const chatDoc = await getDoc(chatRef);
      
      if (chatDoc.exists()) {
        const currentTags = chatDoc.data().tags || [];
        await updateDoc(chatRef, {
          tags: currentTags.filter(tag => tag !== tagToRemove)
        });
      }
    } catch (error) {
      console.error('Error removing tag:', error);
    }
  };

  const extractPhoneNumber = (filename: string): string => {
    const match = filename.match(/WhatsApp Chat with \+(\d+)/);
    return match ? match[1] : '';
  };

  const processTextFile = async (file: File): Promise<ChatFile | null> => {
    try {
      const text = await file.text();
      return {
        file,
        phoneNumber: extractPhoneNumber(file.name),
        content: text
      };
    } catch (error) {
      console.error('Error processing text file:', error);
      return null;
    }
  };

  const processZipFile = async (file: File): Promise<ChatFile[]> => {
    try {
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(file);
      const chatFiles: ChatFile[] = [];

      for (const [filename, content] of Object.entries(zipContent.files)) {
        if (filename.endsWith('.txt')) {
          const text = await content.async('text');
          chatFiles.push({
            file: new File([text], filename, { type: 'text/plain' }),
            phoneNumber: extractPhoneNumber(filename),
            content: text
          });
        }
      }

      return chatFiles;
    } catch (error) {
      console.error('Error processing zip file:', error);
      return [];
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setImportProgress('Processing files...');
    const processedFiles: ChatFile[] = [];

    for (const file of Array.from(files)) {
      if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
        const zipFiles = await processZipFile(file);
        processedFiles.push(...zipFiles);
      } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        const processedFile = await processTextFile(file);
        if (processedFile) {
          processedFiles.push(processedFile);
        }
      }
    }

    setSelectedFiles(processedFiles);
    setImportProgress(`Selected ${processedFiles.length} file(s) for import`);
  };

  const parseWhatsAppTimestamp = (fullTimestamp: string): Date => {
    // Format: "DD/MM/YYYY, H:mm am/pm"
    const [datePart, timePart] = fullTimestamp.split(', ');
    const [day, month, year] = datePart.split('/').map(num => parseInt(num));
    const [time, period] = timePart.split(' ');
    const [hours, minutes] = time.split(':').map(num => parseInt(num));
    
    // Convert to 24-hour format
    let hour = hours;
    if (period.toLowerCase() === 'pm' && hour !== 12) {
      hour += 12;
    } else if (period.toLowerCase() === 'am' && hour === 12) {
      hour = 0;
    }

    return new Date(year, month - 1, day, hour, minutes);
  };

  const formatWhatsAppTimestamp = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    // Convert to 12-hour format with am/pm
    const period = hours >= 12 ? 'pm' : 'am';
    const hour12 = hours % 12 || 12;
    
    return `${day}/${month}/${year}, ${hour12}:${minutes} ${period}`;
  };

  const handleImport = async () => {
    if (selectedFiles.length === 0) return;

    setIsImporting(true);
    setImportProgress('Starting import...');

    const userUID = getCurrentUser();
    if (!userUID) {
      setImportProgress('Error: User not found');
      setIsImporting(false);
      return;
    }

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const { file, phoneNumber, content } = selectedFiles[i];
        setImportProgress(`Processing file ${i + 1} of ${selectedFiles.length}: ${file.name}`);

        if (!content) {
          setImportProgress(`Error: No content found in file ${i + 1}: ${file.name}`);
          continue;
        }

        const lines = content.split('\n').filter(line => line.trim() && !line.includes('undefined'));
        const messages = [];
        let latestMessageTimestamp = 0;

        for (const line of lines) {
          // Skip header lines and empty lines
          if (line.startsWith('WhatsApp Chat with') || !line.trim()) continue;

          // Match the WhatsApp format: DD/MM/YYYY, H:mm am/pm - Sender: Message
          const match = line.match(/^(\d{2}\/\d{2}\/\d{4}, \d{1,2}:\d{2} [ap]m) - ([^:]+): (.+)$/i);
          if (!match) continue;

          const [, timestamp, sender, messageContent] = match;

          try {
            const parsedTimestamp = parseWhatsAppTimestamp(timestamp);
            const messageTimestamp = parsedTimestamp.getTime();
            latestMessageTimestamp = Math.max(latestMessageTimestamp, messageTimestamp);
            
            // Determine the correct sender type
            let senderType;
            if (sender.toLowerCase().includes('ai agent')) {
              senderType = 'agent';
            } else if (sender.toLowerCase().includes('human agent')) {
              senderType = 'human';
            } else if (sender.toLowerCase() === 'you') {
              senderType = 'user';
            } else {
              senderType = 'agent'; // Default to agent for other senders
            }

            messages.push({
              timestamp: parsedTimestamp,
              sender: senderType,
              message: messageContent,
              date: timestamp.split(',')[0]
            });
          } catch (error) {
            console.error('Error parsing timestamp:', timestamp, error);
            continue;
          }
        }

        if (messages.length > 0) {
          // Create or update chat document using phone number as ID
          const chatRef = doc(db, 'Whatsapp_Data', userUID, 'chats', phoneNumber);
          
          // Get existing chat data to preserve tags and settings
          const existingChat = await getDoc(chatRef);
          const existingData = existingChat.exists() ? existingChat.data() : {};
          
          const lastMessage = messages[messages.length - 1];
          
          await setDoc(chatRef, {
            phoneNumber,
            lastMessage: lastMessage.message,
            lastMessageTime: lastMessage.timestamp,
            lastTimestamp: latestMessageTimestamp,
            createdAt: existingData.createdAt || messages[0].timestamp,
            tags: existingData.tags || [],
            agentStatus: existingData.agentStatus || 'on',
            humanAgent: existingData.humanAgent || false,
            status: existingData.status || 'open'
          }, { merge: true });

          // Delete existing messages before importing new ones
          const messagesRef = collection(db, 'Whatsapp_Data', userUID, 'chats', phoneNumber, 'messages');
          const existingMessages = await getDocs(messagesRef);
          const deletePromises = existingMessages.docs.map(doc => deleteDoc(doc.ref));
          await Promise.all(deletePromises);

          // Add new messages
          const addPromises = messages.map(msg => addDoc(messagesRef, {
            timestamp: msg.timestamp,
            sender: msg.sender,
            message: msg.message,
            date: msg.date
          }));
          await Promise.all(addPromises);

          setImportProgress(`Completed file ${i + 1} of ${selectedFiles.length}: ${file.name} (${messages.length} messages)`);
        } else {
          setImportProgress(`No messages found in file ${i + 1}: ${file.name}`);
        }
      }

      setImportProgress('Import completed successfully!');
      setSelectedFiles([]);
      
      // Force a refresh of the contacts list
      window.location.reload();
    } catch (error) {
      console.error('Error importing WhatsApp backup:', error);
      setImportProgress('Error importing backup: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsImporting(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress('Starting export...');

    const userUID = getCurrentUser();
    if (!userUID) {
      setExportProgress('Error: User not found');
      setIsExporting(false);
      return;
    }

    try {
      const zip = new JSZip();
      setExportProgress('Fetching contacts...');

      // Get all chats
      const chatsRef = collection(db, 'Whatsapp_Data', userUID, 'chats');
      const chatsSnapshot = await getDocs(chatsRef);
      
      for (const chatDoc of chatsSnapshot.docs) {
        const chatData = chatDoc.data();
        const phoneNumber = chatDoc.id;
        setExportProgress(`Processing chat with ${phoneNumber}...`);

        // Create a text file for this chat
        let chatContent = `WhatsApp Chat with +${phoneNumber}\n\n`;

        // Get all messages for this chat
        const messagesRef = collection(db, 'Whatsapp_Data', userUID, 'chats', phoneNumber, 'messages');
        const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'));
        const messagesSnapshot = await getDocs(messagesQuery);
        
        // Sort messages by timestamp
        const messages = messagesSnapshot.docs
          .map(doc => {
            const data = doc.data();
            let timestamp;
            
            // Handle Firestore timestamp
            if (data.timestamp?.seconds) {
              timestamp = new Date(data.timestamp.seconds * 1000);
            } else if (data.timestamp instanceof Date) {
              timestamp = data.timestamp;
            } else {
              timestamp = new Date(data.timestamp);
            }

            return {
              timestamp,
              sender: data.sender,
              message: data.message
            };
          })
          .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        // Format messages in WhatsApp style
        let currentDate = '';
        for (const msg of messages) {
          const formattedTimestamp = formatWhatsAppTimestamp(msg.timestamp);
          const sender = msg.sender === 'user' ? 'You' : msg.sender === 'human' ? 'Human Agent' : 'AI Agent';
          chatContent += `${formattedTimestamp} - ${sender}: ${msg.message}\n`;
        }

        // Add the chat file to the zip
        zip.file(`WhatsApp Chat with +${phoneNumber}.txt`, chatContent);
      }

      setExportProgress('Generating zip file...');
      
      // Generate and download the zip file
      const zipContent = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(zipContent);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'whatsapp_chats_backup.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setExportProgress('Export completed successfully!');
    } catch (error) {
      console.error('Error exporting WhatsApp backup:', error);
      setExportProgress('Error exporting backup: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteWhatsAppData = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast({
        title: "Error",
        description: "Please type 'DELETE' to confirm the account deletion",
        variant: "destructive",
      });
      return;
    }

    const userUID = getCurrentUser();
    if (!userUID) {
      toast({
        title: "Error",
        description: "User not found. Please try logging in again.",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    try {
      // 1. Delete WhatsApp credentials from Users collection
      const userRef = doc(db, 'Users', userUID);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        // Remove WhatsApp credentials and workflow while preserving other data
        const updatedCredentials = { ...userData.credentials };
        delete updatedCredentials.whatsappCredentials;
        const updatedWorkflows = { ...userData.workflows };
        delete updatedWorkflows.whatsapp_agent;
        
        await updateDoc(userRef, {
          credentials: updatedCredentials,
          workflows: updatedWorkflows
        });
      }

      // 2. Delete all chats and their messages from Whatsapp_Data
      console.log("Deleting all WhatsApp chats and messages...");
      const chatsRef = collection(db, 'Whatsapp_Data', userUID, 'chats');
      const chatsSnapshot = await getDocs(chatsRef);
      
      // Delete each chat and its messages
      for (const chatDoc of chatsSnapshot.docs) {
        const chatPhoneNumber = chatDoc.id;
        console.log(`Deleting chat for phone number: ${chatPhoneNumber}`);
        
        // Delete all messages in the chat
        const messagesRef = collection(db, 'Whatsapp_Data', userUID, 'chats', chatPhoneNumber, 'messages');
        const messagesSnapshot = await getDocs(messagesRef);
        console.log(`Found ${messagesSnapshot.docs.length} messages to delete in chat ${chatPhoneNumber}`);
        
        const messageDeletePromises = messagesSnapshot.docs.map(messageDoc => deleteDoc(messageDoc.ref));
        await Promise.all(messageDeletePromises);
        
        // Delete the chat document itself
        await deleteDoc(chatDoc.ref);
        console.log(`Deleted chat document for ${chatPhoneNumber}`);
      }

      // 3. Delete templates
      console.log("Deleting WhatsApp templates...");
      const templatesRef = collection(db, 'Whatsapp_Data', userUID, 'templates');
      const templatesSnapshot = await getDocs(templatesRef);
      console.log(`Found ${templatesSnapshot.docs.length} templates to delete`);
      
      const templateDeletePromises = templatesSnapshot.docs.map(templateDoc => deleteDoc(templateDoc.ref));
      await Promise.all(templateDeletePromises);

      // 4. Look for any other collections that might exist
      console.log("Checking for other WhatsApp data collections...");
      
      // Common subcollections in WhatsApp data
      const possibleCollections = [
        'settings',
        'analytics',
        'contacts',
        'broadcasts',
        'automations',
        'media',
        'status',
        'logs',
        'webhooks'
      ];
      
      // Try to delete documents from each possible collection
      for (const collName of possibleCollections) {
        try {
          const otherCollRef = collection(db, 'Whatsapp_Data', userUID, collName);
          const snapshot = await getDocs(otherCollRef);
          
          if (snapshot.docs.length > 0) {
            console.log(`Found ${snapshot.docs.length} documents in ${collName} collection`);
            const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(deletePromises);
            console.log(`Deleted all documents from ${collName} collection`);
          }
        } catch (err) {
          // Collection might not exist, continue
          console.log(`No ${collName} collection found or error accessing it`);
        }
      }

      // 5. Delete the root Whatsapp_Data document for the user
      console.log("Deleting root WhatsApp data document...");
      const whatsappDataRef = doc(db, 'Whatsapp_Data', userUID);
      await deleteDoc(whatsappDataRef);

      // 6. Verify deletion by checking if any chats still exist
      const verifyChatsExist = await getDocs(chatsRef);
      if (verifyChatsExist.docs.length > 0) {
        console.warn(`Found ${verifyChatsExist.docs.length} chat documents still existing after deletion attempt`);
        // Attempt a second deletion of any remaining chat documents
        const remainingDeletePromises = verifyChatsExist.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(remainingDeletePromises);
        console.log("Second deletion attempt completed");
      } else {
        console.log("Verified all chat documents were successfully deleted");
      }

      console.log("WhatsApp data deletion process completed successfully");
      toast({
        title: "Success",
        description: "Your WhatsApp data has been successfully deleted.",
      });

      // Navigate to platform select page to set up WhatsApp again
      navigate('/platform-select');
    } catch (error) {
      console.error('Error deleting WhatsApp data:', error);
      toast({
        title: "Error",
        description: error instanceof Error 
          ? `Failed to delete WhatsApp data: ${error.message}`
          : "Failed to delete WhatsApp data. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <NavSidebar />
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-4xl mx-auto py-8 px-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-8">Settings</h1>
          
          <div className="space-y-8">
            {/* Google Sheets Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium mb-4">Google Sheets Integration</h2>
              <GoogleSheetsButton />
            </div>

            {/* WhatsApp Backup Import Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium mb-4">Import WhatsApp Backup</h2>
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <input
                    type="file"
                    accept=".txt,.zip"
                    multiple
                    onChange={handleFileSelect}
                    disabled={isImporting}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm text-gray-600">
                      Selected files:
                    </div>
                    <ul className="list-disc list-inside text-sm text-gray-600">
                      {selectedFiles.map((file, index) => (
                        <li key={index}>
                          {file.file.name} (Phone: {file.phoneNumber || 'Not found'})
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={handleImport}
                      disabled={isImporting}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isImporting ? 'Importing...' : 'Import Selected Files'}
                    </button>
                  </div>
                )}
                {importProgress && (
                  <div className="text-sm text-gray-600">
                    {importProgress}
                  </div>
                )}
              </div>
            </div>

            {/* WhatsApp Backup Export Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium mb-4">Export WhatsApp Backup</h2>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Export all your WhatsApp chats to a zip file containing individual chat files.
                </p>
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExporting ? 'Exporting...' : 'Export All Chats'}
                </button>
                {exportProgress && (
                  <div className="text-sm text-gray-600">
                    {exportProgress}
                  </div>
                )}
              </div>
            </div>

            {/* Delete Account Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1 max-w-2xl">
                  <h3 className="text-lg font-medium mb-2">Delete WhatsApp Integration</h3>
                  <p className="text-sm text-gray-500">
                    This will permanently delete all your WhatsApp data, including chats, messages, and templates.
                    This action cannot be undone.
                  </p>
                </div>
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="ml-6 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors whitespace-nowrap"
                  >
                    Delete WhatsApp Data
                  </button>
                ) : (
                  <div className="ml-6 flex flex-col gap-3">
                    <input
                      type="text"
                      placeholder="Type 'DELETE' to confirm"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeleteConfirmText('');
                        }}
                        className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteWhatsAppData}
                        disabled={isDeleting || deleteConfirmText !== 'DELETE'}
                        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings; 