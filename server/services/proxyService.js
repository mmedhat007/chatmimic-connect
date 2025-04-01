/**
 * Proxy service for external API calls
 * Handles authentication, error handling, and request/response processing
 */

const axios = require('axios');
const logger = require('../utils/logger');

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
 * @returns {Promise<Object>} Response data
 */
const makeRequest = async ({ url, method = 'GET', data = {}, headers = {}, params = {}, service }) => {
  try {
    // Add service-specific authentication
    const authHeaders = await getAuthHeaders(service);
    
    const response = await apiClient({
      url,
      method,
      data,
      params,
      headers: {
        ...headers,
        ...authHeaders,
      },
    });
    
    return response.data;
  } catch (error) {
    // Transform error into a standardized format
    const formattedError = formatError(error, service);
    throw formattedError;
  }
};

/**
 * Get authentication headers for different services
 * @param {string} service - Service name
 * @returns {Object} Headers with authentication
 */
const getAuthHeaders = async (service) => {
  const headers = {};
  
  switch (service) {
    case 'groq':
      headers['Authorization'] = `Bearer ${process.env.GROQ_API_KEY}`;
      break;
    
    case 'openai':
      headers['Authorization'] = `Bearer ${process.env.OPENAI_API_KEY}`;
      break;
      
    case 'supabase':
      headers['apiKey'] = process.env.SUPABASE_SERVICE_ROLE_KEY;
      break;
      
    // Add additional services as needed
    
    default:
      // No auth headers for unknown services
      break;
  }
  
  return headers;
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
  }
  
  return formattedError;
};

module.exports = {
  makeRequest,
}; 