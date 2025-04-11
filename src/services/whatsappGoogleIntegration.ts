import { getCurrentUser } from './firebase';
import { doc, getDoc, collection, onSnapshot, query, where, getDocs, orderBy, limit, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Message, Contact, SheetConfig as TypesSheetConfig } from '../types';
import { getAllSheetConfigs, appendSheetRow, getSheetConfig, getUserSheets, updateSheetRow, findContactInSheet, SheetConfig, SheetColumn } from './googleSheets';
import { getContactByPhone, updateContact, updateContactField } from './firebase';
import { apiRequest } from '../utils/api';

// Interface for processed messages to avoid duplicate processing
interface ProcessedMessage {
  id: string;
  timestamp: number;
}

// Keep track of processed messages to avoid duplicates
const processedMessages: Record<string, ProcessedMessage[]> = {};

// Track message processing status to prevent duplicates
const processingMessages: Record<string, boolean> = {};

// Track active listeners to avoid duplicate listeners
const activeListeners: Record<string, () => void> = {};

interface ExtractedData {
  customerName?: string;
  productInterest?: string;
  customerInquiry?: string;
  [key: string]: any;
}

// Track contacts that have been added to sheets to prevent duplicates
const addedContacts: Record<string, Set<string>> = {};

// Keep track of last processed timestamp per chat
const lastProcessedTimestamps: Record<string, number> = {};

/**
 * Start listening for new WhatsApp messages and update Google Sheets based on active configurations
 * @returns A cleanup function to stop listening
 */
