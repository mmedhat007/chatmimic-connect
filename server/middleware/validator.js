/**
 * Input validation middleware using express-validator
 */

const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const xss = require('xss');

/**
 * Custom sanitization middleware to prevent XSS attacks
 * @param {Object} obj - The object to sanitize
 * @returns {Object} - The sanitized object
 */
const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sanitized = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      // Apply XSS sanitization to string values
      sanitized[key] = xss(value);
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeObject(value);
    } else {
      // Keep other values as is
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};

/**
 * Middleware to validate request inputs based on provided validators
 * @param {Array} validators - Array of express-validator validators
 * @returns {Function} Express middleware
 */
const validate = (validators) => {
  return async (req, res, next) => {
    try {
      // Run all validators/sanitizers
      for (const validation of validators) {
        await validation.run(req);
      }
      
      // Get validation errors if any
      const errors = validationResult(req);
      
      if (errors.isEmpty()) {
        // Additional XSS sanitization
        req.body = sanitizeObject(req.body);
        req.query = sanitizeObject(req.query);
        req.params = sanitizeObject(req.params);
        
        return next();
      }
      
      // Validation errors found
      logger.warn('Validation errors', { 
        path: req.path,
        errors: errors.array(),
        userId: req.user?.uid || 'unauthenticated'
      });
      
      // Return validation errors
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        errors: errors.array().map(err => ({
          field: err.path,
          message: err.msg
        }))
      });
    } catch (error) {
      logger.logError(error, req, 'Validation middleware error');
      return res.status(500).json({
        status: 'error',
        message: 'Server error during validation'
      });
    }
  };
};

module.exports = {
  validate,
  sanitizeObject
}; 