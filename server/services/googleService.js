console.log('[DEBUG] services/googleService.js executing...');

console.log('[DEBUG] googleService.js: PRE-CHECK Env Vars...');
console.log(`[DEBUG] GOOGLE_CLIENT_ID: ${process.env.GOOGLE_CLIENT_ID ? 'Set' : 'MISSING'}`);
console.log(`[DEBUG] GOOGLE_CLIENT_SECRET: ${process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'MISSING'}`);
console.log(`[DEBUG] GOOGLE_REDIRECT_URI: ${process.env.GOOGLE_REDIRECT_URI ? 'Set' : 'MISSING'}`);
console.log('[DEBUG] googleService.js: POST-CHECK Env Vars.');


console.log('[DEBUG] googleService.js: BEFORE require firebase-admin');
const admin = require('firebase-admin');
console.log('[DEBUG] googleService.js: AFTER require firebase-admin');

console.log('[DEBUG] googleService.js: BEFORE require googleapis');
const { google } = require('googleapis');
console.log('[DEBUG] googleService.js: AFTER require googleapis');

console.log('[DEBUG] googleService.js: BEFORE require crypto');
const crypto = require('crypto');
console.log('[DEBUG] googleService.js: AFTER require crypto');

console.log('[DEBUG] googleService.js: BEFORE require axios');
const axios = require('axios');
console.log('[DEBUG] googleService.js: AFTER require axios');

console.log('[DEBUG] googleService.js: BEFORE require logger');
const logger = require('../utils/logger');
console.log('[DEBUG] googleService.js: AFTER require logger');

console.log('[DEBUG] googleService.js: ALL Top-Level Requires Completed.');

/**
 * Google API service for handling OAuth tokens and API calls
 */

/**
 * Helper function to create an OAuth2 client instance.
 * Ensures required environment variables are present.
 */
const createOAuth2Client = () => {
    console.log('[DEBUG] googleService.js: ENTER createOAuth2Client'); // Log entry
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
        logger.error('[CRITICAL] Missing Google OAuth environment variables (ID, SECRET, or REDIRECT_URI). Cannot create OAuth2 client.');
        throw new Error('Google OAuth credentials missing in environment.');
    }
    try {
        console.log('[DEBUG] googleService.js: Attempting new google.auth.OAuth2 in createOAuth2Client');
        const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
        console.log('[DEBUG] googleService.js: OAuth2 client created successfully within function.'); // Changed log level
        return client;
    } catch (error) {
        logger.error('[CRITICAL] Failed to create OAuth2 client within function:', error);
        console.error('[CRITICAL] Failed to create OAuth2 client within function:', error); // Also log to console
        throw error; // Re-throw the error
    }
};

/**
 * Helper function to decrypt sensitive data
 */
function decryptData(encryptedData, iv, authTag, secret) {
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(secret, 'hex'),
      Buffer.from(iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    logger.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Helper function to encrypt sensitive data
 */
function encryptData(data, secret) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(secret, 'hex'), iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return {
    iv: iv.toString('hex'),
    encryptedData: encrypted,
    authTag
  };
}

/**
 * Get Google credentials for a user from Firestore
 * @param {string} userId - Firebase user ID
 * @returns {Promise<Object|null>} Google credentials or null if not found
 */
const getCredentialsForUser = async (userId) => {
  try {
    const userDoc = await admin.firestore().collection('Users').doc(userId).get();
    
    if (!userDoc.exists) {
      logger.warn(`User ${userId} not found in database`);
      return null;
    }
    
    const userData = userDoc.data();
    
    if (!userData.credentials?.googleSheetsOAuth) {
      logger.warn(`User ${userId} has no Google credentials`);
      return null;
    }
    
    const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('Encryption key not configured');
    }
    
    const googleOAuth = userData.credentials.googleSheetsOAuth;
    
    if (!googleOAuth.accessToken || !googleOAuth.refreshToken) {
      logger.warn(`User ${userId} has incomplete Google credentials`);
      return null;
    }
    
    // Decrypt access token
    const accessToken = decryptData(
      googleOAuth.accessToken.encryptedData,
      googleOAuth.accessToken.iv,
      googleOAuth.accessToken.authTag,
      encryptionKey
    );
    
    // Decrypt refresh token
    const refreshToken = decryptData(
      googleOAuth.refreshToken.encryptedData,
      googleOAuth.refreshToken.iv,
      googleOAuth.refreshToken.authTag,
      encryptionKey
    );
    
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: googleOAuth.expiresAt,
      updated_at: googleOAuth.updatedAt
    };
  } catch (error) {
    logger.error(`Error getting Google credentials for user ${userId}:`, error);
    throw new Error(`Failed to get Google credentials: ${error.message}`);
  }
};

/**
 * Check if token is expired and refresh if needed
 * @param {string} userId - Firebase user ID
 * @returns {Promise<Object>} Valid credentials with access_token
 */
