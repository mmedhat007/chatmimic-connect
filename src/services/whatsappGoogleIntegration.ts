import { getCurrentUser } from './firebase';
import { doc, getDoc, collection, onSnapshot, query, where, getDocs, orderBy, limit, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Message, Contact, SheetConfig as TypesSheetConfig } from '../types';
import { getAllSheetConfigs, appendSheetRow, getSheetConfig, getUserSheets, updateSheetRow, findContactInSheet, SheetConfig, SheetColumn } from './googleSheets';
import { getContactByPhone, updateContact, updateContactField } from './firebase';
import { apiRequest } from '../utils/api';

// Track processing state *only for manual test button* to prevent double-clicks
const testProcessingMessages: Record<string, boolean> = {};

/**
 * Process a specific WhatsApp message for testing the integration
 * Called by the 'Test Integration' button in the UI.
 * This function fetches the message, contact info, and active configs,
 * then calls the necessary backend APIs to simulate the processing flow for that specific message.
 * NOTE: This does NOT use the automatic backend listener.
 * @param phoneNumber The phone number the message is from
 * @param messageId The ID of the message to process
 * @returns True if processing API calls were initiated successfully (does not guarantee completion)
 */
export const processWhatsAppMessage = async (
  phoneNumber: string, 
  messageId: string
): Promise<boolean> => {
  try {
    const userUID = getCurrentUser();
    if (!userUID) throw new Error('No user logged in');

    console.log(`[Test Button] Processing test message from ${phoneNumber} with ID ${messageId}`);

    // Create a unique key for this test message to prevent duplicate processing from rapid clicks
    const processingKey = `test_${phoneNumber}_${messageId}`;
    
    if (testProcessingMessages[processingKey]) {
      console.warn(`[Test Button] Already processing test message ${messageId}. Preventing double-click.`);
      return false; // Indicate that processing was already underway
    }
    
    // Mark as processing for test button flow
    testProcessingMessages[processingKey] = true;

    try {
      // Fetch the specific message document
      const messagePath = `Whatsapp_Data/${userUID}/chats/${phoneNumber}/messages/${messageId}`;
      const messageDocRef = doc(db, messagePath);
      const messageDoc = await getDoc(messageDocRef);

      if (!messageDoc.exists()) {
        console.error(`[Test Button] Message not found at path: ${messagePath}`);
        throw new Error('Test message not found');
      }
      const messageData = messageDoc.data();

      // Flag this message explicitly as a test in Firestore (backend listener will ignore it)
      // This is crucial so the backend listener doesn't process it again.
      await setDoc(messageDocRef, { isTestMessage: true }, { merge: true });
      console.log(`[Test Button] Marked message ${messageId} as test message.`);

      // Simulate the backend flow by calling the relevant API endpoints
      // 1. Extract Data using AI (via backend proxy)
      const sheetConfigs = await getAllSheetConfigs();
      const activeConfigs = sheetConfigs.filter(config => config.active);

      if (activeConfigs.length === 0) {
          console.log('[Test Button] No active sheet configurations found.');
          return false; // Or throw error?
      }

      let overallSuccess = true;
      // Process against each active config individually for the test
      for (const config of activeConfigs) {
          console.log(`[Test Button] Testing config: ${config.name} (${config.sheetId})`);
          try {
              const aiResponse = await apiRequest('/api/ai/extract-data', {
                  method: 'POST',
                  body: JSON.stringify({
                      message: messageData.message || '',
                      fields: config.columns
                  })
              });

              if (aiResponse.status !== 'success' || !aiResponse.data) {
                  throw new Error(`AI Extraction failed: ${aiResponse?.message || 'No data returned'}`);
              }
              const extractedData = aiResponse.data as Record<string, string>;
              console.log(`[Test Button] Extracted data for ${config.name}:`, extractedData);

              // 2. Prepare row data (Similar logic to backend, maybe move to a shared util?)
               const rowDataMap: Record<string, any> = {};
                config.columns.forEach(col => {
                    rowDataMap[col.name] = extractedData[col.id] !== null && extractedData[col.id] !== undefined && extractedData[col.id] !== 'N/A'
                        ? String(extractedData[col.id])
                        : '';
                });
                // Add essential fallbacks
                 if (!rowDataMap['Phone Number'] && config.columns.some(c => c.name === 'Phone Number')) {
                    rowDataMap['Phone Number'] = phoneNumber;
                 }
                 if (!rowDataMap['Timestamp'] && config.columns.some(c => c.name === 'Timestamp')) {
                    rowDataMap['Timestamp'] = new Date(messageData.timestamp).toISOString();
                 }

                console.log(`[Test Button] Prepared row data for ${config.name}:`, rowDataMap);

              // 3. Find/Append/Update Row (via backend API calls)
              // NOTE: These frontend services call the backend API endpoints
              const existingRowIndex = await findContactInSheet(config.sheetId, phoneNumber);

              if (existingRowIndex !== null) {
                  console.log(`[Test Button] Found existing contact at row ${existingRowIndex}. Updating...`);
                  await updateSheetRow(config.sheetId, existingRowIndex, rowDataMap);
              } else {
                  console.log(`[Test Button] Contact not found. Appending...`);
                  await appendSheetRow(config.sheetId, rowDataMap);
              }
              console.log(`[Test Button] Successfully processed test for config ${config.name}`);
          } catch (configError) {
                console.error(`[Test Button] Error processing test message for sheet "${config.name}":`, configError);
                overallSuccess = false;
                // Continue testing other configs
          }
      }

      if (!overallSuccess) {
           throw new Error('One or more test configurations failed.');
      }
      
      console.log(`[Test Button] Test message processing calls initiated for ${phoneNumber} / ${messageId}`);
      return true;

    } finally {
      // Clear processing flag for test button flow
      delete testProcessingMessages[processingKey];
    }
  } catch (error) {
    console.error('[Test Button] Error processing test WhatsApp message:', error);
    // Clear flag on error too
     const processingKey = `test_${phoneNumber}_${messageId}`;
     delete testProcessingMessages[processingKey];
    throw error; // Re-throw to be shown in UI
  }
};

