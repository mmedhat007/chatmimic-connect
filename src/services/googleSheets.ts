import { getCurrentUser } from './firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { proxyRequest } from '../utils/api';
import { apiRequest } from '../utils/api';

// Types
export interface SheetColumn {
  id: string;
  name: string;
  description: string;
  type: 'text' | 'date' | 'name' | 'product' | 'inquiry' | 'phone';
  aiPrompt: string;
  isAutoPopulated?: boolean;
}

export interface SheetConfig {
  id?: string;
  name: string;
  description?: string;
  sheetId: string;
  columns: SheetColumn[];
  active: boolean;
  lastUpdated: number;
  addTrigger?: 'first_message' | 'show_interest' | 'manual';
  autoUpdateFields?: boolean;
}

// Helper function to create Auth header with Bearer prefix
const createAuthHeader = (token: string): string => {
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
};

/**
 * Get Google Sheets OAuth credentials for the current user
 */
export const getGoogleSheetsCredentials = async () => {
  const userUID = getCurrentUser();
  if (!userUID) throw new Error('No user logged in');

  const userDoc = await getDoc(doc(db, 'Users', userUID));
  if (!userDoc.exists()) throw new Error('User document not found');
  
  const userData = userDoc.data();
  const credentials = userData.credentials?.googleSheetsOAuth;
  
  if (!credentials?.accessToken) {
    throw new Error('Google Sheets not connected');
  }
  
  // We'll get the access token but rely on the server's token refresh mechanism
  // to handle expired tokens through the proxy service
  return credentials;
};

/**
 * Check if the user has authorized Google Sheets
 */
export const getGoogleAuthStatus = async (): Promise<boolean> => {
  const userUID = getCurrentUser();
  if (!userUID) return false;

  try {
    const userDoc = await getDoc(doc(db, 'Users', userUID));
    if (!userDoc.exists()) return false;
    
    const userData = userDoc.data();
    const credentials = userData.credentials?.googleSheetsOAuth;
    
    return !!(credentials?.accessToken);
  } catch (error) {
    console.error('Error checking Google auth status:', error);
    return false;
  }
};

/**
 * Authorize Google Sheets access
 * This function doesn't actually handle the OAuth flow - it just redirects to Google
 * The actual token exchange happens in the GoogleCallback component
 */
