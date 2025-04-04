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
    
    if (!code || !redirectUri) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Parse the state parameter to get user UID
    let uid;
    try {
      if (state) {
        const decodedState = JSON.parse(atob(state));
        uid = decodedState.uid;
      }
    } catch (err) {
      logger.error('Error parsing state parameter:', err);
    }
    
    // If no UID from state, try to get from auth header
    if (!uid && req.user) {
      uid = req.user.uid;
    }
    
    if (!uid) {
      return res.status(400).json({ error: 'User ID not found in request' });
    }
    
    // Server-side environment variables
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: 'Server configuration error' });
    }
    
    // Exchange the authorization code for tokens
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
    
    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    
    // Create expiration timestamp
    const expiresAt = Date.now() + (expires_in * 1000);
    
    // Encrypt tokens before storing
    const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
    if (!encryptionKey) {
      return res.status(500).json({ error: 'Encryption key not configured' });
    }
    
    const encryptedAccessToken = encryptData(access_token, encryptionKey);
    const encryptedRefreshToken = refresh_token ? encryptData(refresh_token, encryptionKey) : null;
    
    // Store encrypted tokens in Firestore
    await admin.firestore().doc(`Users/${uid}`).update({
      'credentials.googleSheetsOAuth': {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt,
        updatedAt: Date.now()
      }
    });
    
    res.status(200).json({ 
      success: true, 
      expiresAt,
      // Don't send the tokens back to the client
    });
    
  } catch (error) {
    logger.error('Error exchanging Google OAuth token:', error);
    res.status(500).json({ 
      error: 'Failed to exchange token', 
      message: error.message 
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