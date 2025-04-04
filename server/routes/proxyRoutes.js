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
} = require('../utils/validators/proxyValidators');
const proxyService = require('../services/proxyService');
const { generateEmbeddings, extractDataWithGroq } = require('../services/aiService');
const { saveEmbedding, matchDocuments } = require('../services/supabaseService');
const googleService = require('../services/googleService');

const router = express.Router();

/**
 * Generic proxy endpoint for external API calls
 * POST /api/proxy
 */
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
 * POST /api/embeddings
 * POST /api/proxy/embeddings (both routes should work)
 */
router.post('/embeddings',
  requireAuth,
  validate(embeddingsValidators),
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      const { text, model = 'text-embedding-3-small', save = false, type = 'text', metadata = {} } = req.body;
      
      if (!text || typeof text !== 'string') {
        logger.warn('Invalid embeddings request: missing or invalid text', {
          userId: req.user?.uid,
          textType: typeof text
        });
        return res.status(400).json({ 
          status: 'error', 
          message: 'Text is required and must be a string' 
        });
      }
      
      // Log request for monitoring (excluding text content for privacy)
      logger.info('Embeddings request received', { 
        userId: req.user.uid,
        textLength: text.length,
        model,
        save,
        type
      });
      
      // Generate mock embeddings in development mode if needed
      let embeddings;
      // Check for development mode test user or dev_mode flag
      if (process.env.NODE_ENV === 'development' && 
          (req.user.dev_mode || req.user.uid === 'test-user-development')) {
        logger.info('Generating mock embeddings in development mode', {
          userId: req.user.uid,
          model,
          textLength: text.length
        });
        
        // Generate mock embeddings of fixed length (1536 for text-embedding-3-small)
        const dimensions = 1536;
        embeddings = Array(dimensions).fill(0).map(() => Math.random() * 2 - 1);
      } else {
        // Generate real embeddings via AI service
        embeddings = await generateEmbeddings(text, model);
      }
      
      if (!embeddings || !Array.isArray(embeddings)) {
        throw new Error('Failed to generate valid embeddings');
      }
      
      // Save embeddings to database if requested
      if (save && embeddings) {
        try {
          await saveEmbedding(req.user.uid, text, embeddings, type, metadata);
          logger.info('Embeddings saved to database', {
            userId: req.user.uid,
            type
          });
        } catch (saveError) {
          // Log save error but don't fail the request
          logger.error('Error saving embeddings', {
            userId: req.user.uid,
            error: saveError.message
          });
          // Continue with response as the primary embedding generation was successful
        }
      }
      
      const responseTime = Date.now() - startTime;
      logger.info('Embeddings response success', {
        userId: req.user.uid,
        dimensions: embeddings.length,
        responseTime
      });
      
      // Set specific headers for cross-origin requests to ensure proper CORS handling
      // This helps with localhost:8080 to localhost:3000 requests
      res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.header('Access-Control-Allow-Credentials', 'true');
      
      res.json({
        status: 'success',
        data: {
          embedding: embeddings,
          model: model,
          dimensions: embeddings.length
        },
        meta: {
          responseTime,
          dev_mode: process.env.NODE_ENV === 'development' && (req.user.dev_mode || req.user.uid === 'test-user-development')
        }
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error('Embeddings request error', {
        userId: req.user?.uid,
        error: error.message,
        stack: error.stack,
        responseTime
      });
      
      // Set CORS headers on error responses too
      res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.header('Access-Control-Allow-Credentials', 'true');
      
      res.status(500).json({
        status: 'error',
        message: error.message || 'An error occurred while generating embeddings',
        meta: {
          responseTime
        }
      });
    }
  }
);

/**
 * Extract data from text using AI
 * POST /api/extract-data
 */
router.post('/extract-data',
  requireAuth,
  validate(extractDataValidators),
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      const { message, fields, model = 'deepseek-r1-distill-llama-70b' } = req.body;
      
      logger.info('Extract data request', {
        userId: req.user.uid,
        messageLength: message.length,
        fieldsCount: fields.length,
        model
      });
      
      const extractedData = await extractDataWithGroq(message, fields);
      
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
      logger.logError(error, req, 'Extract data request error');
      
      res.status(500).json({
        status: 'error',
        message: error.message || 'An error occurred while extracting data',
        meta: {
          responseTime
        }
      });
    }
  }
);

/**
 * Match documents using embeddings
 * POST /api/match-documents
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
      
      // Generate embedding from text if not provided
      let queryEmbedding = embedding;
      if (!queryEmbedding && text) {
        queryEmbedding = await generateEmbeddings(text);
      }
      
      // Match documents using the embedding
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
 * Route handler for proxy requests to external services
 * Requires proper authorization
 */
router.post('/:service/*', requireAuth, async (req, res) => {
  try {
    const { service } = req.params;
    const endpoint = req.path.replace(`/proxy/${service}`, '');
    const { method = 'GET', data, headers = {}, params } = req.body;
    
    // Log the request details for debugging
    logger.debug(`Processing proxy request for ${service}`, {
      service,
      endpoint,
      method,
      headers: Object.keys(headers)
    });
    
    // Validate the service
    const validServices = ['groq', 'openai', 'supabase', 'google', 'sheets'];
    if (!validServices.includes(service)) {
      return res.status(400).json({ 
        error: `Invalid service: ${service}. Valid services are: ${validServices.join(', ')}` 
      });
    }
    
    // Set CORS headers for the response
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Service, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // Add user ID to request headers for tracking
    headers['X-User-Id'] = req.user.uid;
    
    // Also extract service from headers if present (might be sent from frontend)
    if (req.headers['x-service']) {
      headers['X-Service'] = req.headers['x-service'];
    }
    
    // For Google APIs, forward the user's access token
    if (service === 'google' || service === 'sheets') {
      // Check if Authorization header was already provided from client
      if (!headers.Authorization && !headers.authorization) {
        // Get user's Google credentials from Firestore
        const googleCreds = await googleService.getCredentialsForUser(req.user.uid);
        if (!googleCreds || !googleCreds.access_token) {
          return res.status(401).json({ error: 'Google API access token not available' });
        }
        
        // Add authorization header with proper Bearer format
        headers.Authorization = `Bearer ${googleCreds.access_token}`;
      }
    }
    
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
    
    // Return the proxied response
    res.json(response);
  } catch (error) {
    logger.error(`Proxy error for ${req.path}: ${error.message}`, error);
    
    // Set CORS headers even on error responses
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Service, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // Return appropriate error status code
    const statusCode = error.status || 500;
    res.status(statusCode).json({ 
      error: error.message || 'Proxy request failed',
      details: error.details || null
    });
  }
});

/**
 * Handle OPTIONS requests for CORS preflight
 */
router.options('/:service/*', (req, res) => {
  // Set CORS headers for preflight
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Service, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Respond with 204 No Content
  res.status(204).end();
});

module.exports = router; 