// server/services/messageProcessorService.js
const admin = require('firebase-admin');
const logger = require('../utils/logger');
const aiService = require('./aiService');
const googleService = require('./googleService');

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
         if (messageData.sender !== 'user') {
            logger.debug(`Skipping non-user message: ${messageRef.path}, sender: ${messageData.sender}`);
            await markMessageProcessed(messageRef, uid, { skipped: true, reason: 'Sender is not user' });
            return;
        }

        // Fetch User Config & Credentials
        const userRef = admin.firestore().collection('Users').doc(uid);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            throw new Error(`User document not found for UID: ${uid}`);
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
            logger.info(`Processing message ${messageRef.path} against config for sheet ${sheetId} (User: ${uid})`);
            try {
                // 1. Call AI Service
                const messageText = messageData.message || '';
                if (!messageText) {
                     logger.warn(`Message text is empty for ${messageRef.path}, skipping AI extraction for config ${sheetId}`);
                     results[sheetId] = { skipped: true, reason: 'Empty message' };
                     continue; // Skip to next config if message is empty
                }
                
                const extractedData = await aiService.extractDataFromMessage(messageText, config.columns);
                logger.debug(`AI extracted data for ${messageRef.path} / ${sheetId}:`, extractedData);

                if (!extractedData || Object.keys(extractedData).length === 0) {
                    logger.warn(`AI extraction returned no data for ${messageRef.path} / ${sheetId}`);
                     results[sheetId] = { skipped: true, reason: 'AI returned no data' };
                     continue; // Skip to next config if AI returned nothing
                }

                // 2. Prepare Row Data (using column NAME as the key)
                // We need the config to know the expected columns and their order
                const rowDataMap = {};
                config.columns.forEach(col => {
                    // Default to empty string if not extracted or null/undefined
                    rowDataMap[col.name] = extractedData[col.id] !== null && extractedData[col.id] !== undefined
                        ? String(extractedData[col.id]) // Ensure string conversion
                        : '';
                });

                // Add default/auto-populated fields if needed (e.g., Phone Number, Timestamp)
                 if (!rowDataMap['Phone Number'] && !config.columns.some(c => c.name === 'Phone Number')) {
                    rowDataMap['Phone Number'] = contactPhoneNumber; // Add if not explicitly extracted/defined
                 }
                 if (!rowDataMap['Timestamp'] && !config.columns.some(c => c.name === 'Timestamp')) {
                    rowDataMap['Timestamp'] = messageDoc.createTime?.toDate().toISOString() || new Date().toISOString(); // Add if not explicitly extracted/defined
                 }


                logger.debug(`Prepared row data for ${messageRef.path} / ${sheetId}:`, rowDataMap);

                // 3. Call Google Service
                // Find existing row by phone number (requires config to know which column is phone)
                const rowIndex = await googleService.findContactRow(uid, config, contactPhoneNumber); // Pass full config

                if (rowIndex !== null && rowIndex > 0) {
                    logger.info(`Found existing contact ${contactPhoneNumber} at row ${rowIndex} in sheet ${sheetId}. Updating row...`);
                    await googleService.updateSheetRow(uid, config, rowIndex, rowDataMap); // Pass full config
                    results[sheetId] = { status: 'updated', row: rowIndex };
                } else {
                    logger.info(`Contact ${contactPhoneNumber} not found in sheet ${sheetId}. Appending new row...`);
                    await googleService.appendSheetRow(uid, config, rowDataMap); // Pass full config
                    results[sheetId] = { status: 'appended' };
                }

            } catch (configError) {
                logger.error(`Error processing config for sheet ${sheetId} on message ${messageRef.path}:`, { error: configError.message });
                overallSuccess = false;
                results[sheetId] = { error: configError.message };
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
    const changes = snapshot.docChanges().filter(change => change.type === 'added');

    if (changes.length > 0) {
         logger.info(`Received ${changes.length} new message(s) to process.`);
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
        const query = db.collectionGroup('messages')
            .where('isProcessedByAutomation', '==', false)
            // .where('sender', '==', 'user') // Filter here OR inside processSingleMessage
            .orderBy('createdAt', 'asc'); // Process in rough order of creation

        logger.info('Starting Firestore listener for unprocessed user messages...');

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

module.exports = {
    startListening,
    stopListening
    // Potentially export processSingleMessage for testing/manual triggering if needed
}; 