export const startWhatsAppGoogleSheetsIntegration = async (): Promise<() => void> => {
  const userUID = getCurrentUser();
  if (!userUID) {
    console.error('No user logged in');
    return () => {};
  }

  // Reset message processing state
  Object.keys(processingMessages).forEach(key => {
    delete processingMessages[key];
  });
  
  // Unsubscribe from any existing listeners
  Object.values(activeListeners).forEach(unsubscribe => {
    unsubscribe();
  });
  Object.keys(activeListeners).forEach(key => {
    delete activeListeners[key];
  });

  // Get active sheet configurations
  const sheetConfigs = await getAllSheetConfigs();
  const activeConfigs = sheetConfigs.filter(config => config.active);
  
  if (activeConfigs.length === 0) {
    console.log('No active Google Sheets integrations found');
    return () => {};
  }

  console.log(`Starting WhatsApp to Google Sheets integration with ${activeConfigs.length} active configurations`);

  // Set up a listener for all WhatsApp chats at the correct path
  const whatsappChatsPath = `Whatsapp_Data/${userUID}/chats`;
  console.log(`Listening for WhatsApp messages at path: ${whatsappChatsPath}`);
  
  const chatsRef = collection(db, whatsappChatsPath);
  
  // Set up listener for chats
  const unsubscribeChats = onSnapshot(chatsRef, async (chatSnapshot) => {
    // Only process changes (added or modified chats)
    for (const change of chatSnapshot.docChanges()) {
      // Only process added or modified chats
      if (change.type !== 'added' && change.type !== 'modified') continue;
      
      const chatDoc = change.doc;
      const phoneNumber = chatDoc.id;
      
      // Skip system chats
      if (phoneNumber === 'system') {
        console.log('Skipping system chat');
        continue;
      }
      
      console.log(`Processing ${change.type} chat with phone: ${phoneNumber}`);
      
      // If we already have a listener for this chat, unsubscribe to avoid duplicates
      if (activeListeners[phoneNumber]) {
        console.log(`Removing existing listener for ${phoneNumber}`);
        activeListeners[phoneNumber]();
        delete activeListeners[phoneNumber];
      }
      
      // Get contact info
      const contact = {
        id: chatDoc.id,
        phoneNumber: phoneNumber,
        phone: phoneNumber,
        ...chatDoc.data()
      } as Contact;
      
      // Get the chat's latest message timestamp
      let latestTimestamp = contact.lastMessageTime || 0;
      
      // If we haven't processed this chat before, initialize it
      if (!lastProcessedTimestamps[phoneNumber]) {
        // Start by handling only new messages that arrive after integration is started
        // We record the current timestamp to only process future messages
        lastProcessedTimestamps[phoneNumber] = Date.now();
        console.log(`Initialized timestamp tracking for ${phoneNumber} at ${lastProcessedTimestamps[phoneNumber]}`);
      }
      
      // Set up the message listener to specifically target new messages
      const messagesPath = `${whatsappChatsPath}/${phoneNumber}/messages`;
      const messagesRef = collection(db, messagesPath);
      
      // Set up a query to only get messages created after our last processed timestamp
      // const latestMessageTimestamp = lastProcessedTimestamps[phoneNumber] || 0;
      
      // Listen for new messages in this chat
      const unsubscribeMessages = onSnapshot(messagesRef, async (messagesSnapshot) => {
        console.log(`Received message update for ${phoneNumber}, ${messagesSnapshot.size} messages found`);
        
        // Filter for changes - we only want newly added messages
        const messageChanges = messagesSnapshot.docChanges().filter(change => change.type === 'added');
        
        if (messageChanges.length === 0) {
          console.log(`No new messages for ${phoneNumber}`);
          return;
        }
        
        console.log(`Found ${messageChanges.length} new messages for ${phoneNumber}`);
        
        // Process each newly added message
        const newMessages: Message[] = [];
        
        for (const change of messageChanges) {
          const messageDoc = change.doc;
          const messageData = messageDoc.data();
          
          // ADD CHECK: Skip if it's a test message flagged by the button
          if (messageData.isTestMessage === true) {
             console.log(`[Listener] Skipping test message ${messageDoc.id}`);
             continue; // Go to the next message change
          }
          
          const message: Message = {
            id: messageDoc.id,
            ...messageData as any
          };
          
          // Skip messages not from the customer
          // Check if the message is from the customer using all possible indicators
          const isFromCustomer = 
            message.isFromCustomer === true || 
            message.sender === 'user';
          
          if (!isFromCustomer) {
            continue;
          }
          
          // Skip messages with timestamps older than our last processed timestamp
          if (message.timestamp <= lastProcessedTimestamps[phoneNumber]) {
            console.log(`Skipping already processed message ${message.id} (${message.timestamp} <= ${lastProcessedTimestamps[phoneNumber]})`);
            continue;
          }
          
          // This is a new customer message we haven't processed yet
          console.log(`Found new unprocessed message: ${message.id}`);
          
          newMessages.push(message);
          
          // Update our latest timestamp if this message is newer
          if (message.timestamp > latestTimestamp) {
            latestTimestamp = message.timestamp;
          }
        }
        
        if (newMessages.length === 0) {
          console.log(`No new user messages to process for ${phoneNumber}`);
          return;
        }
        
        // Sort messages by timestamp (oldest first)
        newMessages.sort((a, b) => a.timestamp - b.timestamp);
        
        // Process new messages
        for (const message of newMessages) {
          console.log(`Processing message: ${message.id} - ${message.message?.substring(0, 30) || 'No message content'}...`);
          
          // Generate a unique processing ID for this message
          const processingId = `${message.id}`;
          
          // Skip if already processing (prevents duplicate sheet entries)
          if (processingMessages[processingId]) {
            console.log(`Already processing message ${message.id}, skipping duplicate processing`);
              continue;
            }
            
          // Mark as processing
          processingMessages[processingId] = true;
            
          try {
            // Process with each active config
            for (const config of activeConfigs) {
              try {
                await processMessageWithConfig(message, contact, config);
              } catch (error) {
                console.error(`Error processing message for sheet "${config.name}":`, error);
              }
            }
            
            // Update the last processed timestamp for this chat
            lastProcessedTimestamps[phoneNumber] = message.timestamp;
            console.log(`Updated last processed timestamp for ${phoneNumber} to ${message.timestamp}`);
            
          } finally {
            // Clear processing flag when done
            delete processingMessages[processingId];
          }
        }
      });
      
      // Store the unsubscribe function
      activeListeners[phoneNumber] = unsubscribeMessages;
    }
  });
  
  // Return a function that cleans up all listeners
  return () => {
    unsubscribeChats();
    
    // Clean up all message listeners
    Object.values(activeListeners).forEach(unsubscribe => {
      unsubscribe();
    });
    
    // Clear the listener tracking
    Object.keys(activeListeners).forEach(key => {
      delete activeListeners[key];
    });
  };
};

/**
 * Process a message with a specific sheet configuration
 */