export const authorizeGoogleSheets = async () => {
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const GOOGLE_REDIRECT_URI = `${window.location.origin}/google-callback`;
  const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file';
  
  // Get current user ID for state parameter
  const userUID = getCurrentUser();
  if (!userUID) {
    throw new Error('No user logged in');
  }
  
  // Create a state parameter to help maintain context
  const stateParam = btoa(JSON.stringify({
    uid: userUID,
    timestamp: Date.now()
  }));
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${GOOGLE_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(GOOGLE_SCOPES)}` +
    `&access_type=offline` +
    `&state=${encodeURIComponent(stateParam)}` +
    `&prompt=consent`;
  
  window.location.href = authUrl;
};

/**
 * Revoke Google Sheets authorization
 */
export const revokeGoogleAuth = async () => {
  const userUID = getCurrentUser();
  if (!userUID) throw new Error('No user logged in');
  
  try {
    // Use the server endpoint to revoke the token and clean up credentials
    // Don't use proxy here - use direct API call to google-sheets endpoint
    await apiRequest('/api/google-sheets/disconnect', {
      method: 'POST'
    });
    
    return true;
  } catch (error) {
    console.error('Error revoking Google auth:', error);
    throw error;
  }
};

/**
 * Get user's Google Sheets list from the backend
 */
export const getUserSheets = async () => {
  try {
    // Call the new backend endpoint
    const response = await apiRequest('/api/google-sheets/list');

    // Check response status and data structure
    if (response && response.status === 'success' && Array.isArray(response.data?.files)) {
      return response.data.files;
    } else {
      // Log the unexpected response or error message from the backend
      console.error('Unexpected response format from /api/google-sheets/list:', response);
      throw new Error(response?.message || 'Failed to fetch sheets from backend');
    }
  } catch (error) {
    console.error('Failed to fetch Google Sheets list via backend:', error);
    // Re-throw the error to be caught by the component
    throw new Error(`Failed to fetch Google Sheets list: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Get a sheet configuration by ID
 */
export const getSheetConfig = async (sheetId: string): Promise<SheetConfig | null> => {
  const userUID = getCurrentUser();
  if (!userUID) return null;

  const userDoc = await getDoc(doc(db, 'Users', userUID));
  if (!userDoc.exists()) return null;
  
  const userData = userDoc.data();
  // Get from workflows.whatsapp_agent.sheetConfigs instead of directly from the user document
  const sheetConfigs = userData.workflows?.whatsapp_agent?.sheetConfigs || [];
  
  return sheetConfigs.find((config: SheetConfig) => config.sheetId === sheetId) || null;
};

/**
 * Get all sheet configurations for the current user
 */
export const getAllSheetConfigs = async (): Promise<SheetConfig[]> => {
  const userUID = getCurrentUser();
  if (!userUID) return [];

  const userDoc = await getDoc(doc(db, 'Users', userUID));
  if (!userDoc.exists()) return [];
  
  const userData = userDoc.data();
  // Get from workflows.whatsapp_agent.sheetConfigs instead of directly from the user document
  return userData.workflows?.whatsapp_agent?.sheetConfigs || [];
};

/**
 * Save a sheet configuration
 */
export const saveSheetConfig = async (config: SheetConfig) => {
  const userUID = getCurrentUser();
  if (!userUID) throw new Error('No user logged in');

  const userDoc = await getDoc(doc(db, 'Users', userUID));
  if (!userDoc.exists()) throw new Error('User document not found');
  
  const userData = userDoc.data();
  
  // Get current workflows or initialize if it doesn't exist
  const workflows = userData.workflows || {};
  
  // Get current whatsapp_agent config or initialize if it doesn't exist
  const whatsappAgent = workflows.whatsapp_agent || {};
  
  // Get current sheetConfigs or initialize if it doesn't exist
  const sheetConfigs = whatsappAgent.sheetConfigs || [];
  
  // Update or add the config
  const existingIndex = sheetConfigs.findIndex((c: SheetConfig) => c.sheetId === config.sheetId);
  
  if (existingIndex >= 0) {
    sheetConfigs[existingIndex] = {
      ...config,
      lastUpdated: Date.now()
    };
  } else {
    sheetConfigs.push({
      ...config,
      lastUpdated: Date.now()
    });
  }
  
  // Save back to Firebase - only update the specific nested field
  await updateDoc(doc(db, 'Users', userUID), {
    'workflows.whatsapp_agent.sheetConfigs': sheetConfigs
  });
  
  return config;
};

/**
 * Find a contact in a Google Sheet by phone number
 * @param sheetId The ID of the sheet to search
 * @param phoneNumber The phone number to find
 * @returns The row index (1-based) if found, null otherwise
 */
export const findContactInSheet = async (sheetId: string, phoneNumber: string): Promise<number | null> => {
  try {
    // Call the backend endpoint that handles the search
    const response = await apiRequest(`/api/google-sheets/spreadsheets/${sheetId}/find`, {
      method: 'POST',
      body: JSON.stringify({ phoneNumber })
    });

    // Check if the request was successful and data is in the expected format
    if (response && response.status === 'success' && response.data?.rowIndex !== undefined) {
      console.log(`[findContactInSheet] Backend response for ${phoneNumber} in sheet ${sheetId}:`, response.data);
      return response.data.rowIndex; // rowIndex can be number or null
    } else {
      console.error(`[findContactInSheet] Unexpected response format from backend for sheet ${sheetId}:`, response);
      // If status is not success or data format is wrong, treat as not found or error
      return null; 
    }
  } catch (error) {
    console.error(`[findContactInSheet] Error calling backend to find contact ${phoneNumber} in sheet ${sheetId}:`, error);
    // Re-throw or return null depending on desired error handling strategy
    // For now, return null to indicate contact not found or error occurred
    return null;
  }
};

/**
 * Update a row in a Google Sheet
 * @param sheetId The ID of the sheet to update
 * @param rowIndex The 1-based row index to update
 * @param updates An object with column IDs as keys and new values
 */
export const updateSheetRow = async (
  sheetId: string, 
  rowIndex: number, 
  updates: Record<string, string>
) => {
  // This needs to call a backend endpoint that performs the update server-side
  console.warn('updateSheetRow needs refactoring to use a backend endpoint.');
  // Placeholder implementation:
  try {
    const response = await apiRequest(`/api/google-sheets/spreadsheets/${sheetId}/rows/${rowIndex}`, { // Example endpoint
      method: 'PUT',
      body: JSON.stringify({ updates })
    });
    return response.status === 'success';
  } catch (error) {
    console.error(`Error updating row ${rowIndex} in sheet ${sheetId}:`, error);
    return false; // Return false on error
  }
};

/**
 * Create a new Google Sheet OR update headers via Backend
 */
export const createSheet = async (config: SheetConfig): Promise<SheetConfig> => {
  console.log('Calling backend to create/update sheet headers for config:', config);
  try {
    // If sheetId exists, we update headers, otherwise create new sheet + headers
    const endpoint = config.sheetId 
      ? `/api/google-sheets/spreadsheets/${config.sheetId}/headers` 
      : '/api/google-sheets/spreadsheets';
    const method = config.sheetId ? 'PUT' : 'POST';

    const response = await apiRequest(endpoint, {
      method: method,
      body: JSON.stringify(config) // Send the whole config for context
    });

    if (response.status === 'success' && response.data?.sheetId) {
      // Return the config, potentially updated with a new sheetId from backend
      return { ...config, sheetId: response.data.sheetId };
    } else {
      throw new Error(response.message || 'Failed to create/update sheet via backend');
    }
  } catch (error) {
    console.error('Error in createSheet calling backend:', error);
    // Re-throw error with more context if possible
    throw new Error(`Failed to create/update sheet: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Append a row to a Google Sheet via Backend
 */
export const appendSheetRow = async (sheetId: string, data: Record<string, string>) => {
  console.log(`Calling backend to append row to sheet ${sheetId}:`, data);
  if (!sheetId) {
     throw new Error('Cannot append row without a valid sheetId.');
  }
  try {
    const response = await apiRequest(`/api/google-sheets/spreadsheets/${sheetId}/values:append`, { // Using Google API-like path for clarity
      method: 'POST',
      body: JSON.stringify({ data })
    });

    if (response.status === 'success') {
       return response.data; // Backend might return confirmation or updated range
    } else {
       throw new Error(response.message || 'Failed to append row via backend');
    }
  } catch (error) {
    console.error('Error in appendSheetRow calling backend:', error);
    throw new Error(`Failed to append row: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Exchange code for token after Google OAuth callback
 * @param code The authorization code from Google
 * @param state The state parameter from the OAuth flow
 */
export const exchangeGoogleAuthCode = async (code: string, state: string) => {
  try {
    // Use direct API path instead of proxy for OAuth token exchange
    const response = await apiRequest('/api/google-oauth/exchange-token', {
      method: 'POST',
      body: JSON.stringify({ 
        code, 
        state,
        redirectUri: `${window.location.origin}/google-callback`
      })
    });
    
    return response;
  } catch (error) {
    console.error('Error exchanging Google auth code:', error);
    throw new Error(`Failed to exchange Google auth code: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Test the connection to Google Sheets via the backend
 * @returns {Promise<boolean>} True if the connection is successful, false otherwise.
 */
export const testGoogleSheetsConnection = async (): Promise<boolean> => {
  console.log('[testGoogleSheetsConnection] Calling backend to test connection...');
  try {
    const response = await apiRequest('/api/google-sheets/test-connection');

    if (response && response.status === 'success') {
      console.log('[testGoogleSheetsConnection] Backend connection test successful:', response.message);
      return true;
    } else {
      console.error('[testGoogleSheetsConnection] Backend connection test failed:', response?.message || 'Unknown error');
      return false;
    }
  } catch (error) {
    console.error('[testGoogleSheetsConnection] Error calling backend test endpoint:', error);
    return false;
  }
};