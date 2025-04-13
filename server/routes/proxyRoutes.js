console.log('[DEBUG] routes/proxyRoutes.js executing...');

/**
 * Routes for secure proxy operations
 */

const express = require('express');
const { validate } = require('../middleware/validator');
const { requireAuth } = require('../middleware/auth');
const logger = require('../utils/logger');
const {
  proxyRequestValidators,
  embeddingsValidators,
  extractDataValidators,
  matchDocumentsValidators
} = require('../utils/validators/proxyValidators'); // UNCOMMENTED
const proxyService = require('../services/proxyService');
const { generateEmbeddings, extractDataWithGroq } = require('../services/aiService');
const { saveEmbedding, matchDocuments } = require('../services/supabaseService');
const googleService = require('../services/googleService');

const router = express.Router();

// Middleware to log routes being accessed (for debugging)
/* // Remove this debug middleware
router.use((req, res, next) => {
  logger.debug(`ProxyRoutes accessed: ${req.method} ${req.path}`, {
    baseUrl: req.baseUrl,
    originalUrl: req.originalUrl,
    path: req.path
  });
  next();
});
*/

// Generic proxy endpoint for external API calls
router.post('/proxy', 
  requireAuth, 
  validate(proxyRequestValidators),
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      const { endpoint, method, data, headers, params, service } = req.body;
      
      logger.info('Proxy request', {
        userId: req.user.uid,
        service,
        endpoint,
        method: method || 'GET'
      });
      
      const result = await proxyService.makeRequest({
        url: endpoint,
        method: method || 'GET',
        data,
        headers,
        params,
        service,
        userId: req.user.uid
      });
      
      const responseTime = Date.now() - startTime;
      logger.info('Proxy response success', {
        userId: req.user.uid,
        service,
        endpoint,
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
      logger.logError(error, req, 'Proxy request error');
      
      res.status(error.statusCode || 500).json({
        status: 'error',
        message: error.message || 'An error occurred while proxying the request',
        details: error.details || {},
        meta: {
          responseTime
        }
      });
    }
  }
);

/**
 * Generate embeddings endpoint
 * POST /api/proxy/embeddings
 * 
 * This endpoint generates vector embeddings for text using OpenAI
 */
router.post('/embeddings',
  requireAuth,
  validate(embeddingsValidators),
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      const { text, model, save, type, metadata } = req.body;
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ 
          status: 'error',
          message: 'Text is required and must be a string'
        });
      }
      
      logger.info(`Embeddings request received - userId: ${req.user.uid}, textLength: ${text.length}`, {
        originalUrl: req.originalUrl,
        path: req.path
      });
      
      const result = await proxyService.makeRequest({
        url: 'https://api.openai.com/v1/embeddings',
        method: 'POST',
        data: { input: text, model: model || 'text-embedding-3-small' },
        service: 'openai',
        userId: req.user.uid
      });
      
      const embedding = result?.data?.[0]?.embedding;

      if (save && embedding) {
        await saveEmbedding(req.user.uid, text, embedding, type || 'text', metadata || {});
        logger.info(`Embeddings saved for userId: ${req.user.uid}`);
      }
      
      const responseTime = Date.now() - startTime;
      logger.info('Embeddings response success', {
        userId: req.user.uid,
        responseTime
      });
      
      res.json({
        status: 'success',
        data: {
          embedding: embedding,
          model: model,
          dimensions: embedding.length
        },
        meta: {
          responseTime
        }
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.logError(error, req, 'Embeddings Proxy Error');
      
      res.status(error.statusCode || 500).json({
        status: 'error',
        message: error.message || 'An error occurred while generating embeddings',
        details: error.details || {},
        meta: {
          responseTime
        }
      });
    }
  }
);

/**
 * Extract data from text using AI
 * POST /api/proxy/extract-data
 * 
 * This endpoint extracts structured data from text using Groq LLM
 */
