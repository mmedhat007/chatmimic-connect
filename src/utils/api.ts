/**
 * API utilities for interacting with the backend
 */

import { getAuth, getIdToken } from 'firebase/auth';
// import logger from './logger'; // Assuming you have a logger utility - Commented out for now

// Simple console logger replacement for now
const logger = {
  debug: (...args: any[]) => console.debug('[API Client]', ...args),
  info: (...args: any[]) => console.info('[API Client]', ...args),
  warn: (...args: any[]) => console.warn('[API Client]', ...args),
  error: (...args: any[]) => console.error('[API Client]', ...args),
};

// Base API URL - Adjusted to only use relative path for proxy compatibility
const API_BASE_URL = '/api'; 

/**
 * Base API request function that handles authentication and error formatting
 * @param path - API endpoint path (relative to /api)
 * @param options - Request options
 * @returns Promise with response data
 */
export const apiRequest = async (path: string, options: RequestInit = {}) => {
  const fullPath = path.startsWith('/api') ? path : `${API_BASE_URL}${path}`;
  const method = options.method || 'GET';
  logger.debug(`[apiRequest START] ${method} ${fullPath}`);

  let authToken: string | null = null;
  try {
    const auth = getAuth();
    const user = auth.currentUser;

    if (user) {
      logger.debug(`[apiRequest Auth] User object exists (uid: ${user.uid}), attempting to get ID token.`);
      try {
        // Try getting the token
        authToken = await getIdToken(user, /* forceRefresh */ false); 
        logger.debug(`[apiRequest Auth] getIdToken returned: type=${typeof authToken}, value=${authToken ? authToken.substring(0,10)+'...' : authToken}`);

        // *** Re-verify CRITICAL CHECK ***
        if (!authToken || typeof authToken !== 'string' || authToken.length < 10) {
           const errorMsg = 'Failed to retrieve Firebase ID token: getIdToken returned invalid value.';
           logger.error(`[apiRequest Auth Error] ${errorMsg}`, { 
               userId: user.uid, 
               tokenValue: authToken, // Log the actual value received
               tokenType: typeof authToken 
            });
           // Throw a specific error that calling code might need to catch explicitly
           const authError = new Error(errorMsg);
           authError.name = 'TokenRetrievalError';
           throw authError; 
        }
        // If we get here, token is a valid string
        logger.debug(`[apiRequest Auth] Token retrieved successfully.`);
        
      } catch (authError: any) {
        logger.error('[apiRequest Auth Error] Error explicitly thrown by getIdToken():', { 
           message: authError.message, 
           code: authError.code,
           name: authError.name,
           path: fullPath,
           userId: user.uid
         });
        // Re-throw but maybe wrap it or ensure name is set
        const wrappedError = new Error(`Authentication error during token retrieval: ${authError.message}`);
        wrappedError.name = authError.name === 'TokenRetrievalError' ? 'TokenRetrievalError' : 'GetIdTokenError';
        throw wrappedError;
      }
    } else {
      logger.warn(`[apiRequest Auth] No authenticated user found (auth.currentUser is null) for API Request: ${method} ${fullPath}`);
      // No token to add, proceed without Authorization header. Server will reject if needed.
    }

    // --- Prepare and make the fetch call --- 
    logger.debug(`[apiRequest Fetch] Preparing fetch call for ${method} ${fullPath}`);
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Only add header if we successfully got a valid token
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
        logger.debug(`[apiRequest Fetch] Authorization header added.`);
    } else {
        logger.warn(`[apiRequest Fetch] Proceeding without Authorization header for ${method} ${fullPath}`);
    }

    const requestOptions: RequestInit = {
      ...options,
      headers,
    };

    const response = await fetch(fullPath, requestOptions);
    logger.debug(`[apiRequest Fetch] Received response for ${method} ${fullPath}: Status ${response.status}`);

    // --- Handle response --- 
    // Handle HTTP errors
    if (!response.ok) {
      let errorData = { 
         status: 'error', 
         message: `API Error: ${response.status} ${response.statusText}`,
         details: { serverStatus: response.status }, // Initialize details
         meta: {} 
        };
      try {
        // Try to parse the JSON error body from our standardized server response
        const serverError = await response.json();
        errorData.message = serverError.message || errorData.message;
        errorData.details = serverError.details || { serverStatus: response.status };
        errorData.meta = serverError.meta || {};
        logger.warn(`[apiRequest Error] API Request failed with status ${response.status}:`, { 
            path: fullPath, 
            status: response.status, 
            serverMessage: errorData.message,
            details: errorData.details 
        });
      } catch (parseError) {
        // If parsing fails, use the basic status text
        logger.warn(`[apiRequest Error] API Request failed with status ${response.status}, and error response body was not valid JSON.`, {
           path: fullPath, 
           status: response.status 
        });
      }
      
      // Throw an error object that mimics our standard server error structure
      const error = new Error(errorData.message);
      (error as any).response = errorData; // Attach structured error info
      error.name = 'ApiError'; // Give it a name
      throw error;
    }

    // Parse JSON response or return empty object for 204 No Content
    if (response.status === 204) {
       logger.debug(`[apiRequest Success] API Request successful (204 No Content): ${method} ${fullPath}`);
       return { status: 'success', data: {}, meta: { responseTime: 0 } }; // Provide consistent structure
    }
    
    const responseData = await response.json();
    logger.debug(`[apiRequest Success] API Request successful (200 OK): ${method} ${fullPath}`);
    // Ensure the response conforms to our standard structure if possible
    // Ensure status check is safe
    return responseData && responseData.status === 'success' ? responseData : { status: 'success', data: responseData, meta: {} };

  } catch (error: any) {
     // Catch ALL errors from the try block (auth errors, fetch errors, parsing errors)
     logger.error(`[apiRequest FAIL] Request failed catastrophically for ${method} ${fullPath}:`, { 
         errorName: error.name,
         message: error.message, 
         ...(error.response ? { details: error.response.details } : {}), // Include details if available
         stack: error.stack 
      });
      
     // Check if it was our specific token retrieval error
     if (error.name === 'TokenRetrievalError' || error.name === 'GetIdTokenError') {
       // Handle this specific case - maybe trigger re-authentication?
       // alert('Authentication failed. Please try logging in again.'); 
     }
     
     // Re-throw the error to be handled by the calling code (e.g., UI)
     throw error;
  }
};