const processMessageWithConfig = async (message: Message, contact: Contact, config: SheetConfig) => {
  // Default to first_message if not specified
  const trigger = config.addTrigger || 'first_message';
  const autoUpdate = config.autoUpdateFields !== false; // Default to true if not specified

  // Check if this is the first message from this contact
  const isFirstMessage = !(contact.lastMessageTime) || 
                        message.timestamp === contact.lastMessageTime ||
                        processedMessages[contact.phoneNumber]?.length === 1;
  
  console.log(`Processing message with trigger: ${trigger}, isFirstMessage: ${isFirstMessage}`);
  
  // Check if we should process this message based on the trigger
  if (trigger === 'first_message' && isFirstMessage) {
    console.log(`Processing first message for ${contact.phoneNumber} with trigger ${trigger}`);
    await addContactToSheet(message, contact, config);
    return;
  }
  
  // For 'show_interest' trigger, check if message shows interest
  if (trigger === 'show_interest') {
    const showsInterest = await checkIfMessageShowsInterest(message.message);
    
    if (showsInterest) {
      console.log(`Message shows interest from ${contact.phoneNumber} with trigger ${trigger}`);
      await addContactToSheet(message, contact, config);
      return;
    }
  }
  
  // If we reach here and auto-update is enabled, update the existing row if needed
  if (autoUpdate) {
    await updateContactInSheet(message, contact, config);
  }
};

/**
 * Check if a message shows interest using AI
 */
const checkIfMessageShowsInterest = async (messageContent: string): Promise<boolean> => {
  try {
    const interestCheck = await apiRequest('/api/ai/extract-data', {
      method: 'POST',
      body: JSON.stringify({
        message: messageContent,
        fields: [{
          id: 'interest',
          name: 'Interest Detection',
          description: 'Detect if customer shows interest in products or services',
          type: 'text',
          aiPrompt: 'Does this message show clear interest in products or services? Answer yes or no.'
        }]
      })
    });
    
    return interestCheck.data?.interest?.toLowerCase() === 'yes';
  } catch (error) {
    console.error('Error checking if message shows interest:', error);
    return false;
  }
};

/**
 * Add a contact to a Google Sheet
 */
const addContactToSheet = async (message: Message, contact: Contact, config: SheetConfig) => {
  try {
    // First, check if the contact already exists (optional, depends on desired logic)
    // const existingRow = await findContactInSheet(config.sheetId, contact.phoneNumber);
    // if (existingRow) {
    //   console.log(`Contact ${contact.phoneNumber} already exists in sheet ${config.name}, skipping add.`);
    //   return; // Or call update logic?
    // }

    // Call the backend AI service to extract data
    console.log(`[Whatsapp Integration] Calling backend AI service to extract data for message: ${message.id}`);
    const aiResponse = await apiRequest('/api/ai/extract-data', {
      method: 'POST',
      body: JSON.stringify({
        message: message.message || '',
        fields: config.columns // Pass the column configuration as fields
      })
    });

    if (!aiResponse || aiResponse.status !== 'success' || !aiResponse.data) {
      throw new Error(`Backend AI extraction failed: ${aiResponse?.message || 'No data returned'}`);
    }
    
    const extractedData = aiResponse.data as Record<string, string>;
    console.log('[Whatsapp Integration] Extracted data from backend AI:', extractedData);

    // Prepare the row data based on extracted info and config
    const rowData: Record<string, any> = {};
    for (const column of config.columns) {
      // Prioritize extracted data, fallback based on type or default
      if (extractedData[column.id] !== undefined && extractedData[column.id] !== 'N/A') {
        rowData[column.name] = extractedData[column.id];
      } else {
        // Add default values or specific logic based on column type if AI fails
        switch (column.type) {
          case 'phone':
            rowData[column.name] = contact.phoneNumber; // Use contact's phone number
            break;
          case 'timestamp':
            rowData[column.name] = new Date(message.timestamp).toISOString(); // Use message timestamp
            break;
          case 'inquiry': // Maybe use full message if inquiry extraction fails?
             rowData[column.name] = message.message || ''; 
             break;
          // Add other default fallbacks as needed
          default:
            rowData[column.name] = ''; // Default to empty string if not found and no specific fallback
        }
      }
    }
    
    // Ensure essential fields have values even if AI failed
    const phoneField = config.columns.find(c => c.type === 'phone');
    if (phoneField && !rowData[phoneField.name]) {
        rowData[phoneField.name] = contact.phoneNumber;
    }
    const timestampField = config.columns.find(c => c.type === 'timestamp');
    if (timestampField && !rowData[timestampField.name]) {
         rowData[timestampField.name] = new Date(message.timestamp).toISOString();
    }


    console.log(`Adding new row to sheet for ${contact.phoneNumber} with data:`, rowData);
    
    // Append the data to the sheet via backend service call
    await appendSheetRow(config.sheetId, rowData);
    
    console.log(`Added row to sheet "${config.name}" for ${contact.phoneNumber}`);

  } catch (error) {
    console.error('Error adding contact to sheet:', error);
    // Propagate error or handle specifically
    throw error; 
  }
};

