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
 * Save embedding for user
 * @param {string} userId - User ID
 * @param {string} content - Text content
 * @param {Array<number>} embedding - Vector embedding
 * @param {string} type - Type of embedding
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Created or updated embedding
 */
const saveEmbedding = async (userId, content, embedding, type, metadata = {}) => {
  try {
    logger.debug(`Saving embedding for user: ${userId}, type: ${type}`);

    // Include the type and user_id in metadata to ensure n8n compatibility
    // This allows n8n to filter by user_id via the metadata field
    const updatedMetadata = {
      ...metadata,
      embedding_type: type,
      user_id: userId // Duplicate user_id in metadata for n8n compatibility
    };

    // Step 1: Delete existing embeddings for this user that match the type in metadata
    try {
      logger.debug(`Attempting to delete existing embedding for user: ${userId}, type: ${type}`);
      await makeRequest({
        url: `${SUPABASE_URL}/rest/v1/user_embeddings`,
        method: 'DELETE',
        service: 'supabase',
        params: {
          user_id: `eq.${userId}`,
          'metadata->>embedding_type': `eq.${type}`
        },
        headers: {
          // Prefer minimal ensures we don't get the deleted data back, slightly more efficient
          'Prefer': 'return=minimal'
        }
      });
      logger.info(`Successfully deleted any existing embedding for user: ${userId}, type: ${type}`);
    } catch (deleteError) {
       // Log the error but proceed, as the INSERT might still be valid (e.g., if delete fails because nothing exists)
       logger.warn(`Warning during delete pre-check for embedding (user: ${userId}, type: ${type}): ${deleteError.message}`);
       // We don't rethrow here, we still want to attempt the insert.
    }

    // Step 2: Insert the new embedding
    logger.debug(`Inserting new embedding for user: ${userId}, type: ${type}`);
    const response = await makeRequest({
      url: `${SUPABASE_URL}/rest/v1/user_embeddings`,
      method: 'POST',
      service: 'supabase',
      data: {
        user_id: userId,
        content,
        embedding,
        metadata: updatedMetadata
      },
      headers: {
        'Prefer': 'return=representation' // Request the inserted row back
      }
    });
    
    // Ensure response is valid and has an ID
    if (!response || !response.id) {
      logger.error('Failed to create embedding or invalid response received after insert', { userId, type, response });
      throw new Error('Failed to create embedding: Invalid response from Supabase after insert');
    }
    
    logger.info('Successfully inserted new embedding in Supabase', { 
      userId,
      type,
      embeddingId: response.id 
    });
    
    // Return the ID of the newly created embedding
    return { id: response.id, created: true };
    
  } catch (error) {
    logger.error('Error in saveEmbedding process', {
      userId,
      type,
      errorMessage: error.message,
      errorDetails: error.response?.data || error.details || error.stack
    });
    // Rethrow a generic error message for the client
    throw new Error(`Failed to save embedding: ${error.message}`); 
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
  matchDocuments
}; 