const getValidCredentials = async (userId) => {
  try {
    const credentials = await getCredentialsForUser(userId);
    
    if (!credentials) {
      throw new Error('No Google credentials found for user');
    }
    
    const { access_token, refresh_token, expiry_date } = credentials;
    
    // Check if token is expired (with 5 minute buffer)
    const isExpired = Date.now() >= (expiry_date - 300000);
    
    if (isExpired && refresh_token) {
      logger.info(`Refreshing Google token for user ${userId}`);
      
      // Create client here when needed
      const oauth2Client = createOAuth2Client(); 
      oauth2Client.setCredentials({ refresh_token: refresh_token });

      try {
        // Use the client instance to refresh
        const { credentials: newCredentials } = await oauth2Client.refreshAccessToken();
        const new_access_token = newCredentials.access_token;
        const expires_in = (newCredentials.expiry_date - Date.now()) / 1000; // Calculate remaining seconds
        
        if (!new_access_token) {
            throw new Error('Refresh token request succeeded but did not return an access token.');
        }

        logger.info(`Successfully refreshed Google token for user ${userId}`);
        
        // Update token in database
        await updateCredentialsInDb(userId, new_access_token, expires_in);
        
        return {
          access_token: new_access_token,
          refresh_token: refresh_token // Return original refresh token
        };
      } catch (refreshError) {
        // Log specific error details from Google
        const googleErrorData = refreshError.response?.data;
        logger.error(`Failed to refresh Google token for user ${userId}. Google API Error:`, {
          status: refreshError.response?.status,
          data: googleErrorData,
          message: refreshError.message
        });
        // Throw a more specific error
        if (googleErrorData?.error === 'invalid_grant') {
          throw new Error('Google refresh token is invalid or revoked. User needs to reconnect.');
        } else {
          throw new Error(`Failed to refresh Google token: ${googleErrorData?.error_description || refreshError.message}`);
        }
      }
    }
    
    return credentials;
  } catch (error) {
    logger.error(`Error getting valid Google credentials for user ${userId}:`, error);
    throw new Error(`Failed to get valid Google credentials: ${error.message}`);
  }
};

/**
 * Update Google credentials in Firestore
 * @param {string} userId - Firebase user ID
 * @param {string} accessToken - New access token
 * @param {number} expiresIn - Expiration time in seconds
 */
const updateCredentialsInDb = async (userId, accessToken, expiresIn) => {
  try {
    const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('Encryption key not configured');
    }
    
    // Encrypt the new access token
    const encryptedAccessToken = encryptData(accessToken, encryptionKey);
    
    // Calculate new expiration time
    const expiresAt = Date.now() + (expiresIn * 1000);
    
    await admin.firestore().collection('Users').doc(userId).update({
      'credentials.googleSheetsOAuth.accessToken': encryptedAccessToken,
      'credentials.googleSheetsOAuth.expiresAt': expiresAt,
      'credentials.googleSheetsOAuth.updatedAt': Date.now()
    });
    
    logger.info(`Updated Google credentials for user ${userId}`);
  } catch (error) {
    logger.error(`Error updating Google credentials for user ${userId}:`, error);
    throw new Error(`Failed to update Google credentials: ${error.message}`);
  }
};

/**
 * Exchange authorization code for tokens
 * @param {string} code - Authorization code from Google OAuth
 * @param {string} redirectUri - Redirect URI used in the OAuth flow
 * @returns {Promise<Object>} OAuth tokens
 */
const exchangeCodeForTokens = async (code, redirectUri) => {
  try {
    if (!code) {
      throw new Error('Missing authorization code for token exchange');
    }
    // Note: redirectUri is passed from the caller (googleOAuth.js) which should match the one used for auth URL generation
    logger.debug(`Exchanging code for tokens with redirectUri: ${redirectUri}`);

    // Create client here when needed
    const oauth2Client = createOAuth2Client(); 

    const { tokens } = await oauth2Client.getToken({
      code: code,
      redirect_uri: redirectUri // Pass the redirectUri here
    });
    logger.info('Successfully exchanged code for tokens.');
    return tokens;
  } catch (error) {
    logger.error('Error exchanging authorization code for tokens:', {
      errorMessage: error.message,
      response: error.response?.data, // Log Google's response if available
    });
    // Provide a more specific error message if possible
    const googleError = error.response?.data?.error;
    const googleErrorDesc = error.response?.data?.error_description;
    if (googleError === 'invalid_grant') {
        throw new Error(`Failed to exchange code: Invalid authorization code or redirect URI mismatch. ${googleErrorDesc || ''}`.trim());
    } else if (googleError) {
        throw new Error(`Failed to exchange code: ${googleError} - ${googleErrorDesc || error.message}`);
    } else {
        throw new Error(`Failed to exchange code: ${error.message}`);
    }
  }
};

