console.log('[DEBUG] routes/googleSheets.js executing...');

/**
 * Routes for Google Sheets operations
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const admin = require('firebase-admin');
const axios = require('axios');
const logger = require('../utils/logger');
const googleService = require('../services/googleService');
const { google } = require('googleapis'); // Import googleapis library

const router = express.Router();

/**
 * Check Google Sheets connection status
 * GET /api/google-sheets/status
 * 
 * Verifies if the user has a valid Google Sheets connection
 * Protected route - requires authentication
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    const { uid } = req.user;
    
    const userDoc = await admin.firestore().collection('Users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ 
        status: 'error', 
        message: 'User not found' 
      });
    }
    
    const userData = userDoc.data();
    const hasGoogleSheets = Boolean(userData.credentials?.googleSheetsOAuth?.refreshToken);
    
    if (hasGoogleSheets) {
      // Attempt to get valid credentials to verify connection
      try {
        const credentials = await googleService.getValidCredentials(uid);
        return res.json({
          status: 'success',
          data: {
            connected: true,
            expiresAt: userData.credentials?.googleSheetsOAuth?.expiresAt,
            updatedAt: userData.credentials?.googleSheetsOAuth?.updatedAt,
            valid: Boolean(credentials?.access_token)
          }
        });
      } catch (credError) {
        logger.error(`Error validating Google credentials for user ${uid}:`, credError);
        return res.json({
          status: 'error',
          message: 'Connection exists but is invalid',
          data: {
            connected: true,
            valid: false,
            error: credError.message
          }
        });
      }
    }
    
    return res.json({
      status: 'success',
      data: {
        connected: false
      }
    });
  } catch (error) {
    logger.logError(error, req, 'Error checking Google Sheets status');
    // ADDED: Check for auth errors
    const errorMessage = error.message || '';
    if (
        (error.response && (error.response.status === 401 || error.response.status === 403)) ||
        errorMessage.includes('No valid Google credentials') ||
        errorMessage.includes('invalid or revoked') ||
        errorMessage.includes('Authentication failed')
    ) {
        return res.status(401).json({
            status: 'error',
            message: 'Google API authentication failed. Please try reconnecting your Google account.',
            error: errorMessage, 
        });
    }
    // Fallback for other errors
    return res.status(500).json({
      status: 'error',
      message: 'Failed to check Google Sheets connection',
      error: errorMessage
    });
  }
});

/**
 * Disconnect Google Sheets
 * POST /api/google-sheets/disconnect
 * 
 * Revokes access to Google Sheets and removes stored credentials
 * Protected route - requires authentication
 */
