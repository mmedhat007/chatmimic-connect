/**
 * API utilities for interacting with the backend
 */

import { 
  getAuth, 
  signInWithCustomToken 
} from 'firebase/auth';

// Base API URL - always use the direct URL to the backend in development
const API_BASE_URL = process.env.NODE_ENV === 'development'
  ? 'http://localhost:3000/api'
  : '/api';

// Debug flag for tracing API requests
const DEBUG_API = process.env.NODE_ENV === 'development';

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
      try {
        console.log(`Getting ID token for user: ${user.uid}`);
        const token = await user.getIdToken(true); // Force token refresh
        console.log(`Token received, length: ${token.length} chars`);
        headers['Authorization'] = `Bearer ${token}`;
      } catch (tokenError) {
        console.error('Error getting ID token:', tokenError);
        throw new Error('Failed to get authentication token. Please try logging out and back in.');
      }
    }

    // Combine options with headers
    const requestOptions: RequestInit = {
      ...options,
      headers,
    };

    // Construct the full URL
    let url;
    if (path.startsWith('http')) {
      // Already a full URL
      url = path;
    } else if (process.env.NODE_ENV === 'development') {
      // In development, always use the full localhost URL
      if (path.startsWith('/api')) {
        // Path already includes /api prefix
        url = `http://localhost:3000${path}`;
      } else {
        // Path doesn't include /api prefix
        url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
      }
    } else {
      // In production, use relative paths
      if (path.startsWith('/api')) {
        url = path;
      } else {
        url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
      }
    }
    
    if (DEBUG_API) console.log(`Making API request to: ${url}`);
    
    // Make the API request
    const response = await fetch(url, requestOptions);

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
    
    // Add specific handling for connection errors
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.error(`Connection error - Is the backend server running at http://localhost:3000?`);
      throw new Error(`Connection error: Unable to reach the API server. Please make sure the backend is running on port 3000.`);
    }
    
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
  
  // Ensure headers exist in options
  const headers = options.headers ? { ...options.headers } : {};

  try {
    const auth = getAuth();
    const user = auth.currentUser;
    
    // Prepare headers with authentication if user is logged in
    const authHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      ...headers,
    };

    // Add authentication token if available
    if (user) {
      try {
        console.log(`Getting ID token for user: ${user.uid}`);
        const token = await user.getIdToken(true); // Force token refresh
        console.log(`Token received, length: ${token.length} chars`);
        authHeaders['Authorization'] = `Bearer ${token}`;
      } catch (tokenError) {
        console.error('Error getting ID token:', tokenError);
        throw new Error('Failed to get authentication token. Please try logging out and back in.');
      }
    }

    // Combine options with headers
    const requestOptions: RequestInit = {
      ...options,
      headers: authHeaders,
    };

    if (DEBUG_API) console.log(`Making API request to: ${path}`);
    
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
    
    // Add specific handling for connection errors
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.error(`Connection error - Is the backend server running at http://localhost:3000?`);
      throw new Error(`Connection error: Unable to reach the API server. Please make sure the backend is running on port 3000.`);
    }
    
    throw error;
  }
};