/**
 * Update a contact's information in a Google Sheet
 */
const updateContactInSheet = async (message: Message, contact: Contact, config: SheetConfig) => {
  try {
    // Find the existing row for the contact
    const existingRowIndex = await findContactInSheet(config.sheetId, contact.phoneNumber);
    
    if (existingRowIndex === null) {
      console.log(`Contact ${contact.phoneNumber} not found in sheet ${config.name} for update, skipping.`);
      // Optionally, call addContactToSheet here if desired behaviour is to add if not found
      // await addContactToSheet(message, contact, config);
      return; 
    }

    // Call backend AI service to extract data from the new message
     console.log(`[Whatsapp Integration] Calling backend AI service to extract data for update: ${message.id}`);
    const aiResponse = await apiRequest('/api/ai/extract-data', {
      method: 'POST',
      body: JSON.stringify({
        message: message.message || '',
        fields: config.columns
      })
    });

    if (!aiResponse || aiResponse.status !== 'success' || !aiResponse.data) {
      throw new Error(`Backend AI extraction failed for update: ${aiResponse?.message || 'No data returned'}`);
    }
    
    const extractedData = aiResponse.data as Record<string, string>;
    console.log('[Whatsapp Integration] Extracted data for update from backend AI:', extractedData);

    // Prepare the data for update - only include fields extracted successfully (not 'N/A')
    const updateData: Record<string, any> = {};
    let hasUpdate = false;
    for (const column of config.columns) {
      if (extractedData[column.id] !== undefined && extractedData[column.id] !== 'N/A' && extractedData[column.id] !== '') {
        // Consider adding logic here to compare with existing data if needed
        // Only update if the extracted value is different from the current value in the sheet?
        // This would require fetching the current row data first.
        updateData[column.name] = extractedData[column.id];
        hasUpdate = true;
      }
    }
    
    // Update timestamp if present in config
    const timestampColumn = config.columns.find(col => col.type === 'timestamp');
    if (timestampColumn) {
        updateData[timestampColumn.name] = new Date(message.timestamp).toISOString();
        hasUpdate = true;
    }

    if (!hasUpdate) {
      console.log(`No new data extracted to update for ${contact.phoneNumber} in sheet ${config.name}.`);
      return;
    }

    console.log(`Updating row ${existingRowIndex} for ${contact.phoneNumber} in sheet ${config.name} with data:`, updateData);
    
    // Update the row in the sheet via backend service call
    await updateSheetRow(config.sheetId, existingRowIndex, updateData);
    
    console.log(`Updated row for ${contact.phoneNumber} in sheet "${config.name}"`);

  } catch (error) {
    console.error('Error updating contact in sheet:', error);
    throw error;
  }
};

/**
 * Process a specific WhatsApp message and update Google Sheets
 * @param phoneNumber The phone number the message is from
 * @param messageId The ID of the message to process
 * @returns True if processing was successful
 */