router.post('/disconnect', requireAuth, async (req, res) => {
  try {
    const { uid } = req.user;
    
    // Try to revoke access on Google's side if we have a valid token
    try {
      const credentials = await googleService.getCredentialsForUser(uid);
      if (credentials && credentials.access_token) {
        // Google API requires revoke requests to be sent as form-urlencoded
        const params = new URLSearchParams();
        params.append('token', credentials.access_token);
        
        await axios.post('https://oauth2.googleapis.com/revoke', params, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
        logger.info(`Successfully revoked Google token for user ${uid}`);
      }
    } catch (revokeError) {
      logger.warn(`Could not revoke Google token for user ${uid}:`, revokeError);
      // Continue anyway - we'll still remove it from our database
    }
    
    // Remove the credentials from Firestore
    await admin.firestore().collection('Users').doc(uid).update({
      'credentials.googleSheetsOAuth': admin.firestore.FieldValue.delete()
    });
    
    return res.json({
      status: 'success',
      message: 'Google Sheets disconnected successfully'
    });
  } catch (error) {
    logger.logError(error, req, 'Error disconnecting Google Sheets');
    // ADDED: Check for auth errors (less likely here, but good practice)
    const errorMessage = error.message || '';
    if (
        (error.response && (error.response.status === 401 || error.response.status === 403)) ||
        errorMessage.includes('No valid Google credentials') ||
        errorMessage.includes('invalid or revoked') ||
        errorMessage.includes('Authentication failed')
    ) {
        return res.status(401).json({
            status: 'error',
            message: 'Google API authentication failed during disconnect. Please try again or reconnect.',
            error: errorMessage, 
        });
    }
    // Fallback for other errors
    return res.status(500).json({
      status: 'error',
      message: 'Failed to disconnect Google Sheets',
      error: errorMessage
    });
  }
});

/**
 * Test Google Sheets connection
 * GET /api/google-sheets/test-connection
 * 
 * Makes a test request to the Google Sheets API to verify connectivity
 * Protected route - requires authentication
 */
router.get('/test-connection', requireAuth, async (req, res) => {
  try {
    const { uid } = req.user;
    
    // Get valid credentials
    const credentials = await googleService.getValidCredentials(uid);
    if (!credentials || !credentials.access_token) {
      return res.status(401).json({
        status: 'error',
        message: 'No valid Google credentials found'
      });
    }
    
    // Make a test request to the Google Drive API (more reliable for connection test)
    // Changed from sheets.googleapis.com/v4/spreadsheets
    const testUrl = 'https://www.googleapis.com/drive/v3/files?pageSize=1&fields=kind'; // Minimal query
    logger.debug(`Testing Google connection for user ${uid} with URL: ${testUrl}`);
    const response = await axios.get(testUrl, {
      headers: {
        Authorization: `Bearer ${credentials.access_token}`
      }
    });
    
    // Check if the response kind indicates success
    if (response.data && response.data.kind === 'drive#fileList') {
      logger.info(`Google connection test successful for user ${uid}`);
      return res.json({
        status: 'success',
        data: {
          connected: true
        }
      });
    } else {
       // If the response is unexpected, treat as failure
       logger.warn(`Unexpected response during Google connection test for user ${uid}:`, response.data);
       throw new Error('Unexpected response from Google API during connection test.');
    }

  } catch (error) {
    logger.logError(error, req, 'Error testing Google Sheets connection');
    
    const errorMessage = error.message || '';

    // Specific check for "No Credentials" case - return 200 OK
    if (errorMessage.includes('No Google credentials found for user')) {
        logger.info(`User ${req.user?.uid || 'unknown'} tested connection but has no Google credentials.`);
        return res.json({ 
            status: 'success', 
            data: { connected: false } 
        });
    }

    // Check for actual authentication errors - return 401 Unauthorized
    if (
        (error.response && (error.response.status === 401 || error.response.status === 403)) ||
        errorMessage.includes('invalid or revoked') ||
        errorMessage.includes('Authentication failed') ||
        errorMessage.includes('Google refresh token is invalid or revoked') // Added specific refresh token error
    ) {
        return res.status(401).json({
            status: 'error',
            message: 'Google API authentication failed during connection test. Please try reconnecting.',
            error: errorMessage, 
        });
    }
    
    // Fallback for other unexpected errors - return 500 Internal Server Error
    return res.status(500).json({
      status: 'error',
      message: 'Failed to test Google Sheets connection',
      error: errorMessage
    });
  }
});

/**
 * List user's Google Sheets
 * GET /api/google-sheets/list
 *
 * Fetches a list of spreadsheets accessible by the user's connected account.
 * Protected route - requires authentication
 */
router.get('/list', requireAuth, async (req, res) => {
  try {
    const { uid } = req.user;
    logger.info(`Fetching Google Sheets list for user ${uid}`);

    // Get valid credentials (handles decryption and refresh)
    const credentials = await googleService.getValidCredentials(uid);
    if (!credentials || !credentials.access_token) {
      logger.warn(`No valid Google credentials found for user ${uid} when listing sheets.`);
      return res.status(401).json({
        status: 'error',
        message: 'No valid Google credentials found. Please reconnect.',
      });
    }

    // Google Drive API call to list spreadsheets
    const driveApiUrl = 'https://www.googleapis.com/drive/v3/files';
    const queryParams = new URLSearchParams({
      q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
      fields: 'files(id,name,createdTime)',
      pageSize: 100, // Adjust as needed
    }).toString();

    logger.debug(`Calling Google Drive API for user ${uid}: ${driveApiUrl}?${queryParams}`);
    const response = await axios.get(`${driveApiUrl}?${queryParams}`, {
      headers: {
        Authorization: `Bearer ${credentials.access_token}`,
      },
    });

    const files = response.data.files || [];
    logger.info(`Successfully fetched ${files.length} sheets for user ${uid}`);

    return res.json({
      status: 'success',
      data: {
        files: files,
      },
    });
  } catch (error) {
    logger.logError(error, req, 'Error fetching Google Sheets list');
    // ADDED: Check for auth errors
    const errorMessage = error.message || '';
    if (
        (error.response && (error.response.status === 401 || error.response.status === 403)) ||
        errorMessage.includes('No valid Google credentials') ||
        errorMessage.includes('invalid or revoked') ||
        errorMessage.includes('Authentication failed')
    ) {
        return res.status(401).json({
            status: 'error',
            message: 'Google API authentication failed when listing sheets. Please try reconnecting.',
            error: errorMessage, 
        });
    }
    // Fallback for other errors
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch Google Sheets list',
      error: errorMessage
    });
  }
});

