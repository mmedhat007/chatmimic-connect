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
    logger.error(`Error checking Google Sheets status for user ${req.user.uid}:`, error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to check Google Sheets connection',
      error: error.message
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
    logger.error(`Error disconnecting Google Sheets for user ${req.user.uid}:`, error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to disconnect Google Sheets',
      error: error.message
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
    
    // Make a test request to the Google Sheets API
    const response = await axios.get('https://sheets.googleapis.com/v4/spreadsheets?pageSize=5', {
      headers: {
        Authorization: `Bearer ${credentials.access_token}`
      }
    });
    
    return res.json({
      status: 'success',
      data: {
        connected: true,
        files: response.data.files || []
      }
    });
  } catch (error) {
    logger.error(`Error testing Google Sheets connection for user ${req.user.uid}:`, error);
    return res.status(401).json({
      status: 'error',
      message: 'Failed to test Google Sheets connection',
      error: error.message
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
    logger.error(`Error fetching Google Sheets list for user ${req.user.uid}:`, error.response?.data || error.message || error);
    // Handle potential token errors specifically
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        return res.status(401).json({
            status: 'error',
            message: 'Google API authentication failed. Please try reconnecting your Google account.',
            error: error.response.data?.error?.message || 'Authentication error',
        });
    }
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch Google Sheets list',
      error: error.message,
    });
  }
});

/**
 * Create a new Google Sheet based on config
 * POST /api/google-sheets/create
 * 
 * Creates a sheet and sets up headers.
 * Protected route - requires authentication
 * Body: { config: SheetConfig } // SheetConfig should include columns
 */
