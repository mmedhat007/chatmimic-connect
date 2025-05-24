console.log('[DEBUG] services/messageProcessorService.js: START executing...');

// server/services/messageProcessorService.js
console.log('[DEBUG] messageProcessorService: Requiring firebase-admin...');
const admin = require('firebase-admin');
console.log('[DEBUG] messageProcessorService: firebase-admin required.');

console.log('[DEBUG] messageProcessorService: Requiring logger...');
const logger = require('../utils/logger');
console.log('[DEBUG] messageProcessorService: logger required.');

console.log('[DEBUG] messageProcessorService: Requiring aiService...');
let extractDataFromMessage, checkInterest; // Declare outside try
try {
  ({ extractDataFromMessage, checkInterest } = require('./aiService')); 
  console.log('[DEBUG] messageProcessorService: aiService required successfully.');
} catch (aiError) {
  console.error('[CRITICAL] messageProcessorService: FAILED to require aiService:', aiError);
  throw aiError; // Re-throw to prevent server starting in broken state
}

console.log('[DEBUG] messageProcessorService: Requiring googleService...');
let googleService; // Declare outside try
try {
  googleService = require('./googleService');
  console.log('[DEBUG] messageProcessorService: googleService required successfully.');
} catch (googleError) {
  console.error('[CRITICAL] messageProcessorService: FAILED to require googleService:', googleError);
  throw googleError; // Re-throw
}

console.log('[DEBUG] messageProcessorService: Module dependencies loaded. Defining functions...');

let listenerUnsubscribe = null;

/**
 * Marks a message document as processed in Firestore.
 * @param {admin.firestore.DocumentReference} messageRef - Reference to the message document.
 * @param {string} uid - User ID.
 * @param {object} statusData - Data to store in automationStatus field.
 */
