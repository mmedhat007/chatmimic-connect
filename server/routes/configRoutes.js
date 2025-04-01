/**
 * Routes for user configuration management
 */

const express = require('express');
const { validate } = require('../middleware/validator');
const { requireAuth } = require('../middleware/auth');
const logger = require('../utils/logger');
const { saveUserConfig, fetchUserConfig } = require('../services/supabaseService');

// Create config validators
const { body } = require('express-validator');

const configValidators = [
  body('name').trim().isString().notEmpty().withMessage('Name is required'),
  body('behaviorRules').isArray().withMessage('Behavior rules must be an array'),
  body('behaviorRules.*.rule').isString().notEmpty().withMessage('Each behavior rule must have a non-empty rule'),
  body('behaviorRules.*.description').optional().isString(),
  body('isActive').optional().isBoolean(),
  body('settings').optional().isObject()
];

const router = express.Router();

/**
 * Save user configuration
 * POST /api/config
 */
router.post('/',
  requireAuth,
  validate(configValidators),
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      const userId = req.user.uid;
      const configData = req.body;
      
      logger.info('Saving user configuration', {
        userId,
        configName: configData.name
      });
      
      const result = await saveUserConfig(userId, configData);
      
      const responseTime = Date.now() - startTime;
      logger.info('User configuration saved successfully', {
        userId,
        configId: result.id,
        responseTime
      });
      
      res.json({
        status: 'success',
        data: result,
        meta: {
          responseTime
        }
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.logError(error, req, 'Error saving user configuration');
      
      res.status(500).json({
        status: 'error',
        message: error.message || 'An error occurred while saving the configuration',
        meta: {
          responseTime
        }
      });
    }
  }
);

/**
 * Get user configuration
 * GET /api/config
 */
router.get('/',
  requireAuth,
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      const userId = req.user.uid;
      
      logger.info('Fetching user configuration', {
        userId
      });
      
      const config = await fetchUserConfig(userId);
      
      const responseTime = Date.now() - startTime;
      logger.info('User configuration fetched successfully', {
        userId,
        configFound: !!config,
        responseTime
      });
      
      if (!config) {
        return res.status(404).json({
          status: 'error',
          message: 'Configuration not found',
          meta: {
            responseTime
          }
        });
      }
      
      res.json({
        status: 'success',
        data: config,
        meta: {
          responseTime
        }
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.logError(error, req, 'Error fetching user configuration');
      
      res.status(500).json({
        status: 'error',
        message: error.message || 'An error occurred while fetching the configuration',
        meta: {
          responseTime
        }
      });
    }
  }
);

module.exports = router; 