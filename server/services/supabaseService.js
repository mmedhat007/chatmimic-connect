/**
 * Supabase Service for database operations
 */

const { makeRequest } = require('./proxyService');
const logger = require('../utils/logger');

// Supabase URL from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;

/**
 * Save user configuration to Supabase
 * @param {string} userId - Firebase user ID
 * @param {Object} config - User configuration object
 * @returns {Promise<Object>} Saved configuration
 */
const saveUserConfig = async (userId, config) => {
  try {
    logger.debug('Saving user config to Supabase', { userId });
    
    // First, check if a record already exists
    const existingConfig = await fetchUserConfig(userId);
    
    // Extract and format behavior rules
    const behaviorRulesArray = config.behavior_rules || [];
    const enabledRules = behaviorRulesArray.filter(rule => rule.enabled);
    
    // Format rules for storage
    const formattedRules = enabledRules.map(rule => {
      return rule.description 
        ? `${rule.rule}: ${rule.description}` 
        : rule.rule;
    });
    
    // Create simplified format for behavior rules
    const simplifiedBehaviorRules = {
      rules: [
        {
          rules: formattedRules.join(' | ')
        }
      ],
      last_updated: new Date().toISOString(),
      version: "1.0"
    };
    
    let response;
    
    if (existingConfig) {
      // Update existing config
      response = await makeRequest({
        url: `${SUPABASE_URL}/rest/v1/user_configs`,
        method: 'PATCH',
        service: 'supabase',
        data: {
          full_config: config,
          behavior_rules: simplifiedBehaviorRules,
          updated_at: new Date().toISOString()
        },
        headers: {
          'Prefer': 'return=minimal'
        },
        params: {
          user_id: `eq.${userId}`
        }
      });
      
      logger.info('Updated user config in Supabase', { userId });
    } else {
      // Create new config
      response = await makeRequest({
        url: `${SUPABASE_URL}/rest/v1/user_configs`,
        method: 'POST',
        service: 'supabase',
        data: {
          user_id: userId,
          full_config: config,
          behavior_rules: simplifiedBehaviorRules,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        headers: {
          'Prefer': 'return=minimal'
        }
      });
      
      logger.info('Created new user config in Supabase', { userId });
    }
    
    return { success: true, config };
  } catch (error) {
    logger.error('Error saving user config to Supabase', {
      userId,
      error: error.message
    });
    throw new Error(`Failed to save user configuration: ${error.message}`);
  }
};

/**
 * Fetch user configuration from Supabase
 * @param {string} userId - Firebase user ID
 * @returns {Promise<Object|null>} User configuration or null if not found
 */
const fetchUserConfig = async (userId) => {
  try {
    logger.debug('Fetching user config from Supabase', { userId });
    
    const response = await makeRequest({
      url: `${SUPABASE_URL}/rest/v1/user_configs`,
      method: 'GET',
      service: 'supabase',
      params: {
        user_id: `eq.${userId}`,
        select: '*'
      }
    });
    
    if (Array.isArray(response) && response.length > 0) {
      logger.debug('Found user config in Supabase', { userId });
      return response[0];
    }
    
    logger.debug('No user config found in Supabase', { userId });
    return null;
  } catch (error) {
    logger.error('Error fetching user config from Supabase', {
      userId,
      error: error.message
    });
    throw new Error(`Failed to fetch user configuration: ${error.message}`);
  }
};

/**
 * Create or update embedding in Supabase
 * @param {string} userId - Firebase user ID
 * @param {string} content - Content to create embedding for
 * @param {Array<number>} embedding - Embedding vector
 * @param {string} type - Type of embedding (e.g., 'rule', 'document')
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Created or updated embedding
 */
const saveEmbedding = async (userId, content, embedding, type, metadata = {}) => {
  try {
    logger.debug('Saving embedding to Supabase', { userId, type });
    
    // Generate hash of content to use as a unique identifier
    const contentHash = require('crypto')
      .createHash('md5')
      .update(content)
      .digest('hex');
    
    // Check if embedding already exists
    const existingEmbedding = await getEmbedding(userId, contentHash);
    
    let response;
    
    if (existingEmbedding) {
      // Update existing embedding
      response = await makeRequest({
        url: `${SUPABASE_URL}/rest/v1/user_embeddings`,
        method: 'PATCH',
        service: 'supabase',
        data: {
          content,
          embedding,
          metadata,
          updated_at: new Date().toISOString()
        },
        headers: {
          'Prefer': 'return=minimal'
        },
        params: {
          id: `eq.${existingEmbedding.id}`
        }
      });
      
      logger.info('Updated embedding in Supabase', { 
        userId, 
        embeddingId: existingEmbedding.id
      });
      
      return { id: existingEmbedding.id, updated: true };
    } else {
      // Create new embedding
      response = await makeRequest({
        url: `${SUPABASE_URL}/rest/v1/user_embeddings`,
        method: 'POST',
        service: 'supabase',
        data: {
          user_id: userId,
          content,
          content_hash: contentHash,
          embedding,
          embedding_type: type,
          metadata,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        headers: {
          'Prefer': 'return=representation'
        }
      });
      
      logger.info('Created new embedding in Supabase', { 
        userId,
        embeddingId: response.id 
      });
      
      return { id: response.id, created: true };
    }
  } catch (error) {
    logger.error('Error saving embedding to Supabase', {
      userId,
      type,
      error: error.message
    });
    throw new Error(`Failed to save embedding: ${error.message}`);
  }
};

/**
 * Get an embedding by content hash
 * @param {string} userId - Firebase user ID
 * @param {string} contentHash - Hash of the content
 * @returns {Promise<Object|null>} Embedding or null if not found
 */
const getEmbedding = async (userId, contentHash) => {
  try {
    const response = await makeRequest({
      url: `${SUPABASE_URL}/rest/v1/user_embeddings`,
      method: 'GET',
      service: 'supabase',
      params: {
        user_id: `eq.${userId}`,
        content_hash: `eq.${contentHash}`,
        select: '*'
      }
    });
    
    if (Array.isArray(response) && response.length > 0) {
      return response[0];
    }
    
    return null;
  } catch (error) {
    logger.error('Error getting embedding from Supabase', {
      userId,
      contentHash,
      error: error.message
    });
    throw new Error(`Failed to get embedding: ${error.message}`);
  }
};

/**
 * Match documents using embeddings
 * @param {string} userId - Firebase user ID
 * @param {Array<number>} embedding - Query embedding
 * @param {number} threshold - Similarity threshold (0-1)
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array<Object>>} Matching documents
 */
const matchDocuments = async (userId, embedding, threshold = 0.7, limit = 5) => {
  try {
    logger.debug('Matching documents with embedding', { 
      userId, 
      threshold, 
      limit 
    });
    
    const response = await makeRequest({
      url: `${SUPABASE_URL}/rest/v1/rpc/match_documents_with_embedding`,
      method: 'POST',
      service: 'supabase',
      data: {
        query_embedding: embedding,
        similarity_threshold: threshold,
        match_count: limit,
        user_id: userId
      }
    });
    
    logger.debug('Document matching results', { 
      count: response.length 
    });
    
    return response;
  } catch (error) {
    logger.error('Error matching documents with embedding', {
      userId,
      error: error.message
    });
    throw new Error(`Failed to match documents: ${error.message}`);
  }
};

module.exports = {
  saveUserConfig,
  fetchUserConfig,
  saveEmbedding,
  getEmbedding,
  matchDocuments
}; 