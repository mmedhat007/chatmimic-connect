/**
 * Proxy service for external API calls
 * Handles authentication, error handling, and request/response processing
 */

const axios = require('axios');
const logger = require('../utils/logger');
const googleService = require('./googleService');

// Configure axios defaults
const apiClient = axios.create({
  timeout: 30000, // 30 second timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// >>> DEBUG: Log after apiClient creation // REMOVE
// logger.debug('[proxyService] apiClient (axios instance) created.');
// <<< END DEBUG

// Add request interceptors for logging
apiClient.interceptors.request.use(
  (config) => {
    // >>> DEBUG: Simplified interceptor - just log URL/Method // REVERTED
    /* // Original interceptor code restored
    const sanitizedConfig = {
      ...config,
      headers: { ...config.headers },
    };
    
    // Redact sensitive information from logs
    if (sanitizedConfig.headers.Authorization) {
      sanitizedConfig.headers.Authorization = 'Bearer [REDACTED]';
    }
    
    logger.debug('External API Request', {
      method: config.method?.toUpperCase(),
      url: config.url,
      headers: sanitizedConfig.headers,
    });
    */ // <<< END REVERT
    
    return config;
  },
  (error) => {
    logger.error('Error in API request config', { error: error.message });
    return Promise.reject(error);
  }
);

// Add response interceptors for logging
apiClient.interceptors.response.use(
  (response) => {
    logger.debug('External API Response', {
      status: response.status,
      statusText: response.statusText,
      url: response.config.url,
      method: response.config.method?.toUpperCase(),
      responseSize: JSON.stringify(response.data).length,
    });
    
    return response;
  },
  (error) => {
    logger.error('External API Error', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      method: error.config?.method?.toUpperCase(),
      responseData: error.response?.data,
    });
    
    return Promise.reject(error);
  }
);

/**
 * Makes a request to an external API
 * @param {Object} options - Request options
 * @param {string} options.url - Target URL
 * @param {string} options.method - HTTP method
 * @param {Object} options.data - Request body
 * @param {Object} options.headers - Additional headers
 * @param {Object} options.params - URL parameters
 * @param {string} options.service - Service name for authentication (e.g., 'groq', 'supabase', 'openai')
 * @param {string} options.userId - User ID for requests requiring user context
 * @returns {Promise<Object>} Response data
 */
const makeRequest = async ({ url, method = 'GET', data = {}, headers = {}, params = {}, service, userId }) => {
  try {
    // Add service-specific authentication
    const authHeaders = await getAuthHeaders(service, headers, userId);
    
    // Create a clean headers object with all normalized headers
    const normalizedHeaders = normalizeHeaders({...headers, ...authHeaders});
    
    // >>> DEBUG: Log the full config passed to apiClient // REMOVED
    /*
    const axiosConfig = {
      url,
      method,
      data,
      params,
      headers: normalizedHeaders,
    };
    logger.debug('[makeRequest] Config passed to apiClient:', { axiosConfig }); 
    */
    // <<< END DEBUG

    // >>> DEBUG: Add logging around apiClient call // REMOVE
    // logger.debug('[makeRequest] BEFORE apiClient call', { url, method, service });
    /*
    const response = await apiClient({
      url,
      method,
      data,
      params,
      headers: normalizedHeaders,
    });
    */
    // logger.debug('[makeRequest] AFTER apiClient call');
    // <<< END DEBUG
    
    // Restore original call
    const response = await apiClient({
      url,
      method,
      data,
      params,
      headers: normalizedHeaders,
    });

    return response.data;
  } catch (error) {
    // Specific handling for Google token errors
    if (service === 'google' || service === 'sheets') {
      if (error.response?.status === 401 && userId) {
        logger.warn(`Google API returned 401 for user ${userId}, attempting token refresh`);
        try {
          // Try to refresh token and retry the request
          const credentials = await googleService.getValidCredentials(userId);
          
          // Update headers with new token
          headers.Authorization = `Bearer ${credentials.access_token}`;
          
          // Retry the request with refreshed token
          const normalizedHeaders = normalizeHeaders({...headers});
          
          const retryResponse = await apiClient({
            url,
            method,
            data,
            params,
            headers: normalizedHeaders,
          });
          
          return retryResponse.data;
        } catch (refreshError) {
          logger.error(`Failed to refresh token for user ${userId}:`, refreshError);
          throw new Error(`Failed to refresh token: ${refreshError.message}`);
        }
      }
    }
    
    // Transform error into a standardized format
    const formattedError = formatError(error, service);
    throw formattedError;
  }
};

/**
 * Normalize headers to ensure consistent casing and formatting
 * @param {Object} headers - Headers object
 * @returns {Object} Normalized headers
 */
const normalizeHeaders = (headers) => {
  const normalized = {};
  
  // Convert all header names to their canonical form
  Object.keys(headers).forEach(key => {
    const lowerKey = key.toLowerCase();
    
    // Handle authorization specially to ensure Bearer prefix
    if (lowerKey === 'authorization') {
      const value = headers[key];
      if (value && typeof value === 'string' && !value.startsWith('Bearer ')) {
        normalized['Authorization'] = `Bearer ${value}`;
      } else {
        normalized['Authorization'] = value;
      }
    } else {
      // For other headers, use original casing but deduplicate
      normalized[key] = headers[key];
    }
  });
  
  return normalized;
};

/**
 * Get authentication headers for different services
 * @param {string} service - Service name
 * @param {Object} headers - Headers passed in from the request
 * @param {string} userId - User ID for requests requiring user context
 * @returns {Promise<Object>} Headers with authentication
 */
const getAuthHeaders = async (service, headers = {}, userId) => {
  const authHeaders = {};
  
  switch (service) {
    case 'groq':
      authHeaders['Authorization'] = `Bearer ${process.env.GROQ_API_KEY}`;
      break;
    
    case 'openai':
      authHeaders['Authorization'] = `Bearer ${process.env.OPENAI_API_KEY}`;
      break;
      
    case 'supabase':
      authHeaders['apiKey'] = process.env.SUPABASE_SERVICE_ROLE_KEY;
      break;

    case 'google':
    case 'sheets':
      // For Google API calls, get fresh credentials if not provided
      if (!headers.Authorization && !headers.authorization && userId) {
        try {
          const credentials = await googleService.getValidCredentials(userId);
          if (credentials && credentials.access_token) {
            authHeaders.Authorization = `Bearer ${credentials.access_token}`;
          }
        } catch (error) {
          logger.error(`Error getting Google credentials for user ${userId}:`, error);
          throw new Error(`Failed to get Google credentials: ${error.message}`);
        }
      }
      break;
      
    // Add additional services as needed
    
    default:
      // No auth headers for unknown services
      break;
  }
  
  return authHeaders;
};

/**
 * Format API errors consistently
 * @param {Error} error - Original error
 * @param {string} service - Service name
 * @returns {Error} Formatted error
 */
const formatError = (error, service) => {
  let message = error.message || 'Unknown error';
  let statusCode = error.response?.status || 500;
  let details = error.response?.data || {};
  
  // Create a new error with additional properties
  const formattedError = new Error(message);
  formattedError.statusCode = statusCode;
  formattedError.service = service;
  formattedError.details = details;
  
  // Add service-specific error handling
  if (service === 'groq' && details.error) {
    formattedError.message = details.error.message || message;
  } else if (service === 'openai' && details.error) {
    formattedError.message = details.error.message || message;
  } else if (service === 'supabase' && details.error) {
    formattedError.message = details.error || message;
  } else if ((service === 'google' || service === 'sheets') && details.error) {
    formattedError.message = details.error.message || message;
  }
  
  return formattedError;
};

module.exports = {
  makeRequest,
}; 