/**
 * Create a new Google Spreadsheet based on config
 * POST /api/google-sheets/spreadsheets
 * 
 * Expects config object in body: { name, columns: [{ name }] }
 * Protected route - requires authentication
 */
router.post('/spreadsheets', requireAuth, async (req, res) => {
  const { uid } = req.user;
  const config = req.body;
  
  if (!config || !config.name || !Array.isArray(config.columns) || config.columns.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Invalid configuration provided for sheet creation.' });
  }
  
  try {
    logger.info(`Creating new Google Sheet for user ${uid}, name: ${config.name}`);
    const sheets = await googleService.getAuthenticatedSheetsClient(uid);

    // 1. Create the spreadsheet
    const spreadsheet = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: config.name },
        sheets: [{ properties: { title: 'Customer Data' } }] // Default sheet name
      },
    });

    const newSheetId = spreadsheet.data.spreadsheetId;
    if (!newSheetId) {
        throw new Error('Failed to create spreadsheet: No ID returned from Google API.');
    }
    logger.info(`Created sheet ${newSheetId} for user ${uid}`);

    // 2. Set up the headers
    const headers = config.columns.map((col) => col.name || '');
    const headerRange = `Customer Data!A1:${String.fromCharCode(65 + headers.length - 1)}1`; // Assuming default sheet name

    await sheets.spreadsheets.values.update({
      spreadsheetId: newSheetId,
      range: headerRange,
      valueInputOption: 'USER_ENTERED', // or RAW
      requestBody: {
        values: [headers],
      },
    });
    logger.info(`Set headers for sheet ${newSheetId}`);

    return res.json({ status: 'success', data: { sheetId: newSheetId } });

  } catch (error) {
    logger.logError(error, req, 'Error creating Google Sheet');
    const errorMessage = error.message || '';
    // Check for specific Google API errors or auth errors
    if (
        (error.response && (error.response.status === 401 || error.response.status === 403)) ||
        errorMessage.includes('invalid or revoked') || // from getValidCredentials
        errorMessage.includes('Authentication failed')
    ) {
        return res.status(401).json({ status: 'error', message: 'Google API authentication failed. Please reconnect.', error: errorMessage });
    }
    // Check for quota errors specifically if possible
    // if (error.code === 429) { return res.status(429).json(...); }
    return res.status(500).json({ status: 'error', message: 'Failed to create Google Sheet', error: errorMessage });
  }
});

/**
 * Update headers for an existing Google Spreadsheet
 * PUT /api/google-sheets/spreadsheets/:sheetId/headers
 * 
 * Expects config object in body: { columns: [{ name }] }
 * Protected route - requires authentication
 */
router.put('/spreadsheets/:sheetId/headers', requireAuth, async (req, res) => {
  const { uid } = req.user;
  const { sheetId } = req.params;
  const config = req.body;

  if (!sheetId || !config || !Array.isArray(config.columns)) {
      return res.status(400).json({ status: 'error', message: 'Invalid request: Missing sheetId or columns configuration.' });
  }

  try {
    logger.info(`Updating headers for sheet ${sheetId}, user ${uid}`);
    const sheets = await googleService.getAuthenticatedSheetsClient(uid);

    const headers = config.columns.map((col) => col.name || '');
    // Assume headers are in the first row of the first sheet (common pattern)
    // We might need a way to get the actual first sheet name if it's not default
    const headerRange = `Sheet1!A1:${String.fromCharCode(65 + headers.length - 1)}1`; 

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: headerRange,
      valueInputOption: 'USER_ENTERED', // or RAW
      requestBody: {
        values: [headers],
      },
    });
    logger.info(`Updated headers for sheet ${sheetId}`);

    // Return success, indicating headers were updated (sheetId already known)
    return res.json({ status: 'success', data: { sheetId: sheetId } }); 

  } catch (error) {
    logger.logError(error, req, `Error updating headers for sheet ${sheetId}`);
    const errorMessage = error.message || '';
    if (
        (error.response && (error.response.status === 401 || error.response.status === 403)) ||
        errorMessage.includes('invalid or revoked') ||
        errorMessage.includes('Authentication failed')
    ) {
        return res.status(401).json({ status: 'error', message: 'Google API authentication failed. Please reconnect.', error: errorMessage });
    }
    return res.status(500).json({ status: 'error', message: 'Failed to update sheet headers', error: errorMessage });
  }
});

