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
const { makeRequest } = require('../services/proxyService');
const { generateEmbeddings, extractDataWithGroq } = require('../services/aiService');
const { saveEmbedding, matchDocuments } = require('../services/supabaseService');

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
      
      const result = await makeRequest({
        url: endpoint,
        method: method || 'GET',
        data,
        headers,
        params,
        service
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
      const { text, model = 'text-embedding-3-small', save = false, type, metadata } = req.body;
      
      logger.info('Embeddings request', {
        userId: req.user.uid,
        textLength: text.length,
        model
      });
      
      const embedding = await generateEmbeddings(text);
      
      // Optionally save the embedding to the database
      if (save && type) {
        await saveEmbedding(req.user.uid, text, embedding, type, metadata || {});
      }
      
      const responseTime = Date.now() - startTime;
      logger.info('Embeddings response success', {
        userId: req.user.uid,
        responseTime
      });
      
      res.json({
        status: 'success',
        data: {
          embedding,
          model: 'text-embedding-3-small',
          dimensions: embedding.length
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

module.exports = router; 