const markMessageProcessed = async (messageRef, uid, statusData) => {
    try {
        await messageRef.update({
            isProcessedByAutomation: true,
            automationStatus: statusData,
            processedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        logger.info(`Marked message ${messageRef.path} as processed for user ${uid}. Status: ${JSON.stringify(statusData)}`);
    } catch (error) {
        logger.error(`Failed to mark message ${messageRef.path} as processed for user ${uid}.`, {
            error: error.message,
            statusData
        });
        // Decide if re-throwing is necessary or if logging is sufficient
    }
};

/**
 * Processes a single new message from the Firestore listener.
 * @param {admin.firestore.QueryDocumentSnapshot} messageDoc - The message document snapshot.
 */
const processSingleMessage = async (messageDoc) => {
    const messageRef = messageDoc.ref;
    const messageData = messageDoc.data();
    let uid = null;
    let contactPhoneNumber = null;

    logger.debug(`Starting processing for message: ${messageRef.path}`);

    try {
        // Extract UID and Phone Number from path (adjust indices based on actual path)
        const pathSegments = messageRef.path.split('/');
        if (pathSegments.length >= 4 && pathSegments[0] === 'Whatsapp_Data' && pathSegments[2] === 'chats') {
            uid = pathSegments[1];
            contactPhoneNumber = pathSegments[3];
        } else {
            throw new Error(`Could not extract UID or phone number from path: ${messageRef.path}`);
        }

        if (!uid || !contactPhoneNumber) {
             throw new Error(`Invalid UID or phone number extracted from path: ${messageRef.path}`);
        }

        // Initial Checks
        if (messageData.isTestMessage === true) {
            logger.info(`Skipping test message: ${messageRef.path}`);
            // Test messages are typically processed manually via frontend, don't auto-mark here
            return;
        }
        if (messageData.isProcessedByAutomation === true) {
            logger.warn(`Attempted to process already processed message (should be filtered by listener): ${messageRef.path}`);
            return;
        }
        
        // Allow processing if sender is 'user' OR 'customer'
        const allowedSenders = ['user', 'customer'];
         if (!allowedSenders.includes(messageData.sender)) {
            logger.debug(`Skipping message from non-allowed sender: ${messageRef.path}, sender: ${messageData.sender}`);
            await markMessageProcessed(messageRef, uid, { skipped: true, reason: `Sender (${messageData.sender}) not in allowed list [${allowedSenders.join(', ')}]` });
            return;
        }

        // Fetch User Config & Credentials
        const userRef = admin.firestore().collection('Users').doc(uid);
        // Fetch Chat Document as well
        const chatRef = admin.firestore().collection('Whatsapp_Data').doc(uid).collection('chats').doc(contactPhoneNumber);
        // Fetch the root Whatsapp_Data document to check for global agent settings
        const whatsappDataRef = admin.firestore().collection('Whatsapp_Data').doc(uid);
        
        const [userDoc, chatDoc, whatsappDataDoc] = await Promise.all([
            userRef.get(), 
            chatRef.get(),
            whatsappDataRef.get()
        ]);

        if (!userDoc.exists) {
            // Log error or mark processed with error?
            logger.error(`User document not found for UID: ${uid}. Skipping message ${messageRef.path}.`);
            await markMessageProcessed(messageRef, uid, { skipped: true, reason: `User document ${uid} not found` });
            return; 
        }
        
        // Check if agent is globally disabled
        if (whatsappDataDoc.exists && whatsappDataDoc.data().globalAgentDisabled === true) {
            logger.info(`Skipping message ${messageRef.path} for user ${uid}: AI agent is globally disabled.`);
            await markMessageProcessed(messageRef, uid, { 
                skipped: true, 
                reason: 'Agent is globally disabled' 
            });
            return;
        }
        
        // Chat doc might not exist if it's the very first message ever, handle this gracefully
        const chatData = chatDoc.exists ? chatDoc.data() : {}; 

        // Check if agent is disabled for this specific chat
        if (chatData.agentStatus === 'off' || chatData.humanAgent === true) {
            logger.info(`Skipping message ${messageRef.path} for chat ${contactPhoneNumber}: AI agent is disabled for this chat.`);
            await markMessageProcessed(messageRef, uid, { 
                skipped: true, 
                reason: `Agent is disabled for chat (agentStatus: ${chatData.agentStatus}, humanAgent: ${chatData.humanAgent})` 
            });
            return;
        }

        const userData = userDoc.data();
        const sheetConfigs = userData?.workflows?.whatsapp_agent?.sheetConfigs || [];
        const activeConfigs = sheetConfigs.filter(c => c.active && c.sheetId && c.columns && c.columns.length > 0);
        const googleCreds = userData?.credentials?.googleSheetsOAuth;

        // Check if we have active configs AND the necessary refresh token to attempt API calls
        if (activeConfigs.length === 0 || !googleCreds?.refreshToken?.encryptedData) {
            logger.info(`Skipping message ${messageRef.path} for user ${uid}: No active Google Sheet configs or missing Google refresh token.`);
            await markMessageProcessed(messageRef, uid, { skipped: true, reason: 'No active config or Google refresh token' });
            return;
        }

        // Process each active configuration sequentially
        let overallSuccess = true;
        const results = {};

        for (const config of activeConfigs) {
            const sheetId = config.sheetId;
            const addTrigger = config.addTrigger || 'first_message'; // Default trigger
            // Extract potential keywords, default to empty array if not present
            const interestKeywords = config.interestKeywords || []; 
            
            logger.info(`Processing message ${messageRef.path} against config for sheet ${sheetId} (User: ${uid}). Trigger: ${addTrigger}`);
            
            try {
                // --- Trigger Logic --- 
                let shouldProcess = false;
                let existingRowIndex = null;

                // Check if contact already exists BEFORE deciding to process based on trigger
                // Now 'googleService' should be accessible here
                existingRowIndex = await googleService.findContactRow(uid, config, contactPhoneNumber);

                // Get message text early for interest check if needed
                const messageText = messageData.message || '';

                if (addTrigger === 'first_message') {
                    // Process all messages for this trigger, let append/update logic handle existing rows.
                    shouldProcess = true;
                    logger.info(`Trigger 'first_message': Always processing. Append/Update decision based on contact existence (Row ${existingRowIndex}).`);
                } else if (addTrigger === 'Interest Detected') {
                    // Use the AI interest check
                    if (!messageText) {
                        logger.warn(`Message text is empty for ${messageRef.path}, cannot perform interest check for config ${sheetId}. Skipping.`);
                        results[sheetId] = { skipped: true, reason: 'Empty message for interest check' };
                        continue; // Skip to next config
                    }
                    
                    logger.debug(`Performing interest check for message: "${messageText}" using keywords: [${interestKeywords.join(', ')}]`);
                    const hasInterest = await checkInterest(messageText, interestKeywords);
                    logger.info(`Interest check result for ${messageRef.path} / ${sheetId}: ${hasInterest}`);

                    if (hasInterest) {
                         shouldProcess = true;
                         logger.info(`Interest detected, proceeding with data extraction and sheet update for config ${sheetId}.`);
                    } else {
                         shouldProcess = false; // Explicitly set to false
                         logger.info(`Skipping message ${messageRef.path} for config ${sheetId} due to lack of detected interest.`);
                         results[sheetId] = { skipped: true, reason: 'Interest not detected' };
                         continue; // Skip processing this config if no interest
                    }
                } else if (addTrigger === 'manual') {
                    logger.info(`Trigger 'manual': Skipping automatic processing for config ${sheetId}.`);
                    results[sheetId] = { skipped: true, reason: 'Manual trigger' };
                    continue; // Skip to the next config
                } else {
                     // Default or unknown trigger - treat as first_message for safety
                     logger.warn(`Unknown trigger '${addTrigger}' for config ${sheetId}. Treating as 'first_message' (process always).`);
                     shouldProcess = true; // Process always for unknown triggers too
                }

                if (!shouldProcess) {
                    // This should only be reached now if an error occurred or interest wasn't detected (and we used `continue`)
                    // Logging here might be redundant if the reason was already logged before the 'continue'.
                    // logger.warn(`Internal logic check: shouldProcess is false but loop did not continue for config ${sheetId}. Skipping.`); 
                    // results[sheetId] = { skipped: true, reason: 'Internal logic error or skipped trigger' }; // Redundant
                    continue; // Safeguard continue
                }
                // --- End Trigger Logic ---

                // 1. Call AI Service (Only if shouldProcess is true)
                // Message text is already available from trigger logic
                if (!messageText) { 
                     // This check might be slightly redundant if empty message skipped during interest check, but good safeguard
                     logger.warn(`Message text is empty for ${messageRef.path} after trigger logic, skipping AI extraction for config ${sheetId}`);
                     results[sheetId] = { skipped: true, reason: 'Empty message' };
                     continue; // Skip to next config if message is empty
                }
                
                const extractedData = await extractDataFromMessage(messageText, config.columns);
                logger.debug(`AI extracted data for ${messageRef.path} / ${sheetId}:`, extractedData);

                if (!extractedData || Object.keys(extractedData).length === 0) {
                    logger.warn(`AI extraction returned no data for ${messageRef.path} / ${sheetId}`);
                     results[sheetId] = { skipped: true, reason: 'AI returned no data' };
                     continue; // Skip to next config if AI returned nothing
                }

                // 2. Prepare Row Data (using column NAME as the key)
                const rowDataMap = {};
                config.columns.forEach(col => {
                    // Use AI extracted data if available and not null/undefined, otherwise default to empty string
                    rowDataMap[col.name] = extractedData[col.id] !== null && extractedData[col.id] !== undefined
                        ? String(extractedData[col.id])
                        : '';
                });

                // --- Improved Fallback Logic --- 
                // Check if specific columns need fallbacks AFTER AI extraction attempt
                config.columns.forEach(col => {
                     // Fallback for Phone Number
                    if (col.name === 'Phone Number' && (!rowDataMap[col.name] || rowDataMap[col.name] === 'N/A')) {
                         logger.debug(`Applying fallback for Phone Number column for ${contactPhoneNumber}`);
                         rowDataMap[col.name] = contactPhoneNumber;
                     }
                     // Fallback for Timestamp
                    if (col.name === 'Timestamp' && (!rowDataMap[col.name] || rowDataMap[col.name] === 'N/A')) {
                         const timestamp = messageDoc.createTime?.toDate().toISOString() || new Date().toISOString();
                         logger.debug(`Applying fallback for Timestamp column: ${timestamp}`);
                         rowDataMap[col.name] = timestamp;
                     }
                     // Fallback for Customer Name (using Chat Doc first, then User Doc)
                    if (col.name === 'Customer Name') {
                        const currentValue = rowDataMap[col.name];
                        // Check if current value is considered empty or a placeholder like 'N/A'
                        const needsFallback = currentValue === null || currentValue === undefined || currentValue === '' || String(currentValue).trim().toLowerCase() === 'n/a';
                
                        if (needsFallback) {
                            const nameFromChat = chatData?.contactName;
                            const nameFromUser = userData?.contactName || userData?.displayName; // Fallback to user data if chat name missing
                            const fallbackName = nameFromChat || nameFromUser; // Prioritize chat name
                
                            if (fallbackName) {
                                logger.debug(`Applying fallback for Customer Name: ${fallbackName} (Source: ${nameFromChat ? 'Chat Doc' : 'User Doc'})`);
                                rowDataMap[col.name] = fallbackName;
                            } else {
                                 logger.debug(`Fallback for Customer Name: No fallback name found in Chat Doc or User Doc.`);
                                 rowDataMap[col.name] = ''; // Ensure it's an empty string if no fallback
                            }
                        }
                        // If needsFallback is false, we keep the value extracted by the AI.
                    }
                });
                // --- End Improved Fallback Logic ---

                logger.debug(`Prepared row data for ${messageRef.path} / ${sheetId}:`, rowDataMap);

                // 3. Call Google Service (Append/Update)
                // Now 'googleService' should be accessible here too
                if (existingRowIndex !== null && existingRowIndex > 0) {
                    // Update logic
                    if (config.autoUpdateFields !== false) { 
                        logger.info(`Found existing contact ${contactPhoneNumber} at row ${existingRowIndex} in sheet ${sheetId}. Updating row...`);
                        await googleService.updateSheetRow(uid, config, existingRowIndex, rowDataMap);
                        results[sheetId] = { status: 'updated', row: existingRowIndex };
                    } else {
                        logger.info(`Found existing contact ${contactPhoneNumber} at row ${existingRowIndex} in sheet ${sheetId}, but autoUpdateFields is disabled. Skipping update.`);
                         results[sheetId] = { skipped: true, reason: 'Auto-update disabled' };
                    }
                } else {
                    // Append logic 
                    logger.info(`Contact ${contactPhoneNumber} not found in sheet ${sheetId}. Appending new row...`);
                    await googleService.appendSheetRow(uid, config, rowDataMap);
                    results[sheetId] = { status: 'appended' };
                }

            } catch (configError) { // Catch errors for this specific config
                logger.error(`Error processing config for sheet ${sheetId} on message ${messageRef.path}:`, { error: configError.message });
                overallSuccess = false;
                results[sheetId] = { error: configError.message };
                // Continue to the next config even if one fails
            }
        } // End loop through activeConfigs

        // Mark as processed based on overall success
        if (overallSuccess) {
             await markMessageProcessed(messageRef, uid, { success: true, details: results });
        } else {
             // If any config failed, mark the message with an error, but include details of successes/failures
             await markMessageProcessed(messageRef, uid, { error: 'One or more sheet configurations failed', details: results });
             // Re-throw the last error or a summary error? For now, just mark and log.
        }

    } catch (error) {
        logger.error(`CRITICAL: Failed to process message ${messageRef.path}. Error: ${error.message}`, { stack: error.stack, uid: uid || 'unknown' });
        // Mark as processed with error, even if UID extraction failed (use ref)
        await markMessageProcessed(messageRef, uid || messageRef.path.split('/')[1] || 'unknown_uid', { error: `Critical processing failure: ${error.message}` });
        // Do not re-throw, allow listener to continue
    }
};

/**
 * Handles errors from the Firestore listener.
 * @param {Error} error - The error object.
 */
const handleListenerError = (error) => {
    logger.error('CRITICAL: Firestore listener encountered an error:', error);
    // Potentially add monitoring/alerting here
    // Consider attempting to restart the listener after a delay?
    stopListening(); // Stop the current listener
    // Optional: Implement retry logic
    // setTimeout(startListening, 60000); // e.g., retry after 1 minute
};

/**
 * Handles incoming message snapshots from Firestore.
 * Processes added documents sequentially.
 * @param {admin.firestore.QuerySnapshot} snapshot - The snapshot object.
 */
const handleMessagesSnapshot = async (snapshot) => {
    // Log that the snapshot handler was triggered
    logger.info(`[Listener Callback] Snapshot received with ${snapshot.docChanges().length} changes.`);
    
    const changes = snapshot.docChanges().filter(change => change.type === 'added');

    if (changes.length > 0) {
         logger.info(`[Listener Callback] Found ${changes.length} new message document(s) to process.`);
    }

    // Process sequentially for simplicity and resource control
    for (const change of changes) {
        try {
            await processSingleMessage(change.doc);
        } catch (processingError) {
             // Errors within processSingleMessage should be caught and logged there,
             // but catch here just in case something unexpected escapes.
             logger.error(`Unhandled error during sequential processing of ${change.doc.ref.path}:`, processingError);
             // Mark as processed with error to avoid retrying? Already handled inside processSingleMessage.
        }
    }
};


/**
 * Starts the Firestore listener for new messages.
 */
const startListening = () => {
    if (listenerUnsubscribe) {
        logger.warn('Listener already running. Call stopListening() first.');
        return;
    }

    try {
        const db = admin.firestore();
        // Restore the filter for unprocessed messages
        // logger.warn("[DEBUG] Listener Query: Using unfiltered collectionGroup('messages') for debugging.");
        const query = db.collectionGroup('messages')
            .where('isProcessedByAutomation', '==', false); // <-- Uncommented filter
            // .orderBy('createdAt', 'asc'); // Keep orderBy commented for now, might cause index issues

        logger.info('Starting Firestore listener for messages where isProcessedByAutomation is false...'); // Updated log message

        listenerUnsubscribe = query.onSnapshot(handleMessagesSnapshot, handleListenerError);

        logger.info('Firestore message listener is active.');

    } catch (error) {
        logger.error('CRITICAL: Failed to initialize Firestore listener:', error);
        listenerUnsubscribe = null; // Ensure it's null if setup failed
        // Consider re-throwing or process.exit depending on desired behavior
         throw error; // Re-throw to be caught by index.js initialization block
    }
};

/**
 * Stops the Firestore listener.
 */
const stopListening = () => {
    if (listenerUnsubscribe) {
        logger.info('Stopping Firestore message listener...');
        listenerUnsubscribe();
        listenerUnsubscribe = null;
        logger.info('Firestore message listener stopped.');
    } else {
        logger.warn('Attempted to stop listener, but it was not running.');
    }
};

console.log('[DEBUG] messageProcessorService: Functions defined. Exporting...');

module.exports = {
    startListening,
    stopListening
    // Potentially export processSingleMessage for testing/manual triggering if needed
}; 

console.log('[DEBUG] services/messageProcessorService.js: END executing.'); // Log end of file execution 