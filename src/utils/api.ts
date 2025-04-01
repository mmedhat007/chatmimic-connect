/**
 * API utilities for interacting with the backend
 */

import { getAuth } from 'firebase/auth';

// Base API URL
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? '/api' 
  : 'http://localhost:3000/api';

// Helper to get the auth token
const getAuthToken = async (): Promise<string | null> => {
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) {
    console.warn('No user is signed in');
    return null;
  }
  
  try {
    return await user.getIdToken();
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

// API request helper with auth
const apiRequest = async (
  endpoint: string, 
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', 
  data?: any
) => {
  const token = await getAuthToken();
  
  if (!token) {
    throw new Error('Authentication required');
  }
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
  
  const config: RequestInit = {
    method,
    headers,
    credentials: 'include',
  };
  
  if (data) {
    config.body = JSON.stringify(data);
  }
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
  const responseData = await response.json();
  
  if (!response.ok) {
    // Enhanced error handling with response details
    const error = new Error(responseData.message || 'API request failed');
    (error as any).status = response.status;
    (error as any).details = responseData.details;
    (error as any).meta = responseData.meta;
    throw error;
  }
  
  return responseData;
};

// API endpoints

/**
 * Generic proxy request to external services
 */
export const proxyRequest = async (
  endpoint: string,
  service: 'openai' | 'groq' | 'supabase',
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: any,
  headers?: Record<string, string>,
  params?: Record<string, string>
) => {
  return apiRequest('/proxy/proxy', 'POST', {
    endpoint,
    service,
    method,
    data,
    headers,
    params
  });
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
  return apiRequest('/proxy/embeddings', 'POST', {
    text,
    ...options
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
  return apiRequest('/proxy/extract-data', 'POST', {
    message,
    fields,
    model
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
  
  return apiRequest('/proxy/match-documents', 'POST', {
    text,
    embedding,
    threshold,
    limit
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
  return apiRequest('/config', 'POST', config);
};

/**
 * Get user configuration
 */
export const getUserConfig = async () => {
  return apiRequest('/config');
};

export default {
  proxyRequest,
  generateEmbeddings,
  extractData,
  matchDocuments,
  saveUserConfig,
  getUserConfig
}; 