/**
 * Creates an OAuth2 client instance and sets the user's credentials.
 * @param {object} credentials - The user's credentials (access_token, refresh_token).
 * @returns {google.auth.OAuth2} Authenticated OAuth2 client.
 */
const createOAuth2ClientWithCredentials = (credentials) => {
    if (!credentials || !credentials.access_token) {
        throw new Error('Cannot create authenticated client without valid credentials (access token).');
    }
    const oauth2Client = createOAuth2Client(); // Use the helper
    oauth2Client.setCredentials(credentials);
    logger.debug('Created OAuth2 client with user credentials.');
    return oauth2Client;
};

/**
 * Gets an authenticated Google Sheets API client for a user.
 * Handles fetching valid credentials and setting up the client.
 * @param {string} userId - Firebase user ID
 * @returns {Promise<google.sheets_v4.Sheets>} Authenticated Sheets client instance
 */
const getAuthenticatedSheetsClient = async (userId) => {
  try {
    logger.debug(`Getting authenticated sheets client for user ${userId}`);
    const credentials = await getValidCredentials(userId);
    if (!credentials || !credentials.access_token) {
      throw new Error('Could not retrieve valid Google credentials for Sheets API client.');
    }
    const oauth2Client = createOAuth2ClientWithCredentials(credentials);
    const sheetsClient = google.sheets({ version: 'v4', auth: oauth2Client });
    logger.debug(`Authenticated sheets client ready for user ${userId}`);
    return sheetsClient;
  } catch (error) {
    logger.error(`Failed to get authenticated Sheets client for user ${userId}:`, error);
    // Re-throw the error, possibly wrapping it if needed
    throw new Error(`Failed to initialize Google Sheets client: ${error.message}`); 
  }
};

/**
 * Finds the row index of a contact in a Google Sheet based on phone number.
 * @param {string} uid - Firebase user ID.
 * @param {object} config - The sheet configuration object from Firestore.
 * @param {string} phoneNumber - The phone number to search for.
 * @returns {Promise<number|null>} The 1-based row index if found, otherwise null.
 */
const findContactRow = async (uid, config, phoneNumber) => {
    if (!config || !config.sheetId || !config.columns || !phoneNumber) {
        logger.warn(`Invalid arguments for findContactRow for user ${uid}`);
        return null;
    }

    // Find the column configuration for the phone number
    // Assume a standard name like 'Phone Number' or check config for a specific type/id
    const phoneColumnConfig = config.columns.find(col => col.name === 'Phone Number' || col.type === 'phone'); // Adjust logic as needed
    if (!phoneColumnConfig) {
        logger.warn(`No 'Phone Number' column configured in sheet ${config.sheetId} for user ${uid}. Cannot search.`);
        return null; // Cannot find if we don't know which column to search
    }

    // Determine the column letter (simple A, B, C... for now)
    // This is a simplification. A robust solution maps column names to letters or uses A1 notation ranges.
    const phoneColumnIndex = config.columns.findIndex(col => col.id === phoneColumnConfig.id);
    if (phoneColumnIndex === -1) {
         logger.warn(`Phone column config found but index mismatch in sheet ${config.sheetId} for user ${uid}.`);
         return null;
    }
    const phoneColumnLetter = String.fromCharCode(65 + phoneColumnIndex); // A=0, B=1, etc.

    try {
        const sheets = await getAuthenticatedSheetsClient(uid);
        const range = `Sheet1!${phoneColumnLetter}:${phoneColumnLetter}`; // Search entire column
        logger.debug(`Searching for ${phoneNumber} in range ${range} of sheet ${config.sheetId} for user ${uid}`);

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: config.sheetId,
            range: range,
        });

        const values = response.data.values;
        if (values) {
            // Find the index (add 1 because Sheets rows are 1-based)
            const rowIndex = values.findIndex(row => row[0] === phoneNumber);
            if (rowIndex !== -1) {
                logger.debug(`Found ${phoneNumber} at row ${rowIndex + 1} in sheet ${config.sheetId}`);
                return rowIndex + 1;
            }
        }
        logger.debug(`${phoneNumber} not found in sheet ${config.sheetId}`);
        return null;
    } catch (error) {
        logger.error(`Error finding contact ${phoneNumber} in sheet ${config.sheetId} for user ${uid}:`, error.response?.data || error.message);
        // Consider specific error handling, e.g., 404 for sheet not found, 403 for permissions
        if (error.code === 403 || error.message.includes('permission')) {
             throw new Error(`Permission denied accessing sheet ${config.sheetId}. Please check Google permissions.`);
        } else if (error.code === 404 || error.message.includes('Requested entity was not found')) {
             throw new Error(`Sheet ${config.sheetId} not found or inaccessible.`);
        }
        throw new Error(`Failed to search sheet ${config.sheetId}: ${error.message}`);
    }
};