// API endpoints

/**
 * Function to make proxy requests to external services
 * @param service - Service name (e.g., 'embeddings', 'groq', 'google')
 * @param endpoint - API endpoint
 * @param options - Request options
 * @returns Promise with response data
 */
export const proxyRequest = async (
  service: string,
  endpoint: string,
  options: RequestInit = {}
) => {
  // Build path with service and endpoint
  const path = `/proxy/${service}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  // NOTE: Authentication is now handled by the central apiRequest function.
  // We might still need service-specific headers, but not Authorization here.
  
  const headers = options.headers ? { ...options.headers } : {};

  // For Google-specific requests, ensure the service is passed (if needed by backend)
  // This could potentially be moved to the backend proxy logic if not strictly needed here
  if (service === 'google' || service === 'sheets') {
    // Consider if this header is truly necessary or handled server-side
    // headers['X-Service'] = service; 
  }
  
  // Update options with any service-specific headers
  const updatedOptions = {
    ...options,
    headers
  };
  
  try {
    // Use the central apiRequest which handles auth
    const response = await apiRequest(path, updatedOptions); 
    return response;
  } catch (error: any) {
    // Handle specific error types relevant to proxying if needed
    if (error.response?.details?.errorCode === 'auth/id-token-expired') {
       logger.warn('Token likely expired during proxy request, user might need to re-authenticate.');
       // Potentially trigger re-auth flow here
    } else if (error.message.includes('Google API authentication error')) {
       // Handle specific Google errors if needed differently
       logger.error('Google API specific auth error during proxy.');
    }
    // Re-throw error for general handling
    throw error; 
  }
};

/**
 * Generate embeddings for text
 */
export const generateEmbeddings = async (
  text: string,
  options?: {
    model?: string;
    save?: boolean;
    type?: string;
    metadata?: Record<string, any>;
  }
) => {
  // Path is relative to /api now
  return apiRequest('/proxy/embeddings', { 
    method: 'POST',
    body: JSON.stringify({
      text,
      ...options
    })
  });
};

/**
 * Extract structured data from text
 */
export const extractData = async (
  message: string,
  fields: Array<{name: string, type: string}>,
  model?: string
) => {
  // Path is relative to /api now
  return apiRequest('/proxy/extract-data', { 
    method: 'POST',
    body: JSON.stringify({
      message,
      fields,
      model
    })
  });
};

/**
 * Match documents using vector similarity
 */
export const matchDocuments = async (
  text?: string,
  embedding?: number[],
  threshold?: number,
  limit?: number
) => {
  if (!text && !embedding) {
    throw new Error('Either text or embedding must be provided');
  }
  
  // Path is relative to /api now
  return apiRequest('/proxy/match-documents', { 
    method: 'POST',
    body: JSON.stringify({
      text,
      embedding,
      threshold,
      limit
    })
  });
};

/**
 * Save user configuration
 */
export const saveUserConfig = async (config: {
  name: string;
  behaviorRules: Array<{rule: string, description?: string}>;
  isActive?: boolean;
  settings?: Record<string, any>;
}) => {
  // Path is relative to /api now
  return apiRequest('/config', { 
    method: 'POST',
    body: JSON.stringify(config)
  });
};

/**
 * Get user configuration
 */
export const getUserConfig = async () => {
  // Path is relative to /api now
  return apiRequest('/config', { method: 'GET' });
};

export const getUser = async () => {
  // Path is relative to /api now
  return apiRequest('/user', { method: 'GET' });
};

export const updateUserProfile = async (profileData: any) => {
  // Path is relative to /api now
  return apiRequest('/user/profile', { 
    method: 'PUT',
    body: JSON.stringify(profileData)
  });
};

export const getGoogleSheetsStatus = async () => {
  // Path is relative to /api now
  return apiRequest('/google-sheets/status', { method: 'GET' }); 
};

export const getConfigList = async () => {
  // Path is relative to /api now
  return apiRequest('/configs', { method: 'GET' });
};

export default {
  proxyRequest,
  generateEmbeddings,
  extractData,
  matchDocuments,
  saveUserConfig,
  getUserConfig,
  getUser,
  updateUserProfile,
  getGoogleSheetsStatus,
  getConfigList
}; 