export const processWhatsAppMessage = async (
  phoneNumber: string, 
  messageId: string
): Promise<boolean> => {
  try {
    const userUID = getCurrentUser();
    if (!userUID) throw new Error('No user logged in');

    console.log(`Processing test message from ${phoneNumber} with ID ${messageId}`);

    // Create a unique key for this test message to prevent duplicate processing
    const processingKey = `test_${phoneNumber}_${messageId}`;
    
    if (processingMessages[processingKey]) {
      console.log(`Already processing test message ${messageId}. Waiting for completion...`);
      
      // Wait for processing to complete (for up to 10 seconds)
      let waitCounter = 0;
      while(processingMessages[processingKey] && waitCounter < 100) {
        await new Promise(resolve => setTimeout(resolve, 100));
        waitCounter++;
      }
      
      if (processingMessages[processingKey]) {
        console.log(`Test message processing timed out, forcing continuation`);
        delete processingMessages[processingKey];
      } else {
        console.log(`Previous test message processing completed`);
        return true;
      }
    }
    
    // Mark as processing
    processingMessages[processingKey] = true;

    try {
      // Create the chat document path
      const chatPath = `Whatsapp_Data/${userUID}/chats/${phoneNumber}`;
      const chatDocRef = doc(db, chatPath);
      
      // Create the message path
      const messagePath = `${chatPath}/messages/${messageId}`;
      const messageDocRef = doc(db, messagePath);
      
      // Check if the message exists
      const messageDoc = await getDoc(messageDocRef);
      if (!messageDoc.exists()) {
        console.error(`Message not found at path: ${messagePath}`);
        throw new Error('Message not found');
      }
      
      // Create a properly typed message object
      const messageData = messageDoc.data();
      const message: Message = {
        id: messageId,
        ...messageData as any
      };
      
      console.log(`Found message: ${JSON.stringify(message)}`);
      
      // Get or create the contact document
      let contact: Contact;
      const chatDoc = await getDoc(chatDocRef);
      
      if (chatDoc.exists()) {
        contact = {
          id: phoneNumber,
          phoneNumber: phoneNumber,
          phone: phoneNumber,
          ...chatDoc.data()
        } as Contact;
      } else {
        // Create a basic contact object
        contact = {
          id: phoneNumber,
          phoneNumber: phoneNumber,
          phone: phoneNumber,
          contactName: '',
          lastMessage: message.message,
          lastMessageTime: message.timestamp,
          tags: []
        };
        
        // Create the contact document in Firestore
        await setDoc(chatDocRef, {
          lastMessage: message.message,
          lastMessageTime: message.timestamp,
          phoneNumber: phoneNumber,
          agentStatus: 'on',  // Ensure AI agent is active by default
          humanAgent: false   // Make sure human agent is not active
        });
        
        console.log(`Created contact document for ${phoneNumber}`);
      }
      
      // Get active sheet configurations
    const sheetConfigs = await getAllSheetConfigs();
    const activeConfigs = sheetConfigs.filter(config => config.active);
    
    if (activeConfigs.length === 0) {
      console.log('No active Google Sheets integrations found');
      return false;
    }
    
      // Reset the last processed timestamp for this chat to force processing this test message
      // For a test message, we want to process it regardless of timestamp
      lastProcessedTimestamps[phoneNumber] = message.timestamp - 1;
      
      // Reset per-sheet cache for this phone number to force fresh checks
      for (const config of activeConfigs) {
        if (addedContacts[config.sheetId]) {
          addedContacts[config.sheetId].delete(phoneNumber);
        }
      }
      
      // For test messages, process with all active configs
    for (const config of activeConfigs) {
        try {
          // Process test message with the configured trigger criteria
          await processMessageWithConfig(message, contact, config);
        } catch (error) {
          console.error(`Error processing test message for sheet "${config.name}":`, error);
          throw error; // Re-throw to show in UI
        }
      }
      
      // Update the last processed timestamp to include this test message
      lastProcessedTimestamps[phoneNumber] = message.timestamp;
      
      console.log(`Test message from ${phoneNumber} processed successfully`);
      return true;
    } finally {
      // Clear processing flag when done
      delete processingMessages[processingKey];
    }
  } catch (error) {
    console.error('Error processing test WhatsApp message:', error);
    throw error;
  }
};

/**
 * Process a new WhatsApp message and update Google Sheets if needed
 */
