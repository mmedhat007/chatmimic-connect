const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const admin = require('firebase-admin');
const axios = require('axios');
const logger = require('./utils/logger');
const { requireAuth } = require('./middleware/auth');

// Firebase Admin initialization should be done in your main server file
// and passed to this module

// Helper function to encrypt sensitive data before storing
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

// Google OAuth token exchange endpoint - no auth required for callback
router.post('/exchange-token', async (req, res) => {
  try {
    const { code, redirectUri, state } = req.body;
    const authHeader = req.headers.authorization;
    
    // Log the request for troubleshooting
    logger.debug('Token exchange request received', {
      codePresent: !!code,
      redirectUriPresent: !!redirectUri,
      statePresent: !!state,
      authHeaderPresent: !!authHeader,
      envMode: process.env.NODE_ENV
    });
    
    if (!code) {
      logger.error('Missing authorization code in token exchange');
      return res.status(400).json({ 
        status: 'error', 
        message: 'Authorization code is required' 
      });
    }

    if (!redirectUri) {
      logger.error('Missing redirect URI in token exchange');
      return res.status(400).json({ 
        status: 'error', 
        message: 'Redirect URI is required' 
      });
    }
    
    // Parse the state parameter to get user UID
    let uid;
    try {
      if (state) {
        const decodedState = JSON.parse(atob(state));
        uid = decodedState.uid;
        logger.info('Retrieved user ID from state parameter', { 
          userId: uid, 
          stateTimestamp: decodedState.timestamp 
        });
      }
    } catch (stateError) {
      logger.error('Error parsing state parameter', { 
        error: stateError.message,
        state: state ? state.substring(0, 20) + '...' : 'null' 
      });
    }
    
    // If no UID from state, try to get from auth header
    if (!uid && req.user) {
      uid = req.user.uid;
      logger.info('Using UID from authenticated request', { userId: uid });
    }
    
    if (!uid) {
      logger.error('No user ID found in request');
      return res.status(400).json({ 
        status: 'error', 
        message: 'User ID not found in request. Please login and try again.' 
      });
    }
    
    // Server-side environment variables
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    // Debug log the OAuth credentials (don't log the full values in production)
    if (process.env.NODE_ENV === 'development') {
      logger.debug('OAuth credentials check', {
        clientIdPresent: !!clientId,
        clientIdPrefix: clientId ? clientId.substring(0, 8) + '...' : 'missing',
        clientSecretPresent: !!clientSecret,
        clientSecretPrefix: clientSecret ? clientSecret.substring(0, 8) + '...' : 'missing'
      });
    }
    
    if (!clientId || !clientSecret) {
      logger.error('Missing OAuth credentials in server configuration', {
        clientIdPresent: !!clientId,
        clientSecretPresent: !!clientSecret,
        envVars: Object.keys(process.env).filter(key => key.includes('GOOGLE_'))
      });
      return res.status(500).json({ 
        status: 'error', 
        message: 'Server configuration error: OAuth credentials not configured' 
      });
    }

    // Debug log to check client ID and redirect URI
    logger.debug('Google OAuth token exchange parameters', {
      clientIdPresent: !!clientId,
      clientSecretPresent: !!clientSecret,
      redirectUri,
      state: state ? 'present' : 'missing',
      codeLength: code.length
    });
    
    // Exchange the authorization code for tokens
    logger.debug('Exchanging authorization code for tokens', { userId: uid });
    
    let tokenResponse;
    try {
      // Improved error handling for the token exchange request
      tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
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
    } catch (tokenError) {
      // Enhanced error logging for token exchange failures
      logger.error('Error from Google token endpoint', {
        userId: uid,
        error: tokenError.message,
        response: tokenError.response?.data,
        responseStatus: tokenError.response?.status,
        code: code ? (code.length > 10 ? code.substring(0, 5) + '...' + code.substring(code.length - 5) : code) : 'missing',
        redirectUri
      });
      
      // More descriptive error message
      let errorDetails = 'Unknown error';
      if (tokenError.response?.data?.error) {
        errorDetails = tokenError.response.data.error;
        if (tokenError.response.data.error_description) {
          errorDetails += `: ${tokenError.response.data.error_description}`;
        }
      } else if (tokenError.message) {
        errorDetails = tokenError.message;
      }
      
      // If the auth code is malformed or invalid
      if (errorDetails.includes('invalid_grant') || errorDetails.includes('invalid_request')) {
        return res.status(401).json({
          status: 'error',
          message: 'Failed to exchange authorization code',
          details: 'Malformed auth code.'
        });
      }
      
      return res.status(401).json({
        status: 'error',
        message: 'Failed to exchange authorization code',
        details: errorDetails
      });
    }
    
    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    
    if (!access_token) {
      logger.error('No access token in Google response', { userId: uid });
      return res.status(500).json({
        status: 'error',
        message: 'No access token received from Google'
      });
    }
    
    // Create expiration timestamp
    const expiresAt = Date.now() + (expires_in * 1000);
    
    // Encrypt tokens before storing
    const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
    if (!encryptionKey) {
      logger.error('Missing encryption key in server configuration', { userId: uid });
      return res.status(500).json({ 
        status: 'error', 
        message: 'Server configuration error: Encryption key not configured' 
      });
    }
    
    const encryptedAccessToken = encryptData(access_token, encryptionKey);
    const encryptedRefreshToken = refresh_token ? encryptData(refresh_token, encryptionKey) : null;
    
    // Check if Firebase Admin is initialized before trying to use Firestore
    if (!admin.apps.length || !admin.apps[0]) {
      logger.error('Firebase Admin is not initialized', { userId: uid });
      return res.status(500).json({ 
        status: 'error', 
        message: 'Server configuration error: Firebase Admin is not initialized' 
      });
    }
    
    // Check if user exists in Firestore
    const userRef = admin.firestore().doc(`Users/${uid}`);
    let userDoc;
    
    try {
      userDoc = await userRef.get();
    } catch (firestoreError) {
      logger.error('Error accessing Firestore', {
        userId: uid,
        error: firestoreError.message
      });
      
      return res.status(500).json({
        status: 'error',
        message: 'Database error',
        details: firestoreError.message
      });
    }
    
    if (!userDoc.exists) {
      logger.warn('User document not found in Firestore', { userId: uid });
      // Create the user document if it doesn't exist
      await userRef.set({
        uid,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        credentials: {
          googleSheetsOAuth: {
            accessToken: encryptedAccessToken,
            refreshToken: encryptedRefreshToken,
            expiresAt,
            updatedAt: Date.now()
          }
        }
      });
      
      logger.info('Created new user document with Google credentials', { userId: uid });
    } else {
      // Update existing user document
      await userRef.update({
        'credentials.googleSheetsOAuth': {
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          expiresAt,
          updatedAt: Date.now()
        }
      });
      
      logger.info('Updated user document with Google credentials', { userId: uid });
    }
    
    res.status(200).json({ 
      status: 'success',
      data: {
        expiresAt,
        connected: true
      }
    });
    
  } catch (error) {
    logger.error('Error in Google OAuth token exchange', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to exchange token',
      details: error.message
    });
  }
});

