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

// Add request interceptors for logging
apiClient.interceptors.request.use(
  (config) => {
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
 * @param {string} options.cleanKey - Clean API key (optional, for OpenAI)
 * @returns {Promise<Object>} Response data
 */
const makeRequest = async ({ url, method = 'GET', data = {}, headers = {}, params = {}, service, userId, cleanKey }) => {
  try {
    if (!url) {
      throw new Error('URL is required for API request');
    }

    // Log sanitized request details
    const sanitizedData = { ...data };
    if (sanitizedData.input) {
      sanitizedData.input = `${typeof sanitizedData.input === 'string' ? sanitizedData.input.substring(0, 20) : '[data]'}... (truncated)`;
    }
    logger.debug('Making external API request', {
      url,
      method,
      service,
      userId: userId || 'not-provided',
      dataKeys: Object.keys(data || {})
    });
    
    // Get standard headers with content type
    const normalizedHeaders = normalizeHeaders(headers);
    
    // Add service-specific auth headers
    let authHeaders = {};
    if (service) {
      // If we have a clean key for OpenAI, use it directly instead of getting from environment
      if (service === 'openai' && cleanKey) {
        authHeaders['Authorization'] = `Bearer ${cleanKey}`;
      } else {
        // Otherwise get auth headers normally
        authHeaders = await getAuthHeaders(service, normalizedHeaders, userId);
      }
    }
    
    // Combine all headers
    const requestHeaders = {
      ...normalizedHeaders,
      ...authHeaders
    };
    
    // Add useful default headers if not provided
    if (!requestHeaders['Content-Type'] && !requestHeaders['content-type']) {
      requestHeaders['Content-Type'] = 'application/json';
    }
    
    const axiosConfig = {
      url,
      method,
      headers: requestHeaders,
      timeout: 60000, // 60 second timeout for longer API calls
    };
    
    // Only add data for non-GET requests that have data
    if (method.toUpperCase() !== 'GET' && Object.keys(data || {}).length > 0) {
      axiosConfig.data = data;
    }
    
    // Add params if they exist
    if (Object.keys(params || {}).length > 0) {
      axiosConfig.params = params;
    }

    // Make the API request
    const response = await apiClient(axiosConfig);
    
    // Validate response exists and has data
    if (!response || response.status >= 400) {
      throw new Error(`API request failed with status: ${response?.status || 'unknown'}`);
    }
    
    return response.data;
  } catch (error) {
    // Log detailed error information
    logger.error('API request error', {
      url,
      method,
      service,
      errorMessage: error.message,
      errorName: error.name,
      errorCode: error.code,
      responseStatus: error.response?.status,
      responseData: error.response?.data,
    });

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
    case 'groq': {
      let groqKey = process.env.GROQ_API_KEY;
      // Handle possible line breaks in the API key
      if (groqKey) {
        groqKey = groqKey.replace(/[\r\n\s]+/g, '');
      }
      authHeaders['Authorization'] = `Bearer ${groqKey}`;
      break;
    }
    
    case 'openai': {
      let openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey || openaiKey.trim() === '') {
        logger.error('OpenAI API key missing or empty when creating auth headers');
        throw new Error('OpenAI API key is not configured. Please check the server/.env file.');
      }
      
      // Clean the key by removing any line breaks and whitespace
      openaiKey = openaiKey.replace(/[\r\n\s]+/g, '');
      if (openaiKey.length < 20) {
        logger.error('OpenAI API key appears to be invalid (too short)', {
          keyLength: openaiKey.length
        });
        throw new Error('OpenAI API key appears to be invalid (too short). Please check the server/.env file.');
      }
      
      authHeaders['Authorization'] = `Bearer ${openaiKey}`;
      break;
    }
      
    case 'supabase': {
      let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      // Handle possible line breaks in the API key
      if (supabaseKey) {
        supabaseKey = supabaseKey.replace(/[\r\n\s]+/g, '');
      }
      authHeaders['apiKey'] = supabaseKey;
      break;
    }

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