export const processMessageForSheets = async (message: Message, contact: Contact, sheetConfig: SheetConfig) => {
  // Skip if sheet integration is not active
  if (!sheetConfig.active) return;

  // Check if we should process this message based on the trigger
  const shouldProcess = await shouldProcessMessage(message, contact, sheetConfig);
  if (!shouldProcess) return;

  try {
    // Extract data from message
    const extractedData = await apiRequest('/api/ai/extract-data', {
      method: 'POST',
      body: JSON.stringify({
        message: message.content,
        fields: sheetConfig.columns
      })
    });
    
    if (!extractedData || extractedData.status !== 'success' || !extractedData.data) {
      throw new Error(`Backend AI extraction failed: ${extractedData?.message || 'No data returned'}`);
    }
    
    const extractedDataObj = extractedData.data as Record<string, string>;
    console.log('[Whatsapp Integration] Extracted data from backend AI:', extractedDataObj);

    // Prepare row data
    const rowData: Record<string, string> = {};
    
    // Process each column
    for (const column of sheetConfig.columns) {
      // Auto-populate phone number
      if (column.type === 'phone' || column.name.toLowerCase().includes('phone')) {
        rowData[column.id] = contact.phoneNumber || contact.phone || 'N/A';
        continue;
      }
      
      // Handle name fields
      if (column.type === 'name' || column.name.toLowerCase().includes('name')) {
        // Try different name sources in order of priority
        rowData[column.id] = extractedDataObj.customerName || 
                            contact.name || 
                            contact.contactName || 
                            'N/A';
        continue;
      }
      
      // For other fields, use extracted data
      rowData[column.id] = extractedDataObj[column.id] || 'N/A';
    }
    
    // Add timestamp
    rowData['timestamp'] = new Date().toISOString();
    
    // Append to sheet
    await appendSheetRow(sheetConfig.sheetId, rowData);
    
    // If auto-update is enabled and we extracted new information, update the contact
    if (sheetConfig.autoUpdateFields) {
      const updates: Partial<Contact> = {};
      
      // Update contact name if we extracted one and it's different from current
      if (extractedDataObj.customerName && 
          extractedDataObj.customerName !== contact.name && 
          extractedDataObj.customerName !== contact.contactName) {
        updates.name = extractedDataObj.customerName;
        updates.contactName = extractedDataObj.customerName;
      }
      
      // Update any other relevant contact fields
      if (extractedDataObj.productInterest) {
        updates.tags = [...(contact.tags || [])];
        if (!updates.tags.includes(extractedDataObj.productInterest)) {
          updates.tags.push(extractedDataObj.productInterest);
        }
      }
      
      if (Object.keys(updates).length > 0) {
        await updateContact(contact.id, updates);
        await updateContactField(contact.phoneNumber, 'contactName', updates.contactName);
        if (updates.tags) {
          await updateContactField(contact.phoneNumber, 'tags', updates.tags);
        }
      }
    }
  } catch (error) {
    console.error('Error processing message for sheets:', error);
    throw error;
  }
};

/**
 * Determine if a message should trigger a sheet update based on config
 */
const shouldProcessMessage = async (message: Message, contact: Contact, config: SheetConfig): Promise<boolean> => {
  // Always process if it's a first message
  if (message.isFromCustomer && !contact.lastMessageAt) {
    return true;
  }

  switch (config.addTrigger) {
    case 'first_message':
      // Already handled above
      return false;
      
    case 'show_interest':
      // Use AI to detect if message shows interest
      const analysis = await checkIfMessageShowsInterest(message.content);
      return analysis;
      
    case 'manual':
      // For manual mode, we'll still auto-update existing entries
      // Check if this contact already exists in the sheet
      try {
        const sheets = await getUserSheets();
        const targetSheet = sheets.find(s => s.id === config.sheetId);
        if (targetSheet) {
          // If contact exists in sheet, allow updates
          return true;
        }
  } catch (error) {
        console.error('Error checking existing sheet entries:', error);
      }
      return false;
      
    default:
    return false;
  }
};

/**
 * Manually trigger adding a contact to the sheet
 */
export const manuallyAddContactToSheet = async (contact: Contact, sheetConfig: SheetConfig) => {
  // Prepare initial row data with available contact info
  const rowData: Record<string, string> = {};
  
  for (const column of sheetConfig.columns) {
    if (column.type === 'phone' || column.name.toLowerCase().includes('phone')) {
      rowData[column.id] = contact.phone || 'N/A';
    } else if (column.type === 'name' && contact.name) {
      rowData[column.id] = contact.name;
    } else {
      rowData[column.id] = 'N/A';
    }
  }
  
  rowData['timestamp'] = new Date().toISOString();
  
  await appendSheetRow(sheetConfig.sheetId, rowData);
}; 