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
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    const { uid } = req.user;
    
    // For production-like behavior
    try {
      // Check if Firebase admin is properly initialized
      if (!admin.apps.length || !admin.apps[0]) {
        logger.error('Firebase not initialized', { userId: uid });
        return res.status(500).json({
          status: 'error',
          message: 'Server configuration error: Firebase Admin is not initialized'
        });
      }
      
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
    } catch (fbError) {
      logger.error(`Firestore error checking Google Sheets status:`, fbError);
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to access user data',
        error: fbError.message
      });
    }
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
 */
router.post('/disconnect', requireAuth, async (req, res) => {
  try {
    const { uid } = req.user;
    
    // More detailed logging with request info
    logger.info('Disconnecting Google Sheets', { 
      userId: uid,
      isDevelopmentMode: process.env.NODE_ENV === 'development',
      authHeader: req.headers.authorization ? 'present' : 'missing'
    });
    
    if (!uid) {
      return res.status(400).json({
        status: 'error',
        message: 'User ID is required'
      });
    }
    
    // Check if Firebase admin is properly initialized 
    if (!admin.apps.length || !admin.apps[0]) {
      logger.error('Firebase not initialized', { userId: uid });
      return res.status(500).json({
        status: 'error',
        message: 'Server configuration error: Firebase Admin is not initialized'
      });
    }
    
    // For production or if Firebase is properly initialized in development
    try {
      // First, fetch the user document to make sure we have credentials
      const userDoc = await admin.firestore().collection('Users').doc(uid).get();
      
      if (!userDoc.exists) {
        logger.warn('User document not found during disconnect', { userId: uid });
        return res.status(404).json({
          status: 'error',
          message: 'User not found'
        });
      }
      
      const userData = userDoc.data();
      const googleCreds = userData?.credentials?.googleSheetsOAuth;
      
      if (!googleCreds) {
        logger.info('No Google credentials found to disconnect', { userId: uid });
        // Return success even if no credentials found, as the end state is what was desired
        return res.json({
          status: 'success',
          message: 'No Google Sheets connection found'
        });
      }

      // Try to revoke access on Google's side if we have a valid token
      try {
        const credentials = await googleService.getCredentialsForUser(uid);
        
        if (credentials && credentials.access_token) {
          logger.debug('Revoking Google access token', { userId: uid });
          
          // Google API requires revoke requests to be sent as form-urlencoded
          const params = new URLSearchParams();
          params.append('token', credentials.access_token);
          
          const revokeResponse = await axios.post('https://oauth2.googleapis.com/revoke', params, {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          });
          
          if (revokeResponse.status !== 200) {
            logger.warn('Non-200 response when revoking token', { 
              userId: uid, 
              status: revokeResponse.status
            });
          } else {
            logger.info('Successfully revoked Google token', { userId: uid });
          }
        } else {
          logger.warn('No access token available for revocation', { userId: uid });
        }
      } catch (revokeError) {
        // Log the error but continue - we'll still remove from our database
        logger.warn('Failed to revoke Google token', { 
          userId: uid, 
          error: revokeError.message,
          code: revokeError.code || 'unknown'
        });
        // Continue anyway - we'll still remove it from our database
      }
      
      // Always remove the credentials from Firestore regardless of revocation success
      try {
        await admin.firestore().collection('Users').doc(uid).update({
          'credentials.googleSheetsOAuth': admin.firestore.FieldValue.delete()
        });
        logger.info('Removed Google credentials from user record', { userId: uid });
      } catch (updateError) {
        logger.error('Failed to update Firestore document', { 
          userId: uid, 
          error: updateError.message
        });
        throw new Error(`Failed to remove Google credentials: ${updateError.message}`);
      }
      
      return res.json({
        status: 'success',
        message: 'Google Sheets disconnected successfully'
      });
    } catch (fbError) {
      logger.error(`Firestore error disconnecting Google Sheets:`, fbError);
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to disconnect Google Sheets due to database error',
        error: fbError.message
      });
    }
  } catch (error) {
    logger.error('Error disconnecting Google Sheets', {
      userId: req.user?.uid,
      error: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({
      status: 'error',
      message: 'Failed to disconnect Google Sheets',
      details: error.message
    });
  }
});

/**
 * Check the connection by making a test request to Google Sheets API
 * GET /api/google-sheets/test-connection
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

module.exports = router; 