router.post('/extract-data',
  requireAuth,
  validate(extractDataValidators),
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      const { message, fields, model = 'llama3-8b-8192' } = req.body;
      
      logger.info('Extract data request', {
        userId: req.user.uid,
        messageLength: message.length,
        fieldsCount: fields.length,
        model
      });
      
      const groqData = { 
        model: model, 
        messages: [ /* Construct messages based on message and fields */ ],
        // ... other Groq params ...
      };
      // TODO: Construct the actual messages array for Groq based on fields/prompts
      // This logic might need to move to proxyService or stay here

      const result = await proxyService.makeRequest({
        url: 'https://api.groq.com/openai/v1/chat/completions',
        method: 'POST',
        data: groqData,
        service: 'groq',
        userId: req.user.uid
      });

      // TODO: Parse result.choices[0].message.content to get extracted data
      const extractedData = {}; // Placeholder

      const responseTime = Date.now() - startTime;
      logger.info('Extract data response success', {
        userId: req.user.uid,
        responseTime
      });
      
      res.json({
        status: 'success',
        data: extractedData,
        meta: {
          responseTime,
          model
        }
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.logError(error, req, 'Extract Data Proxy Error');
      
      res.status(error.statusCode || 500).json({
        status: 'error',
        message: error.message || 'An error occurred while extracting data',
        details: error.details || {},
        meta: {
          responseTime
        }
      });
    }
  }
);

/**
 * Match documents using embeddings
 * POST /api/proxy/match-documents
 * 
 * This endpoint performs vector similarity search using embeddings
 */
router.post('/match-documents',
  requireAuth,
  validate(matchDocumentsValidators),
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      const { text, embedding, threshold = 0.7, limit = 5 } = req.body;
      
      logger.info('Match documents request', {
        userId: req.user.uid,
        hasText: !!text,
        hasEmbedding: !!embedding,
        threshold,
        limit
      });
      
      let queryEmbedding = embedding;
      if (!queryEmbedding && text) {
        queryEmbedding = await generateEmbeddings(text);
      }
      
      const matches = await matchDocuments(req.user.uid, queryEmbedding, threshold, limit);
      
      const responseTime = Date.now() - startTime;
      logger.info('Match documents response success', {
        userId: req.user.uid,
        matchesCount: matches.length,
        responseTime
      });
      
      res.json({
        status: 'success',
        data: {
           matches,
           count: matches.length
         },
        meta: {
          responseTime,
          threshold,
          limit
        }
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.logError(error, req, 'Match documents request error');
      
      res.status(500).json({
        status: 'error',
        message: error.message || 'An error occurred while matching documents',
        meta: {
          responseTime
        }
      });
    }
  }
);

/**
 * POST /api/proxy/openai/chat/completions  <-- NEW SPECIFIC ROUTE
 * Proxies requests specifically to OpenAI's chat completions endpoint.
 */
router.post('/openai/chat/completions',
    requireAuth,
    // Add validation if needed for the request body (e.g., ensuring 'data' exists)
    async (req, res) => {
        const startTime = Date.now();
        // Extract the OpenAI request data from the main request body's 'data' field
        const openAIData = req.body.data;

        if (!openAIData || typeof openAIData !== 'object') {
             return res.status(400).json({ status: 'error', message: 'Missing or invalid \'data\' field in request body for OpenAI proxy.' });
        }
        // Basic validation for messages array
        if (!Array.isArray(openAIData.messages) || openAIData.messages.length === 0) {
             return res.status(400).json({ status: 'error', message: 'Missing or invalid \'messages\' array in OpenAI data.' });
        }

        try {
            logger.info(`Proxying to OpenAI Chat Completions - User: ${req.user.uid}`);

            const result = await proxyService.makeRequest({
                // Hardcode the specific OpenAI endpoint
                url: 'https://api.openai.com/v1/chat/completions',
                method: 'POST',
                // Pass the nested 'data' object as the actual request body for OpenAI
                data: openAIData,
                // Headers are handled by proxyService (including OpenAI key)
                headers: {},
                params: {},
                service: 'openai', // Identify the service for auth handling
                userId: req.user.uid
            });

            const responseTime = Date.now() - startTime;
            logger.info(`OpenAI Chat Completions Proxy Success - User: ${req.user.uid}, Time: ${responseTime}ms`);

            res.json({
                status: 'success',
                // Return the data received from OpenAI
                data: result,
                meta: { responseTime }
            });

        } catch (error) {
            const responseTime = Date.now() - startTime;
            // Use the logger's error handler (assuming logError exists)
            if (logger.logError) {
                 logger.logError(error, req, 'OpenAI Chat Completions Proxy Error');
            } else {
                 logger.error('OpenAI Chat Completions Proxy Error:', { message: error.message, status: error.statusCode, details: error.details, userId: req.user.uid });
            }
            
            res.status(error.statusCode || 500).json({
                status: 'error',
                message: error.message || 'Failed to proxy request to OpenAI Chat Completions.',
                details: error.details || {},
                meta: { responseTime }
            });
        }
    }
);

