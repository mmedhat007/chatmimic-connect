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
 */
router.post('/embeddings',
  requireAuth,
  validate(embeddingsValidators),
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      const { text, model, save, type, metadata } = req.body;
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Text is required and must be a string' });
      }
      
      // Log request for monitoring (excluding text content for privacy)
      logger.info(`Embeddings request received - userId: ${req.user.uid}, textLength: ${text.length}`);
      
      // Generate embeddings via AI service
      const embeddings = await generateEmbeddings(text, model);
      
      // Save embeddings to database if requested
      if (save && embeddings) {
        await saveEmbedding(req.user.uid, text, embeddings, type || 'text', metadata || {});
        
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
          embedding: embeddings,
          model: model,
          dimensions: embeddings.length
        },
        meta: {
          responseTime
        }
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.logError(error, req, 'Embeddings request error');
      
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
    
    // Validate the service
    const validServices = ['groq', 'openai', 'supabase', 'google', 'sheets'];
    if (!validServices.includes(service)) {
      return res.status(400).json({ 
        error: `Invalid service: ${service}. Valid services are: ${validServices.join(', ')}` 
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
    
    // Return appropriate error status code
    const statusCode = error.status || 500;
    res.status(statusCode).json({ 
      error: error.message || 'Proxy request failed',
      details: error.details || null
    });
  }
});

module.exports = router; 