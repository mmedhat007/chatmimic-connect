/**
 * Test script for Google OAuth token refresh functionality
 * 
 * Usage: 
 * 1. Set the USER_ID variable to a valid Firebase user ID
 * 2. Run with: node test-token-refresh.js
 */

require('dotenv').config({ path: '../.env' });
const admin = require('firebase-admin');
const crypto = require('crypto');
const axios = require('axios');

// Initialize Firebase Admin
try {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
  console.log('Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error);
  process.exit(1);
}

// *** SET THIS TO A VALID USER ID ***
const USER_ID = '';  // e.g. 'YOUR_USER_ID_HERE'

if (!USER_ID) {
  console.error('Please set the USER_ID variable at the top of this script');
  process.exit(1);
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
    console.error('Decryption error:', error);
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
 */
async function getCredentialsForUser(userId) {
  const userDoc = await admin.firestore().collection('Users').doc(userId).get();
  
  if (!userDoc.exists) {
    console.warn(`User ${userId} not found in database`);
    return null;
  }
  
  const userData = userDoc.data();
  
  if (!userData.credentials?.googleSheetsOAuth) {
    console.warn(`User ${userId} has no Google credentials`);
    return null;
  }
  
  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('Encryption key not configured');
  }
  
  const googleOAuth = userData.credentials.googleSheetsOAuth;
  
  if (!googleOAuth.accessToken || !googleOAuth.refreshToken) {
    console.warn(`User ${userId} has incomplete Google credentials`);
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
}

/**
 * Refresh the access token using the refresh token
 */
async function refreshAccessToken(refreshToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured');
  }
  
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
  
  return tokenResponse.data;
}

/**
 * Update Google credentials in Firestore
 */
async function updateCredentialsInDb(userId, accessToken, expiresIn) {
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
  
  console.log(`Updated Google credentials for user ${userId}`);
}

/**
 * Test API call to Google Sheets
 */
async function testSheetsAPI(accessToken) {
  try {
    const response = await axios.get('https://sheets.googleapis.com/v4/spreadsheets', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    console.log('API call successful!');
    return response.data;
  } catch (error) {
    console.error('API call failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Main test function
 */
async function main() {
  try {
    console.log(`Getting credentials for user ${USER_ID}...`);
    const credentials = await getCredentialsForUser(USER_ID);
    
    if (!credentials) {
      console.error('No credentials found for user');
      process.exit(1);
    }
    
    console.log('Credentials found:');
    console.log('- Access Token:', credentials.access_token.substring(0, 10) + '...');
    console.log('- Refresh Token:', credentials.refresh_token.substring(0, 10) + '...');
    console.log('- Expiry Date:', new Date(credentials.expiry_date).toLocaleString());
    
    const isExpired = Date.now() >= credentials.expiry_date;
    console.log('Token expired?', isExpired);
    
    if (isExpired) {
      console.log('Refreshing token...');
      const refreshData = await refreshAccessToken(credentials.refresh_token);
      console.log('Token refreshed successfully:');
      console.log('- New Access Token:', refreshData.access_token.substring(0, 10) + '...');
      console.log('- Expires In:', refreshData.expires_in, 'seconds');
      
      console.log('Updating token in database...');
      await updateCredentialsInDb(USER_ID, refreshData.access_token, refreshData.expires_in);
      
      console.log('Testing API call with new token...');
      await testSheetsAPI(refreshData.access_token);
    } else {
      console.log('Token is still valid, testing API call...');
      await testSheetsAPI(credentials.access_token);
      
      console.log('Forcing token refresh for testing purposes...');
      const refreshData = await refreshAccessToken(credentials.refresh_token);
      console.log('Token refreshed successfully:');
      console.log('- New Access Token:', refreshData.access_token.substring(0, 10) + '...');
      console.log('- Expires In:', refreshData.expires_in, 'seconds');
      
      console.log('Updating token in database...');
      await updateCredentialsInDb(USER_ID, refreshData.access_token, refreshData.expires_in);
    }
    
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    process.exit(0);
  }
}

// Run the test
main(); 