router.post('/create', requireAuth, async (req, res) => {
  const { uid } = req.user;
  const { config } = req.body;

  if (!config || !config.name || !Array.isArray(config.columns) || config.columns.length === 0) {
    return res.status(400).json({ status: 'error', message: 'Invalid sheet configuration provided.' });
  }

  try {
    logger.info(`Creating new Google Sheet for user ${uid}, config name: ${config.name}`);
    const credentials = await googleService.getValidCredentials(uid);
    const accessToken = credentials?.access_token;

    if (!accessToken) {
      logger.warn(`No valid Google token for sheet creation, user ${uid}`);
      return res.status(401).json({ status: 'error', message: 'Invalid or missing Google credentials.' });
    }

    // 1. Create the spreadsheet
    logger.debug(`Calling Google Sheets API to create spreadsheet: ${config.name}`);
    const createResponse = await axios.post(
      'https://sheets.googleapis.com/v4/spreadsheets',
      {
        properties: { title: config.name },
        sheets: [{ properties: { title: 'Sheet1' } }] // Default sheet name
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const newSheetId = createResponse.data.spreadsheetId;
    logger.info(`Spreadsheet created successfully for user ${uid}, ID: ${newSheetId}`);

    // 2. Set up headers
    const headers = config.columns.map(col => col.name);
    const headerRange = `Sheet1!A1:${String.fromCharCode(65 + headers.length - 1)}1`;
    logger.debug(`Setting headers for sheet ${newSheetId}: ${headerRange}`);
    
    await axios.put(
      `https://sheets.googleapis.com/v4/spreadsheets/${newSheetId}/values/${encodeURIComponent(headerRange)}?valueInputOption=RAW`,
      {
        range: headerRange,
        majorDimension: 'ROWS',
        values: [headers]
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    logger.debug(`Headers set successfully for sheet ${newSheetId}`);

    // Return the new sheet ID
    res.json({ 
      status: 'success', 
      data: { 
        sheetId: newSheetId, 
        spreadsheetUrl: createResponse.data.spreadsheetUrl 
      } 
    });

  } catch (error) {
    logger.error(`Error creating Google Sheet for user ${uid}:`, error.response?.data || error.message || error);
    const status = error.response?.status || 500;
    const message = error.response?.data?.error?.message || error.message || 'Failed to create Google Sheet.';
    res.status(status).json({ 
      status: 'error', 
      message: message,
      error: error.response?.data?.error 
    });
  }
});

/**
 * Append a row to a Google Sheet
 * POST /api/google-sheets/append-row
 * 
 * Appends data according to the sheet configuration.
 * Protected route - requires authentication
 * Body: { sheetId: string, rowData: Record<string, string> } // rowData keys are column IDs
 */
router.post('/append-row', requireAuth, async (req, res) => {
  const { uid } = req.user;
  const { sheetId, rowData } = req.body;

  if (!sheetId || !rowData || typeof rowData !== 'object') {
    return res.status(400).json({ status: 'error', message: 'Missing sheetId or rowData.' });
  }

  try {
    logger.info(`Appending row to sheet ${sheetId} for user ${uid}`);
    const credentials = await googleService.getValidCredentials(uid);
    const accessToken = credentials?.access_token;

    if (!accessToken) {
      logger.warn(`No valid Google token for appending row, user ${uid}, sheet ${sheetId}`);
      return res.status(401).json({ status: 'error', message: 'Invalid or missing Google credentials.' });
    }

    // Get sheet config to order the values correctly
    const userDoc = await admin.firestore().collection('Users').doc(uid).get();
    const sheetConfigs = userDoc.data()?.workflows?.whatsapp_agent?.sheetConfigs || [];
    const config = sheetConfigs.find(c => c.sheetId === sheetId);

    if (!config || !Array.isArray(config.columns)) {
      return res.status(404).json({ status: 'error', message: `Configuration for sheet ${sheetId} not found or invalid.` });
    }

    const values = config.columns.map(col => rowData[col.id] || '');

    logger.debug(`Calling Google Sheets API to append row to sheet ${sheetId}`);
    const appendResponse = await axios.post(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        range: 'Sheet1!A1', // Append after the last row in Sheet1
        majorDimension: 'ROWS',
        values: [values]
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    logger.debug(`Row appended successfully to sheet ${sheetId}`);

    res.json({ status: 'success', data: appendResponse.data });

  } catch (error) {
    logger.error(`Error appending row to sheet ${sheetId} for user ${uid}:`, error.response?.data || error.message || error);
    const status = error.response?.status || 500;
    const message = error.response?.data?.error?.message || error.message || 'Failed to append row.';
    res.status(status).json({ 
      status: 'error', 
      message: message,
      error: error.response?.data?.error 
    });
  }
});

/**
 * Update a row in a Google Sheet
 * PUT /api/google-sheets/update-row
 * 
 * Updates specific cells in a given row.
 * Protected route - requires authentication
 * Body: { sheetId: string, rowIndex: number, updates: Record<string, string> } // updates keys are column IDs, rowIndex is 1-based
 */
router.put('/update-row', requireAuth, async (req, res) => {
  const { uid } = req.user;
  const { sheetId, rowIndex, updates } = req.body;

  if (!sheetId || !rowIndex || !updates || typeof updates !== 'object' || typeof rowIndex !== 'number' || rowIndex < 1) {
    return res.status(400).json({ status: 'error', message: 'Missing or invalid sheetId, rowIndex, or updates.' });
  }

  try {
    logger.info(`Updating row ${rowIndex} in sheet ${sheetId} for user ${uid}`);
    const credentials = await googleService.getValidCredentials(uid);
    const accessToken = credentials?.access_token;

    if (!accessToken) {
       logger.warn(`No valid Google token for updating row, user ${uid}, sheet ${sheetId}`);
      return res.status(401).json({ status: 'error', message: 'Invalid or missing Google credentials.' });
    }

    // Get sheet config to map column IDs to letters
    const userDoc = await admin.firestore().collection('Users').doc(uid).get();
    const sheetConfigs = userDoc.data()?.workflows?.whatsapp_agent?.sheetConfigs || [];
    const config = sheetConfigs.find(c => c.sheetId === sheetId);

    if (!config || !Array.isArray(config.columns)) {
      return res.status(404).json({ status: 'error', message: `Configuration for sheet ${sheetId} not found or invalid.` });
    }

    const requests = [];
    for (const [columnId, value] of Object.entries(updates)) {
      const columnIndex = config.columns.findIndex(col => col.id === columnId);
      if (columnIndex !== -1) {
        const columnLetter = String.fromCharCode(65 + columnIndex);
        const range = `Sheet1!${columnLetter}${rowIndex}`;
        requests.push({
          range: range,
          values: [[value]] // Value needs to be in a 2D array
        });
      }
    }

    if (requests.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No valid column updates provided.' });
    }

    logger.debug(`Calling Google Sheets API to batch update values in sheet ${sheetId}`);
    const batchUpdateResponse = await axios.post(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`,
      {
        valueInputOption: 'USER_ENTERED',
        data: requests
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    logger.debug(`Batch update successful for row ${rowIndex} in sheet ${sheetId}`);

    res.json({ status: 'success', data: batchUpdateResponse.data });

  } catch (error) {
    logger.error(`Error updating row ${rowIndex} in sheet ${sheetId} for user ${uid}:`, error.response?.data || error.message || error);
    const status = error.response?.status || 500;
    const message = error.response?.data?.error?.message || error.message || 'Failed to update row.';
    res.status(status).json({ 
      status: 'error', 
      message: message,
      error: error.response?.data?.error 
    });
  }
});

/**
 * Find Contact Row Index in Sheet by Phone
 * GET /api/google-sheets/find-contact
 * 
 * Searches a sheet for a phone number and returns the row index.
 * Protected route - requires authentication
 * Query Params: sheetId, phoneNumber
 */
router.get('/find-contact', requireAuth, async (req, res) => {
  const { uid } = req.user;
  const { sheetId, phoneNumber } = req.query;

  if (!sheetId || !phoneNumber) {
    return res.status(400).json({ status: 'error', message: 'Missing sheetId or phoneNumber query parameter.' });
  }

  try {
    logger.info(`Finding contact ${phoneNumber} in sheet ${sheetId} for user ${uid}`);
    const credentials = await googleService.getValidCredentials(uid);
    const accessToken = credentials?.access_token;

    if (!accessToken) {
       logger.warn(`No valid Google token for finding contact, user ${uid}, sheet ${sheetId}`);
      return res.status(401).json({ status: 'error', message: 'Invalid or missing Google credentials.' });
    }

    // Get sheet config to find the phone column
    const userDoc = await admin.firestore().collection('Users').doc(uid).get();
    const sheetConfigs = userDoc.data()?.workflows?.whatsapp_agent?.sheetConfigs || [];
    const config = sheetConfigs.find(c => c.sheetId === sheetId);

    if (!config || !Array.isArray(config.columns)) {
      return res.status(404).json({ status: 'error', message: `Configuration for sheet ${sheetId} not found or invalid.` });
    }

    const phoneColumnIndex = config.columns.findIndex(col => 
        col.type === 'phone' || col.name.toLowerCase().includes('phone')
    );

    if (phoneColumnIndex === -1) {
       logger.warn(`No phone column found in config for sheet ${sheetId}`);
      return res.json({ status: 'success', data: { rowIndex: null, message: 'No phone column configured.' } });
    }
    
    const phoneColumnLetter = String.fromCharCode(65 + phoneColumnIndex);
    const range = `Sheet1!${phoneColumnLetter}:${phoneColumnLetter}`;
    
    logger.debug(`Calling Google Sheets API to get values from range ${range} in sheet ${sheetId}`);
    const valuesResponse = await axios.get(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const values = valuesResponse.data.values || [];
    let rowIndex = null;
    // Start search from row 2 (index 1) to skip header
    for (let i = 1; i < values.length; i++) {
      if (values[i] && values[i][0] === phoneNumber) {
        rowIndex = i + 1; // 1-based index
        break;
      }
    }
    
    logger.debug(`Search for ${phoneNumber} in sheet ${sheetId} completed. Found at row: ${rowIndex}`);
    res.json({ status: 'success', data: { rowIndex: rowIndex } });

  } catch (error) {
    logger.error(`Error finding contact ${phoneNumber} in sheet ${sheetId} for user ${uid}:`, error.response?.data || error.message || error);
    const status = error.response?.status || 500;
    const message = error.response?.data?.error?.message || error.message || 'Failed to find contact.';
    res.status(status).json({ 
      status: 'error', 
      message: message,
      error: error.response?.data?.error 
    });
  }
});

module.exports = router; 