/**
 * Manually adds a contact to a specified Google Sheet configuration.
 * (Consider if this is still needed or handled differently now).
 */
export const manuallyAddContactToSheet = async (contact: Contact, sheetConfig: SheetConfig) => {
  if (!sheetConfig.active) {
    console.log(`Sheet config "${sheetConfig.name}" is not active. Skipping manual add.`);
    return;
  }

  try {
    console.log(`[Manual Add] Manually adding contact ${contact.phoneNumber} to sheet ${sheetConfig.name}`);

    // Prepare basic row data from contact info
    const rowData: Record<string, any> = {};
    sheetConfig.columns.forEach(col => {
      switch (col.type) {
        case 'name':
          rowData[col.name] = contact.contactName || 'N/A';
          break;
        case 'phone':
          rowData[col.name] = contact.phoneNumber;
          break;
        case 'timestamp': // Use current time for manual add?
          rowData[col.name] = new Date().toISOString();
          break;
        default:
          rowData[col.name] = ''; // Default to empty for other fields on manual add
      }
    });

    // Ensure phone number is present
    const phoneField = sheetConfig.columns.find(c => c.type === 'phone');
    if (phoneField && !rowData[phoneField.name]) {
        rowData[phoneField.name] = contact.phoneNumber;
    }

    console.log(`[Manual Add] Prepared data:`, rowData);

    // Append the row via the backend API
    await appendSheetRow(sheetConfig.sheetId, rowData);

    console.log(`[Manual Add] Successfully added contact ${contact.phoneNumber} to sheet ${sheetConfig.name}`);

  } catch (error) {
    console.error(`[Manual Add] Error manually adding contact ${contact.phoneNumber} to sheet ${sheetConfig.name}:`, error);
    throw error; // Re-throw for UI feedback
  }
}; 