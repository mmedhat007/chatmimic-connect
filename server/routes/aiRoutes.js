// Example: Load AI service
// const aiService = require('./services/aiService');

// Example: Load Google Sheets service
// const googleSheetsService = require('./services/googleSheetsService'); 

const express = require('express');
// Destructure the requireAuth function from the imported module
const { requireAuth } = require('../middleware/auth');
const aiService = require('../services/aiService');
const logger = require('../utils/logger'); // Restore logger require

const router = express.Router();

/**
 * POST /api/ai/extract-data
 * Extracts structured data from a message using AI.
 * Requires authentication.
 * 
 * Request Body:
 * { 
 *   message: "The message text to process",
 *   fields: [{id: "field1", name: "Field 1", type: "text", aiPrompt?: "Optional custom prompt"}, ...]
 * }
 * 
 * Response:
 * Success (200): { status: 'success', data: { field1: "extracted_value", field2: "N/A", ... } }
 * Error (400): { status: 'error', message: 'Invalid input...' }
 * Error (500): { status: 'error', message: 'Failed to extract data...' }
 */
router.post('/extract-data', requireAuth, async (req, res) => {
  const { message, fields } = req.body;
  const { uid } = req.user; // Restore user usage

  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ status: 'error', message: 'Invalid input: Message is required and must be a non-empty string.' });
  }

  if (!Array.isArray(fields) || fields.length === 0) {
    // If fields are optional, return empty object? For now, require them.
    return res.status(400).json({ status: 'error', message: 'Invalid input: Fields are required and must be a non-empty array.' });
  }

  // Basic validation for fields structure (can be enhanced)
  if (!fields.every(f => f && typeof f === 'object' && f.id && f.name && f.type)) {
    return res.status(400).json({ status: 'error', message: 'Invalid input: Each field must be an object with id, name, and type.' });
  }

  try {
    logger.info(`[AI Route] User ${uid} requesting data extraction for ${fields.length} fields.`); // Restore logger usage
    const extractedData = await aiService.extractDataFromMessage(message, fields);
    
    return res.json({ status: 'success', data: extractedData });

  } catch (error) {
    logger.logError(error, req, 'Error in /api/ai/extract-data'); // Restore logger usage
    
    // Check for specific AI service config error
    if (error.message && error.message.includes('API key not configured')) {
        return res.status(500).json({ status: 'error', message: 'AI service configuration error on server.' });
    }
    
    // General failure
    return res.status(500).json({ 
        status: 'error', 
        message: 'Failed to extract data using AI.', 
        error: error.message
    });
  }
});

module.exports = router; 