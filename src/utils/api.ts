/**
 * API utilities for interacting with the backend
 */

import { getAuth } from 'firebase/auth';

// Base API URL
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? '/api' 
  : 'http://localhost:3000/api';

/**
 * Base API request function that handles authentication
 * @param path - API endpoint path
 * @param options - Request options
 * @returns Promise with response data
 */
export const apiRequest = async (path: string, options: RequestInit = {}) => {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    
    // Prepare headers with authentication if user is logged in
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add authentication token if available
    if (user) {
      const token = await user.getIdToken();
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Combine options with headers
    const requestOptions: RequestInit = {
      ...options,
      headers,
    };

    // Make the API request
    const response = await fetch(path, requestOptions);

    // Handle HTTP errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: 'Unknown error',
        status: response.status,
      }));
      
      throw new Error(
        errorData.error || `API error: ${response.status} ${response.statusText}`
      );
    }

    // Parse JSON response or return empty object for 204 No Content
    return response.status === 204 ? {} : await response.json();
  } catch (error) {
    console.error('API request failed:', error);
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
  const path = `/api/proxy/${service}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  // Ensure headers exist in options
  const headers = options.headers ? { ...options.headers } : {};
  
  // Make sure we're sending proper authorization
  const auth = getAuth();
  const user = auth.currentUser;
  
  // Only add Authorization if not already present
  if (user && !headers['Authorization'] && !headers['authorization']) {
    try {
      const token = await user.getIdToken(true); // Force token refresh if needed
      headers['Authorization'] = `Bearer ${token}`;
    } catch (authError) {
      console.error('Failed to get auth token:', authError);
      throw new Error('Authentication error: Unable to retrieve valid token');
    }
  }
  
  // For Google-specific requests, ensure the service is passed
  if (service === 'google' || service === 'sheets') {
    headers['X-Service'] = service;
  }
  
  // Update options with headers
  const updatedOptions = {
    ...options,
    headers
  };
  
  try {
    const response = await apiRequest(path, updatedOptions);
    return response;
  } catch (error) {
    // Handle specific error types
    if (error instanceof Error) {
      // Check if this is a token expired error from Google
      if (error.message.includes('401') && (service === 'google' || service === 'sheets')) {
        console.error('Google API auth error:', error.message);
        // Let the server handle token refresh and just throw a clearer error
        throw new Error(`Google API authentication error: Please check your Google connection in settings`);
      }
    }
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
  return apiRequest('/api/proxy/embeddings', { 
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
  return apiRequest('/api/proxy/extract-data', {
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
  
  return apiRequest('/api/proxy/match-documents', {
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
  return apiRequest('/api/config', {
    method: 'POST',
    body: JSON.stringify(config)
  });
};

/**
 * Get user configuration
 */
export const getUserConfig = async () => {
  return apiRequest('/api/config', { method: 'GET' });
};

export const getUser = async () => {
  return apiRequest('/api/user', { method: 'GET' });
};

export const updateUserProfile = async (profileData: any) => {
  return apiRequest('/api/user/profile', { 
    method: 'PUT',
    body: JSON.stringify(profileData)
  });
};

export const getGoogleSheets = async () => {
  return apiRequest('/api/google/sheets', { method: 'GET' });
};

export const getConfigList = async () => {
  return apiRequest('/api/configs', { method: 'GET' });
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
  getGoogleSheets,
  getConfigList
}; 