/**
 * Find a contact row index by phone number
 * POST /api/google-sheets/spreadsheets/:sheetId/find
 * 
 * Expects body: { phoneNumber }
 * Protected route - requires authentication
 */
router.post('/spreadsheets/:sheetId/find', requireAuth, async (req, res) => {
  const { uid } = req.user;
  const { sheetId } = req.params;
  const { phoneNumber } = req.body;

  if (!sheetId || !phoneNumber) {
    return res.status(400).json({ status: 'error', message: 'Missing sheetId or phoneNumber' });
  }

  try {
    logger.info(`Finding contact ${phoneNumber} in sheet ${sheetId} for user ${uid}`);

    // 1. Get Sheet Configuration from Firestore to find the phone column
    let phoneColumnIndex = -1;
    try {
      const userDoc = await admin.firestore().collection('Users').doc(uid).get();
      if (userDoc.exists) {
        const sheetConfigs = userDoc.data()?.workflows?.whatsapp_agent?.sheetConfigs || [];
        const config = sheetConfigs.find((c) => c.sheetId === sheetId);
        if (config && Array.isArray(config.columns)) {
          phoneColumnIndex = config.columns.findIndex(
            (col) => col.type === 'phone' || col.name?.toLowerCase().includes('phone')
          );
        }
      }
    } catch (fsError) {
      logger.error(`Firestore error getting config for sheet ${sheetId}, user ${uid}:`, fsError);
      throw new Error('Could not retrieve sheet configuration to find phone column.');
    }

    if (phoneColumnIndex === -1) {
      logger.warn(`No phone column configured for sheet ${sheetId}, user ${uid}. Cannot search.`);
      // Return null index, as we can't search without the column info
      return res.json({ status: 'success', data: { rowIndex: null } }); 
    }

    // 2. Get Authenticated Sheets Client
    const sheets = await googleService.getAuthenticatedSheetsClient(uid);

    // 3. Get Phone Column Data from Sheet
    const phoneColumnLetter = String.fromCharCode(65 + phoneColumnIndex);
    // Assume data is in the first sheet (Sheet1) - might need enhancement later
    const range = `Sheet1!${phoneColumnLetter}:${phoneColumnLetter}`;
    logger.debug(`Reading range ${range} from sheet ${sheetId}`);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: range,
    });

    // 4. Search for Phone Number
    let foundRowIndex = null; // Initialize as null
    const values = response.data.values;
    if (values) {
      // Start from index 1 to skip header row
      for (let i = 1; i < values.length; i++) {
        if (values[i] && values[i][0] === phoneNumber) {
          foundRowIndex = i + 1; // Google Sheets rows are 1-based
          break;
        }
      }
    }

    logger.info(`Search for ${phoneNumber} in sheet ${sheetId}: ${foundRowIndex ? `Found at row ${foundRowIndex}` : 'Not found'}`);
    return res.json({ status: 'success', data: { rowIndex: foundRowIndex } });

  } catch (error) {
    logger.logError(error, req, `Error finding contact ${phoneNumber} in sheet ${sheetId}`);
    const errorMessage = error.message || '';
    if (
        (error.response && (error.response.status === 401 || error.response.status === 403)) ||
        errorMessage.includes('invalid or revoked') ||
        errorMessage.includes('Authentication failed') ||
        errorMessage.includes('Could not retrieve valid Google credentials')
    ) {
        return res.status(401).json({ status: 'error', message: 'Google API authentication failed. Please reconnect.', error: errorMessage });
    }
    // Handle specific Google API errors like invalid range or sheet not found
    if (error.code === 400 || error.message.includes('Unable to parse range') || error.message.includes('Requested entity was not found')) {
       return res.status(400).json({ status: 'error', message: 'Error accessing Google Sheet. Check Sheet ID and configuration.', error: errorMessage });
    }
    return res.status(500).json({ status: 'error', message: 'Failed to find contact in Google Sheet', error: errorMessage });
  }
});

