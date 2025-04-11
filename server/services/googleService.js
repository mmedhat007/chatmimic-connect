console.log('[DEBUG] services/googleService.js executing...');

/**
 * Google API service for handling OAuth tokens and API calls
 */
const admin = require('firebase-admin');
const { google } = require('googleapis');
const crypto = require('crypto');
const axios = require('axios');
const logger = require('../utils/logger');

console.log('[DEBUG] googleService.js: Logging env vars for OAuth2 client...');
console.log(`[DEBUG] GOOGLE_CLIENT_ID: ${process.env.GOOGLE_CLIENT_ID ? 'Set' : 'MISSING'}`);
console.log(`[DEBUG] GOOGLE_CLIENT_SECRET: ${process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'MISSING'}`);
console.log(`[DEBUG] GOOGLE_REDIRECT_URI: ${process.env.GOOGLE_REDIRECT_URI ? 'Set' : 'MISSING'}`);

// OAuth2 client setup
console.log('[DEBUG] googleService.js: About to create OAuth2 client...');
try {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  console.log('[DEBUG] googleService.js: OAuth2 client created successfully.');
} catch (oauthError) {
  console.error('[CRITICAL] Failed to create OAuth2 client:', oauthError);
  throw oauthError;
}

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
      
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      
      if (!clientId || !clientSecret) {
        throw new Error('Google OAuth client credentials (ID or SECRET) not configured on server.');
      }
      
      try {
        const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refresh_token,
          grant_type: 'refresh_token'
        }, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        const { access_token: new_access_token, expires_in } = tokenResponse.data;
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
    if (!code || !redirectUri) {
      throw new Error('Missing required parameters for token exchange');
    }
    
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials not configured');
    }
    
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    return tokenResponse.data;
  } catch (error) {
    logger.error('Error exchanging code for tokens:', error);
    throw new Error(`Failed to exchange code for tokens: ${error.message}`);
  }
};

/**
 * Creates an authenticated OAuth2 client instance for a user.
 * IMPORTANT: Ensure credentials have a valid access_token before calling.
 * @param {Object} credentials - User credentials containing access_token, refresh_token.
 * @returns {google.auth.OAuth2} Authenticated OAuth2 client
 */
const createOAuth2ClientWithCredentials = (credentials) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google OAuth client credentials not configured on server.');
  }

  const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  client.setCredentials(credentials); // Set the user-specific tokens
  return client;
};

/**
 * Gets an authenticated Google Sheets API client for a user.
 * Handles fetching valid credentials and setting up the client.
 * @param {string} userId - Firebase user ID
 * @returns {Promise<google.sheets_v4.Sheets>} Authenticated Sheets client instance
 */
const getAuthenticatedSheetsClient = async (userId) => {
  try {
    const credentials = await getValidCredentials(userId);
    if (!credentials || !credentials.access_token) {
      throw new Error('Could not retrieve valid Google credentials for Sheets API client.');
    }
    const authClient = createOAuth2ClientWithCredentials(credentials);
    return google.sheets({ version: 'v4', auth: authClient });
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