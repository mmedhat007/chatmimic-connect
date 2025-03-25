import { getCurrentUser } from './firebase';
import { doc, getDoc, collection, onSnapshot, query, where, getDocs, orderBy, limit, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Message, Contact, SheetConfig as TypesSheetConfig } from '../types';
import { extractDataFromMessage } from './ai';
import { getAllSheetConfigs, appendSheetRow, getSheetConfig, getUserSheets, updateSheetRow, findContactInSheet, SheetConfig } from './googleSheets';
import { getContactByPhone, updateContact, updateContactField } from './firebase';

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

  // Clear the processed messages to force reprocessing existing ones
  Object.keys(processedMessages).forEach(key => {
    delete processedMessages[key];
  });
  
  // Clear processing flags
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
  
  // Set up listeners for new chat updates only - do not process existing chats
  const unsubscribeChats = onSnapshot(chatsRef, async (chatSnapshot) => {
    console.log(`Received update in WhatsApp chats collection, ${chatSnapshot.size} chats found`);
    
    // Process each chat that changed (new or updated)
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
      
      // Initialize message tracking for this chat if needed
      if (!processedMessages[phoneNumber]) {
        processedMessages[phoneNumber] = [];
      }
      
      // Set up a listener for messages in this chat
      const messagesPath = `${whatsappChatsPath}/${phoneNumber}/messages`;
      const messagesRef = collection(db, messagesPath);
      
      // Create a simpler query that doesn't require a composite index
      const messagesQuery = query(messagesRef);
      
      // Listen for new messages in this chat
      const unsubscribeMessages = onSnapshot(messagesQuery, async (messagesSnapshot) => {
        console.log(`Received message update for ${phoneNumber}, ${messagesSnapshot.size} messages found`);
        
        // Process each message - filter for user messages in code
        const newMessages = [];
        
        for (const messageDoc of messagesSnapshot.docs) {
          const messageData = messageDoc.data();
          
          // Skip messages not from user (customer)
          // Note: In some systems, 'user' indicates the customer, in others it might be different
          if (messageData.sender !== 'user' && messageData.sender !== 'customer' && !messageData.isFromCustomer) {
            continue;
          }
          
          // Skip if we've already processed this message
          if (processedMessages[phoneNumber].some(pm => pm.id === messageDoc.id)) {
            continue;
          }
          
          const message = {
            id: messageDoc.id,
            ...messageData as Message
          };
          
          newMessages.push(message);
          
          // Mark as processed to avoid duplicate processing
          processedMessages[phoneNumber].push({
            id: message.id,
            timestamp: message.timestamp
          });
        }
        
        console.log(`Found ${newMessages.length} new messages to process for ${phoneNumber}`);
        
        // Sort messages by timestamp to process in order
        newMessages.sort((a, b) => a.timestamp - b.timestamp);
        
        // Process new messages
        for (const message of newMessages) {
          console.log(`Processing message: ${message.id} - ${message.message?.substring(0, 30) || 'No message content'}...`);
          
          // Generate a unique processing ID for this message and config combination
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
          } finally {
            // Clear processing flag when done
            delete processingMessages[processingId];
          }
        }
        
        // Clean up old processed messages (older than 24 hours)
        const ONE_DAY = 24 * 60 * 60 * 1000;
        const now = Date.now();
        processedMessages[phoneNumber] = processedMessages[phoneNumber].filter(
          pm => now - pm.timestamp < ONE_DAY
        );
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
    const interestCheck = await extractDataFromMessage(messageContent, [{
      id: 'interest',
      name: 'Interest Detection',
      description: 'Detect if customer shows interest in products or services',
      type: 'text',
      aiPrompt: 'Does this message show clear interest in products or services? Answer yes or no.'
    }]);
    
    return interestCheck.interest?.toLowerCase() === 'yes';
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
    // Create a unique ID for this sheet+contact combination
    const uniqueId = `${config.sheetId}_${contact.phoneNumber}`;
    
    // Check our local cache first to avoid unnecessary API calls
    if (addedContacts[config.sheetId]?.has(contact.phoneNumber)) {
      console.log(`Contact ${contact.phoneNumber} already processed for sheet ${config.sheetId} (cached). Updating instead...`);
      return updateContactInSheet(message, contact, config);
    }
    
    // Check if contact already exists in the sheet
    const existingRow = await findContactInSheet(config.sheetId, contact.phoneNumber);
    
    if (existingRow) {
      console.log(`Contact ${contact.phoneNumber} already exists in sheet at row ${existingRow}. Updating...`);
      
      // Add to our tracking to avoid duplicate API calls in the future
      if (!addedContacts[config.sheetId]) {
        addedContacts[config.sheetId] = new Set();
      }
      addedContacts[config.sheetId].add(contact.phoneNumber);
      
      return updateContactInSheet(message, contact, config);
    }
    
    // Extract data from message
    const extractedData = await extractDataFromMessage(message.message, config.columns);
    
    // Prepare row data
    const rowData: Record<string, string> = {};
    
    // Process each column
    for (const column of config.columns) {
      // Auto-populate phone number
      if (column.type === 'phone' || column.name.toLowerCase().includes('phone')) {
        rowData[column.id] = contact.phoneNumber || 'N/A';
        continue;
      }
      
      // Handle name fields - use contact name or extracted name
      if (column.type === 'name' || column.name.toLowerCase().includes('name')) {
        rowData[column.id] = contact.contactName || extractedData.customerName || extractedData[column.id] || 'N/A';
        continue;
      }
      
      // Handle inquiry fields - use current message
      if (column.type === 'inquiry') {
        rowData[column.id] = message.message || 'N/A';
        continue;
      }
      
      // For other fields, use extracted data
      rowData[column.id] = extractedData[column.id] || 'N/A';
    }
    
    // Add timestamp
    rowData['timestamp'] = new Date().toISOString();
    
    console.log(`Adding new row to sheet for ${contact.phoneNumber} with data:`, rowData);
    
    // Append to sheet
    await appendSheetRow(config.sheetId, rowData);
    console.log(`Added row to sheet "${config.name}" for ${contact.phoneNumber}`);
    
    // Mark this contact as added for this sheet
    if (!addedContacts[config.sheetId]) {
      addedContacts[config.sheetId] = new Set();
    }
    addedContacts[config.sheetId].add(contact.phoneNumber);
    
    return true;
  } catch (error) {
    console.error('Error adding contact to sheet:', error);
    throw error;
  }
};

/**
 * Update a contact's information in a Google Sheet
 */
const updateContactInSheet = async (message: Message, contact: Contact, config: SheetConfig) => {
  try {
    // Find the contact in the sheet
    const rowIndex = await findContactInSheet(config.sheetId, contact.phoneNumber);
    
    if (!rowIndex) {
      console.log(`Contact ${contact.phoneNumber} not found in sheet. Skipping update.`);
      return false;
    }
    
    // Extract data from message
    const extractedData = await extractDataFromMessage(message.message, config.columns);
    
    // Create an update object with only the fields that have meaningful extractions
    const updates: Record<string, string> = {};
    let hasUpdates = false;
    
    for (const column of config.columns) {
      const extractedValue = extractedData[column.id];
      
      // Skip phone number and timestamp - these don't change
      if (column.type === 'phone' || column.name.toLowerCase().includes('phone') || 
          column.name.toLowerCase() === 'timestamp') {
        continue;
      }
      
      // Update name if extracted and better than current
      if ((column.type === 'name' || column.name.toLowerCase().includes('name')) && 
          extractedValue && extractedValue !== 'N/A') {
        updates[column.id] = extractedValue;
        hasUpdates = true;
        
        // Also update the contact in Firestore if we found a better name
        if (extractedValue !== contact.contactName) {
          try {
            await updateContactField(contact.phoneNumber, 'contactName', extractedValue);
            console.log(`Updated contact name for ${contact.phoneNumber} to ${extractedValue}`);
          } catch (error) {
            console.error('Error updating contact name in Firestore:', error);
          }
        }
        continue;
      }
      
      // For all other fields, update if we have meaningful data
      if (extractedValue && extractedValue !== 'N/A') {
        updates[column.id] = extractedValue;
        hasUpdates = true;
        
        // For product or inquiry, also update as tags or lastMessage
        if (column.type === 'product' && !contact.tags?.includes(extractedValue)) {
          try {
            const updatedTags = [...(contact.tags || []), extractedValue];
            await updateContactField(contact.phoneNumber, 'tags', updatedTags);
            console.log(`Added tag ${extractedValue} to ${contact.phoneNumber}`);
          } catch (error) {
            console.error('Error updating contact tags in Firestore:', error);
          }
        }
      }
    }
    
    // Update the sheet if we have changes
    if (hasUpdates) {
      await updateSheetRow(config.sheetId, rowIndex, updates);
      console.log(`Updated row ${rowIndex} in sheet "${config.name}" for ${contact.phoneNumber}`);
      return true;
    }
    
    return false;
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
      
      const message = messageDoc.data() as Message;
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
          phoneNumber: phoneNumber
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
      
      // Clear any existing entries in processedMessages for this phone number for testing
      if (processedMessages[phoneNumber]) {
        processedMessages[phoneNumber] = [];
      }
      
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
    const extractedData = await extractDataFromMessage(message.content, sheetConfig.columns);
    
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
        rowData[column.id] = extractedData.customerName || 
                            contact.name || 
                            contact.contactName || 
                            'N/A';
        continue;
      }
      
      // For other fields, use extracted data
      rowData[column.id] = extractedData[column.id] || 'N/A';
    }
    
    // Add timestamp
    rowData['timestamp'] = new Date().toISOString();
    
    // Append to sheet
    await appendSheetRow(sheetConfig.sheetId, rowData);
    
    // If auto-update is enabled and we extracted new information, update the contact
    if (sheetConfig.autoUpdateFields) {
      const updates: Partial<Contact> = {};
      
      // Update contact name if we extracted one and it's different from current
      if (extractedData.customerName && 
          extractedData.customerName !== contact.name && 
          extractedData.customerName !== contact.contactName) {
        updates.name = extractedData.customerName;
        updates.contactName = extractedData.customerName;
      }
      
      // Update any other relevant contact fields
      if (extractedData.productInterest) {
        updates.tags = [...(contact.tags || [])];
        if (!updates.tags.includes(extractedData.productInterest)) {
          updates.tags.push(extractedData.productInterest);
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
      const analysis = await extractDataFromMessage(message.content, [{
        id: 'interest',
        type: 'text',
        name: 'Interest Detection',
        description: 'Detect if customer shows clear interest in products/services',
        aiPrompt: 'Does this message show clear interest in products or services? Answer yes or no.'
      }]);
      return analysis.interest?.toLowerCase() === 'yes';
      
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