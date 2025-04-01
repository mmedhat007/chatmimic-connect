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
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('Authentication missing', {
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    return res.status(401).json({ 
      status: 'error',
      message: 'Authentication required' 
    });
  }
  
  const idToken = authHeader.split('Bearer ')[1];
  
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    
    logger.debug('User authenticated', {
      uid: decodedToken.uid,
      path: req.path
    });
    
    next();
  } catch (error) {
    logger.logError(error, req, 'Authentication error');
    return res.status(401).json({ 
      status: 'error',
      message: 'Invalid authentication token' 
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