/**
 * Appends a row of data to a Google Sheet.
 * @param {string} uid - Firebase user ID.
 * @param {object} config - The sheet configuration object from Firestore.
 * @param {object} rowDataMap - An object mapping column names to values.
 * @returns {Promise<void>}
 */
const appendSheetRow = async (uid, config, rowDataMap) => {
    if (!config || !config.sheetId || !config.columns || !rowDataMap) {
        throw new Error(`Invalid arguments for appendSheetRow for user ${uid}`);
    }

    try {
        const sheets = await getAuthenticatedSheetsClient(uid);

        // Ensure row data is in the correct order based on config.columns
        const rowValues = config.columns.map(col => rowDataMap[col.name] !== undefined ? rowDataMap[col.name] : ''); // Use name as key

        const range = 'Sheet1!A1'; // Append to the first sheet, starting at A1 tells Sheets to find the end
        logger.info(`Appending row to sheet ${config.sheetId} for user ${uid}. Range: ${range}`);
        logger.debug(`Row values being appended: ${JSON.stringify(rowValues)}`);

        await sheets.spreadsheets.values.append({
            spreadsheetId: config.sheetId,
            range: range,
            valueInputOption: 'USER_ENTERED', // Interpret values as if typed by user
            insertDataOption: 'INSERT_ROWS', // Insert new rows for the data
            requestBody: {
                values: [rowValues], // API expects an array of rows
            },
        });
        logger.info(`Successfully appended row to sheet ${config.sheetId} for user ${uid}`);
    } catch (error) {
        logger.error(`Error appending row to sheet ${config.sheetId} for user ${uid}:`, error.response?.data || error.message);
         if (error.code === 403 || error.message.includes('permission')) {
             throw new Error(`Permission denied writing to sheet ${config.sheetId}. Please check Google permissions.`);
        } else if (error.code === 404 || error.message.includes('Requested entity was not found')) {
             throw new Error(`Sheet ${config.sheetId} not found or inaccessible for append.`);
        }
        throw new Error(`Failed to append to sheet ${config.sheetId}: ${error.message}`);
    }
};

/**
 * Updates a specific row in a Google Sheet.
 * @param {string} uid - Firebase user ID.
 * @param {object} config - The sheet configuration object from Firestore.
 * @param {number} rowIndex - The 1-based index of the row to update.
 * @param {object} rowDataMap - An object mapping column names to values for update.
 * @returns {Promise<void>}
 */
const updateSheetRow = async (uid, config, rowIndex, rowDataMap) => {
     if (!config || !config.sheetId || !config.columns || !rowDataMap || !rowIndex || rowIndex < 1) {
        throw new Error(`Invalid arguments for updateSheetRow for user ${uid}`);
    }

    try {
        const sheets = await getAuthenticatedSheetsClient(uid);

        // Ensure row data is in the correct order based on config.columns
        const rowValues = config.columns.map(col => rowDataMap[col.name] !== undefined ? rowDataMap[col.name] : ''); // Use name as key

        // Determine the range to update, e.g., 'Sheet1!A5:C5'
        const startColumnLetter = 'A';
        const endColumnLetter = String.fromCharCode(65 + config.columns.length - 1);
        const range = `Sheet1!${startColumnLetter}${rowIndex}:${endColumnLetter}${rowIndex}`;

        logger.info(`Updating row ${rowIndex} in sheet ${config.sheetId} for user ${uid}. Range: ${range}`);
        logger.debug(`Row values for update: ${JSON.stringify(rowValues)}`);


        await sheets.spreadsheets.values.update({
            spreadsheetId: config.sheetId,
            range: range,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [rowValues],
            },
        });
         logger.info(`Successfully updated row ${rowIndex} in sheet ${config.sheetId} for user ${uid}`);
    } catch (error) {
        logger.error(`Error updating row ${rowIndex} in sheet ${config.sheetId} for user ${uid}:`, error.response?.data || error.message);
         if (error.code === 403 || error.message.includes('permission')) {
             throw new Error(`Permission denied updating sheet ${config.sheetId}. Please check Google permissions.`);
        } else if (error.code === 404 || error.message.includes('Requested entity was not found')) {
             throw new Error(`Sheet ${config.sheetId} not found or inaccessible for update.`);
        }
        throw new Error(`Failed to update row ${rowIndex} in sheet ${config.sheetId}: ${error.message}`);
    }
};

module.exports = {
  getCredentialsForUser,
  getValidCredentials,
  updateCredentialsInDb,
  exchangeCodeForTokens,
  createOAuth2ClientWithCredentials,
  getAuthenticatedSheetsClient,
  findContactRow,
  appendSheetRow,
  updateSheetRow
};

console.log('[DEBUG] googleService.js: Module export complete.'); 