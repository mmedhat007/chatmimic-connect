const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validator');
const { whatsAppCredentialsValidators } = require('../utils/validators/whatsappValidators'); // We need to create this validator
const whatsappService = require('../services/whatsappService');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * POST /api/whatsapp/validate-credentials
 * Validates WhatsApp API credentials.
 * @requires Auth
 * @body { access_token: string, phone_number_id: string }
 */
router.post('/validate-credentials',
    requireAuth,
    validate(whatsAppCredentialsValidators), // Apply validation
    async (req, res) => {
        const startTime = Date.now();
        const { access_token, phone_number_id } = req.body;

        try {
            logger.info(`Validation request for WhatsApp creds - User: ${req.user.uid}, Phone ID: ${phone_number_id}`);
            
            const result = await whatsappService.validateWhatsAppCredentials(access_token, phone_number_id);
            
            const responseTime = Date.now() - startTime;

            if (result.isValid) {
                logger.info(`Validation successful for WhatsApp creds - User: ${req.user.uid}, Phone ID: ${phone_number_id}`);
                res.json({ 
                    status: 'success', 
                    data: { isValid: true }, 
                    meta: { responseTime }
                });
            } else {
                logger.warn(`Validation failed for WhatsApp creds - User: ${req.user.uid}, Phone ID: ${phone_number_id}, Reason: ${result.error}`);
                // Use 400 Bad Request for invalid credentials
                res.status(400).json({ 
                    status: 'error',
                    message: result.error || 'Invalid WhatsApp credentials.',
                    details: result.details,
                    meta: { responseTime }
                });
            }
            
        } catch (error) {
            const responseTime = Date.now() - startTime;
            // Log specific error properties instead of the whole object
            // Use splat formatting if logger is configured for it
            logger.error(
                'Error during WhatsApp credential validation for User: %s - Error: %s',
                req.user.uid, 
                error.message, 
                { stack: error.stack } // Log stack separately as metadata
            );
            res.status(500).json({ 
                status: 'error', 
                message: 'An internal server error occurred during validation.',
                meta: { responseTime }
            });
        }
    }
);

// Add other WhatsApp related routes here later if needed
// e.g., GET /api/whatsapp/status

module.exports = router; 