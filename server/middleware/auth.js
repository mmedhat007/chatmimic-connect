/**
 * Authentication middleware to protect routes
 */

const admin = require('firebase-admin');
const logger = require('../utils/logger');

/**
 * Middleware to require authentication
 * Verifies Firebase token and adds user object to request
 * Returns 401 if no token is provided or token is invalid
 */
const requireAuth = async (req, res, next) => {
  const startTime = Date.now(); // Start timer early
  req.startTime = startTime; // Attach start time to request for later use

  const authHeader = req.headers.authorization;
  
  // Log the received Authorization header for debugging
  logger.debug('Received Authorization header', { 
    path: req.path, 
    header: authHeader ? authHeader.substring(0, 15) + '...' : 'Missing' // Log prefix only
  });
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const responseTime = Date.now() - startTime;
    logger.warn('Authentication missing or malformed header', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      headerProvided: !!authHeader
    });
    return res.status(401).json({ 
      status: 'error',
      message: 'Authentication required (Bearer token format expected)', 
      meta: {
        responseTime
      }
    });
  }
  
  const idToken = authHeader.split('Bearer ')[1];
  
  // Log the extracted token (prefix only for security)
  logger.debug('Extracted ID token (prefix)', { 
    path: req.path, 
    tokenPrefix: idToken ? idToken.substring(0, 10) + '...' : 'Empty/Invalid'
  });
  
  // Add a check for an empty or obviously invalid token after split
  if (!idToken || idToken.length < 10) { // Basic check for minimal token length
     const responseTime = Date.now() - startTime;
     logger.warn('Extracted token appears invalid or empty after splitting Bearer', {
      path: req.path,
      method: req.method,
      headerProvided: !!authHeader
    });
    return res.status(401).json({ 
      status: 'error',
      message: 'Invalid token format after Bearer split', 
      meta: {
        responseTime
      }
    });
  }
  
  try {
    // Log before verification attempt
    logger.debug('Attempting to verify Firebase ID token', { path: req.path });
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    
    logger.debug('User authenticated successfully', {
      uid: decodedToken.uid,
      path: req.path
    });
    
    next();
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.logError(error, req, 'Firebase token verification failed', {
      errorCode: error.code,
      errorMessage: error.message
    });
    
    let message = 'Invalid authentication token';
    if (error.code === 'auth/id-token-expired') {
      message = 'Authentication token has expired';
    } else if (error.code === 'auth/argument-error') {
      message = 'Authentication token is malformed or invalid';
    }
    
    return res.status(401).json({ 
      status: 'error',
      message: message,
      details: {
        errorCode: error.code
      },
      meta: {
        responseTime
      }
    });
  }
};

/**
 * Middleware to optionally authenticate
 * Similar to requireAuth but continues if no token is provided
 * Adds user object to request if token is valid
 */
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  
  const idToken = authHeader.split('Bearer ')[1];
  
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    
    logger.debug('User authenticated (optional)', {
      uid: decodedToken.uid,
      path: req.path
    });
  } catch (error) {
    logger.debug('Optional auth token invalid', {
      path: req.path,
      error: error.message
    });
    // Continue without user object for optional auth
  }
  
  next();
};

module.exports = {
  requireAuth,
  optionalAuth
}; 