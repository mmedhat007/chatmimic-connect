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
      
      // Use axios directly to refresh the token
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      
      if (!clientId || !clientSecret) {
        throw new Error('Google OAuth credentials not configured');
      }
      
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
      
      // Update token in database
      await updateCredentialsInDb(userId, new_access_token, expires_in);
      
      return {
        access_token: new_access_token,
        refresh_token: refresh_token
      };
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

module.exports = {
  getCredentialsForUser,
  getValidCredentials,
  updateCredentialsInDb,
  exchangeCodeForTokens
}; 