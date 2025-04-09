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

module.exports = router; 