/**
 * Route handler for proxy requests to external services
 * POST /api/proxy/:service/*
 * 
 * Dynamic endpoint that handles all other proxy requests to supported services
 * 
 * @authentication Required
 * @request
 *   - service: Service identifier (openai, groq, supabase, google, sheets)
 *   - method: HTTP method to use (default: GET)
 *   - data: Request body (optional)
 *   - headers: Additional headers (optional)
 *   - params: URL parameters (optional)
 * 
 * @response
 *   Success:
 *     {
 *       "status": "success",
 *       "data": {}, // Response data from external service
 *       "meta": {
 *         "responseTime": 123 // milliseconds
 *       }
 *     }
 *   
 *   Error:
 *     {
 *       "status": "error",
 *       "message": "Error message",
 *       "details": {}, // Additional error details
 *       "meta": {
 *         "responseTime": 123 // milliseconds
 *       }
 *     }
 */
router.post('/:service/*', requireAuth, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { service } = req.params;
    const endpoint = req.path.replace(`/${service}`, '');
    const { method = 'GET', data, headers = {}, params } = req.body;
    
    // Validate the service
    const validServices = ['groq', 'openai', 'supabase', 'google', 'sheets'];
    if (!validServices.includes(service)) {
      const responseTime = Date.now() - startTime;
      return res.status(400).json({ 
        status: 'error',
        message: `Invalid service: ${service}. Valid services are: ${validServices.join(', ')}`,
        meta: {
          responseTime
        }
      });
    }
    
    // Add user ID to request headers for tracking
    headers['X-User-Id'] = req.user.uid;
    
    // For Google APIs, forward the user's access token
    if (service === 'google' || service === 'sheets') {
      // Check if Authorization header was already provided from client
      if (!headers.Authorization && !headers.authorization) {
        // Get user's Google credentials from Firestore
        const googleCreds = await googleService.getCredentialsForUser(req.user.uid);
        if (!googleCreds || !googleCreds.access_token) {
          const responseTime = Date.now() - startTime;
          return res.status(401).json({ 
            status: 'error',
            message: 'Google API access token not available',
            meta: {
              responseTime
            }
          });
        }
        
        // Add authorization header with proper Bearer format
        headers.Authorization = `Bearer ${googleCreds.access_token}`;
      }
    }
    
    logger.info('Dynamic proxy request', {
      userId: req.user.uid,
      service,
      endpoint,
      method
    });
    
    // Make the request via the proxy service
    const response = await proxyService.makeRequest({
      url: endpoint,
      method,
      data,
      headers,
      params,
      service,
      userId: req.user.uid
    });
    
    const responseTime = Date.now() - startTime;
    logger.info('Dynamic proxy response success', {
      userId: req.user.uid,
      service,
      endpoint,
      responseTime
    });
    
    // Return the proxied response
    res.json({
      status: 'success',
      data: response,
      meta: {
        responseTime
      }
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.logError(error, req, 'Dynamic proxy request error');
    
    // Return appropriate error status code
    const statusCode = error.status || 500;
    res.status(statusCode).json({ 
      status: 'error',
      message: error.message || 'Proxy request failed',
      details: error.details || null,
      meta: {
        responseTime
      }
    });
  }
});

module.exports = router; 