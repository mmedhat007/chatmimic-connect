/**
 * Routes for Google OAuth authentication
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const admin = require('firebase-admin');
const logger = require('../utils/logger');
const googleService = require('../services/googleService');

/**
 * Exchange token route - converts auth code to tokens
 * POST /api/google-oauth/exchange-token
 * 
 * @authentication Optional
 * @request
 *   - code: Google authorization code
 * 
 * @response
 *   Success:
 *     {
 *       "status": "success",
 *       "data": {
 *         "access_token": "ya29.a0...",
 *         "expires_in": 3599,
 *         "token_type": "Bearer",
 *         "scope": "https://www.googleapis.com/auth/spreadsheets"
 *       },
 *       "meta": {
 *         "responseTime": 123 // milliseconds
 *       }
 *     }
 *   
 *   Error:
 *     {
 *       "status": "error",
 *       "message": "Error message",
 *       "meta": {
 *         "responseTime": 123 // milliseconds
 *       }
 *     }
 */
router.post('/exchange-token', async (req, res) => {
  const startTime = Date.now();

  try {
    const { code } = req.body;
    
    if (!code) {
      const responseTime = Date.now() - startTime;
      return res.status(400).json({ 
        status: 'error',
        message: 'Authorization code is required',
        meta: {
          responseTime
        }
      });
    }
    
    logger.info('Exchanging Google auth code for tokens');
    
    // Exchange code for tokens
    const tokens = await googleService.exchangeCodeForTokens(code);
    
    if (!tokens || !tokens.access_token) {
      throw new Error('Failed to obtain access token');
    }
    
    // Get user ID from auth header if available
    let userId = null;
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        userId = decodedToken.uid;
      } catch (error) {
        logger.warn('Invalid Firebase token in auth header', error);
        // Continue without user ID - will create anonymous record
      }
    }
    
    // Store tokens in database
    if (userId) {
      await googleService.updateCredentialsInDb(userId, tokens);
      logger.info(`Google credentials saved for user ${userId}`);
    } else {
      logger.warn('No user ID available, tokens not saved to database');
    }
    
    const responseTime = Date.now() - startTime;
    
    // Return tokens to client - access_token will be needed for API calls
    // Note: refresh_token should not be exposed in production environments
    res.json({
      status: 'success',
      data: {
        access_token: tokens.access_token,
        expires_in: tokens.expires_in,
        token_type: tokens.token_type || 'Bearer',
        scope: tokens.scope
        // refresh_token removed for security
      },
      meta: {
        responseTime
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('Error exchanging token:', error);
    res.status(500).json({ 
      status: 'error',
      message: `Error exchanging token: ${error.message}`,
      meta: {
        responseTime
      }
    });
  }
});

/**
 * Refresh token route
 * POST /api/google-oauth/refresh-token
 * 
 * @authentication Required
 * @response
 *   Success:
 *     {
 *       "status": "success",
 *       "data": {
 *         "access_token": "ya29.a0...",
 *         "expires_in": 3599,
 *         "token_type": "Bearer",
 *         "scope": "https://www.googleapis.com/auth/spreadsheets"
 *       },
 *       "meta": {
 *         "responseTime": 123 // milliseconds
 *       }
 *     }
 *   
 *   Error:
 *     {
 *       "status": "error",
 *       "message": "Error message",
 *       "meta": {
 *         "responseTime": 123 // milliseconds
 *       }
 *     }
 */
router.post('/refresh-token', requireAuth, async (req, res) => {
  const startTime = Date.now();

  try {
    const userId = req.user.uid;
    
    logger.info(`Refreshing Google token for user ${userId}`);
    
    // Get fresh credentials, which handles refresh if needed
    const credentials = await googleService.getValidCredentials(userId);
    
    if (!credentials || !credentials.access_token) {
      const responseTime = Date.now() - startTime;
      return res.status(401).json({ 
        status: 'error',
        message: 'Google credentials not available',
        meta: {
          responseTime
        }
      });
    }
    
    const responseTime = Date.now() - startTime;
    
    res.json({
      status: 'success',
      data: {
        access_token: credentials.access_token,
        expires_in: credentials.expires_in,
        token_type: credentials.token_type || 'Bearer',
        scope: credentials.scope
      },
      meta: {
        responseTime
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error(`Error refreshing token: ${error.message}`, error);
    res.status(500).json({ 
      status: 'error',
      message: `Failed to refresh token: ${error.message}`,
      meta: {
        responseTime
      }
    });
  }
});

module.exports = router; 