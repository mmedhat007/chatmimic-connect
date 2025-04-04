/**
 * Authentication middleware to protect routes
 */

const admin = require('firebase-admin');
const logger = require('../utils/logger');

// Development mode test tokens
const DEV_TEST_TOKENS = ['test-token-dev'];
const DEV_TEST_USER = {
  uid: 'test-user-development',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user'
};

/**
 * Middleware to require authentication
 * Verifies Firebase token and adds user object to request
 * Returns 401 if no token is provided or token is invalid
 */
const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  // Enhanced logging for debugging
  logger.debug(`Auth middleware check for ${req.path}`, {
    hasAuthHeader: !!authHeader,
    headerType: authHeader ? authHeader.split(' ')[0] : 'none',
    environment: process.env.NODE_ENV,
    adminInitialized: admin.apps.length > 0 && !!admin.apps[0],
    firebaseDatabaseUrl: process.env.FIREBASE_DATABASE_URL || 'not set'
  });
  
  // Check for development mode test token
  if (process.env.NODE_ENV === 'development' && authHeader && 
      DEV_TEST_TOKENS.includes(authHeader.split('Bearer ')[1])) {
    logger.info('Using development test token for authentication', { path: req.path });
    req.user = DEV_TEST_USER;
    return next();
  }
  
  // Only use real Firebase authentication
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const idToken = authHeader.split('Bearer ')[1];
    
    // Log token length and first/last few characters for debugging
    const tokenStart = idToken.substring(0, 10);
    const tokenEnd = idToken.substring(idToken.length - 5);
    logger.debug(`Processing token: ${tokenStart}...${tokenEnd} (${idToken.length} chars)`, { path: req.path });
    
    try {
      // Check if Firebase Admin is initialized
      if (admin.apps.length && admin.apps[0]) {
        // Try to verify the token
        admin.auth().verifyIdToken(idToken)
          .then(decodedToken => {
            req.user = decodedToken;
            logger.info('User authenticated with Firebase', { uid: decodedToken.uid, path: req.path });
            next();
          })
          .catch(error => {
            logger.warn('Firebase token verification failed', { 
              error: error.message, 
              errorCode: error.code,
              path: req.path 
            });
            
            // Enhanced error messaging based on error type
            let errorDetails = 'Invalid authentication token';
            if (error.code === 'auth/id-token-expired') {
              errorDetails = 'Your session has expired. Please refresh the page to continue.';
            } else if (error.code === 'auth/id-token-revoked') {
              errorDetails = 'Your session has been revoked. Please log in again.';
            } else if (error.code === 'auth/argument-error') {
              errorDetails = 'Invalid authentication format. Please log in again.';
            } else if (error.code === 'auth/invalid-credential') {
              errorDetails = 'Authentication credentials are invalid. Please log in again.';
            }
            
            // Return auth error
            return res.status(401).json({
              status: 'error',
              message: 'Authentication failed',
              details: process.env.NODE_ENV === 'development' ? `${error.message} (${error.code})` : errorDetails
            });
          });
        return; // Return to prevent further execution
      } else {
        logger.error('Firebase Admin is not initialized');
        return res.status(500).json({
          status: 'error',
          message: 'Server configuration error'
        });
      }
    } catch (error) {
      logger.error('Error accessing Firebase Admin', { error: error.message });
      return res.status(500).json({
        status: 'error',
        message: 'Server configuration error'
      });
    }
  }
  
  // For all environments, check if req.user was set by the auth middleware in index.js
  if (req.user) {
    return next();
  }
  
  // If we get here, the user is not authenticated
  logger.warn('Auth required but user not authenticated', {
    path: req.path,
    method: req.method,
    authHeader: authHeader ? `${authHeader.substring(0, 15)}...` : 'none'
  });
  
  return res.status(401).json({
    status: 'error',
    message: 'Invalid authentication token'
  });
};

/**
 * Middleware to optionally authenticate
 * Similar to requireAuth but continues if no token is provided
 * Adds user object to request if token is valid
 */
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  // Check for development mode test token
  if (process.env.NODE_ENV === 'development' && authHeader && 
      DEV_TEST_TOKENS.includes(authHeader.split('Bearer ')[1])) {
    logger.info('Using development test token for optional authentication', { path: req.path });
    req.user = DEV_TEST_USER;
    return next();
  }
  
  // Always try real Firebase authentication
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const idToken = authHeader.split('Bearer ')[1];
    
    try {
      // Check if Firebase Admin is initialized
      if (admin.apps.length && admin.apps[0]) {
        try {
          const decodedToken = await admin.auth().verifyIdToken(idToken);
          req.user = decodedToken;
          logger.debug('User authenticated (optional)', {
            uid: decodedToken.uid,
            path: req.path
          });
          return next();
        } catch (error) {
          logger.debug('Optional auth token invalid', {
            path: req.path,
            error: error.message
          });
          // Continue without user object
        }
      }
    } catch (error) {
      logger.error('Error accessing Firebase Admin', { error: error.message });
      // Continue without user object
    }
  }
  
  // Continue without user object for optional auth
  next();
};

/**
 * Helper function to generate a development test token response
 * This is only used in development mode for testing
 */
const generateTestTokenResponse = (res) => {
  return res.status(200).json({
    status: 'success',
    message: 'New development test token generated',
    token: 'test-token-dev',
    expiresIn: 3600
  });
};

/**
 * Route to handle token refresh
 * This endpoint provides a new token when an existing token has expired
 */
const handleTokenRefresh = async (req, res) => {
  try {
    const environment = process.env.NODE_ENV || 'development';
    
    // For development mode, we can use test tokens
    if (environment === 'development' && req.query.dev === 'true') {
      logger.info('Generating development test token');
      return generateTestTokenResponse(res);
    }
    
    // Get existing token from authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(400).json({
        status: 'error',
        message: 'No token provided for refresh'
      });
    }
    
    // Extract token from header
    const idToken = authHeader.split('Bearer ')[1];
    
    // For real token refresh, we need to verify the existing token
    // even if it's expired - Firebase Admin allows this with checkRevoked: false
    try {
      // First try to verify without checking if revoked
      const decodedToken = await admin.auth().verifyIdToken(idToken, { checkRevoked: false });
      
      // If successful, create a custom token that the client can exchange
      const customToken = await admin.auth().createCustomToken(decodedToken.uid);
      
      return res.status(200).json({
        status: 'success',
        message: 'Token refresh successful',
        token: customToken
      });
    } catch (error) {
      logger.warn('Token refresh failed', { error: error.message, code: error.code });
      
      // Return specific error for completely invalid tokens
      return res.status(401).json({
        status: 'error',
        message: 'Token refresh failed',
        details: error.message
      });
    }
  } catch (error) {
    logger.error('Error in token refresh handler', { error: error.message });
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error during token refresh'
    });
  }
};

module.exports = {
  requireAuth,
  optionalAuth,
  handleTokenRefresh
}; 