// Route to refresh an expired token
// This one requires authentication
router.post('/refresh-token', requireAuth, async (req, res) => {
  try {
    const { uid } = req.user; // From Firebase Auth middleware
    
    if (!uid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Server-side environment variables
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
    
    if (!clientId || !clientSecret || !encryptionKey) {
      return res.status(500).json({ error: 'Server configuration error' });
    }
    
    // Get the encrypted refresh token from Firestore
    const userDoc = await admin.firestore().doc(`Users/${uid}`).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = userDoc.data();
    const encryptedRefreshToken = userData.credentials?.googleSheetsOAuth?.refreshToken;
    
    if (!encryptedRefreshToken) {
      return res.status(400).json({ error: 'No refresh token found. User needs to re-authorize.' });
    }
    
    // Decrypt the refresh token
    const { iv, encryptedData, authTag } = encryptedRefreshToken;
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(encryptionKey, 'hex'),
      Buffer.from(iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    let refreshToken = decipher.update(encryptedData, 'hex', 'utf8');
    refreshToken += decipher.final('utf8');
    
    // Exchange the refresh token for a new access token
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const { access_token, expires_in } = tokenResponse.data;
    
    // Create expiration timestamp
    const expiresAt = Date.now() + (expires_in * 1000);
    
    // Encrypt the new access token
    const encryptedAccessToken = encryptData(access_token, encryptionKey);
    
    // Update Firestore with the new token
    await admin.firestore().doc(`Users/${uid}`).update({
      'credentials.googleSheetsOAuth.accessToken': encryptedAccessToken,
      'credentials.googleSheetsOAuth.expiresAt': expiresAt,
      'credentials.googleSheetsOAuth.updatedAt': Date.now()
    });
    
    res.status(200).json({ 
      success: true, 
      expiresAt
    });
    
  } catch (error) {
    logger.error('Error refreshing Google OAuth token:', error);
    res.status(500).json({ 
      error: 'Failed to refresh token', 
      message: error.message 
    });
  }
});

// Helper function to decode base64 strings (for state parameter)
function atob(str) {
  return Buffer.from(str, 'base64').toString('utf-8');
}

module.exports = router; 