/**
 * Append a row to a Google Sheet
 * POST /api/google-sheets/spreadsheets/:sheetId/values:append
 * 
 * Expects body: { data: { columnId: value, ... } }
 * Protected route - requires authentication
 */
router.post('/spreadsheets/:sheetId/values:append', requireAuth, async (req, res) => {
  const { uid } = req.user;
  const { sheetId } = req.params;
  const { data } = req.body;

  if (!sheetId || !data || typeof data !== 'object') {
    return res.status(400).json({ status: 'error', message: 'Missing sheetId or row data' });
  }

  try {
    logger.info(`Appending row to sheet ${sheetId} for user ${uid}`);

    // 1. Get Sheet Configuration from Firestore to determine column order
    let columnMap = {}; // To map column ID to column Name
    let columnOrder = []; // Initialize as empty array
    try {
      const userDoc = await admin.firestore().collection('Users').doc(uid).get();
      if (userDoc.exists) {
        const sheetConfigs = userDoc.data()?.workflows?.whatsapp_agent?.sheetConfigs || [];
        const config = sheetConfigs.find((c) => c.sheetId === sheetId);
        if (config && Array.isArray(config.columns)) {
          // Create a map of { columnId: columnName }
          columnMap = config.columns.reduce((map, col) => {
            map[col.id] = col.name;
            return map;
          }, {});
          // Also get the order of column NAMES
          columnOrder = config.columns.map((col) => col.name);
        }
      }
    } catch (fsError) {
      logger.error(`Firestore error getting config for sheet ${sheetId}, user ${uid}:`, fsError);
      throw new Error('Could not retrieve sheet configuration to determine column order.');
    }

    if (columnOrder.length === 0) {
      logger.warn(`No columns configured for sheet ${sheetId}, user ${uid}. Cannot append row.`);
      throw new Error('Sheet configuration has no columns defined.');
    }

    // 2. Get Authenticated Sheets Client
    const sheets = await googleService.getAuthenticatedSheetsClient(uid);

    // 3. Prepare Row Data in Correct Order using Column Names
    // The incoming 'data' object from the frontend uses Column Names as keys.
    logger.debug('Received data for append:', data);
    logger.debug('Expected column order (by name):', columnOrder);
    const rowValues = columnOrder.map(columnName => data[columnName] !== undefined ? String(data[columnName]) : ''); // Map data using names, ensure string
    logger.debug('Prepared row values for API:', rowValues);

    // 4. Append Row to Sheet
    // Assume appending to the first sheet (Sheet1) - might need enhancement later
    const range = 'Sheet1!A1'; // Range for append usually just needs the sheet name
    logger.debug(`Appending row to sheet ${sheetId}, range ${range}`);

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: range,
      valueInputOption: 'USER_ENTERED', // Or RAW
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [rowValues],
      },
    });

    logger.info(`Successfully appended row to sheet ${sheetId}`);
    return res.json({ status: 'success', message: 'Row appended successfully' });

  } catch (error) {
    logger.logError(error, req, `Error appending row to sheet ${sheetId}`);
    const errorMessage = error.message || '';
    if (
        (error.response && (error.response.status === 401 || error.response.status === 403)) ||
        errorMessage.includes('invalid or revoked') ||
        errorMessage.includes('Authentication failed') ||
        errorMessage.includes('Could not retrieve valid Google credentials')
    ) {
        return res.status(401).json({ status: 'error', message: 'Google API authentication failed. Please reconnect.', error: errorMessage });
    }
    if (error.code === 400 || error.message.includes('Unable to parse range') || error.message.includes('Requested entity was not found')) {
       return res.status(400).json({ status: 'error', message: 'Error accessing Google Sheet. Check Sheet ID and configuration.', error: errorMessage });
    }
    return res.status(500).json({ status: 'error', message: 'Failed to append row to Google Sheet', error: errorMessage });
  }
});

module.exports = router; 