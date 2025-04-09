import { getCurrentUser } from './firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
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
 * Find a contact in a Google Sheet by phone number (calls backend)
 * @param sheetId The ID of the sheet to search
 * @param phoneNumber The phone number to find
 * @returns The row index (1-based) if found, null otherwise
 */
export const findContactInSheet = async (sheetId: string, phoneNumber: string): Promise<number | null> => {
  try {
    // Construct URL with query parameters
    const url = `/api/google-sheets/find-contact?sheetId=${encodeURIComponent(sheetId)}&phoneNumber=${encodeURIComponent(phoneNumber)}`;
    
    const response = await apiRequest(url, {
      method: 'GET'
    });
    if (response.status === 'success' && response.data) {
      return response.data.rowIndex; // Expecting { rowIndex: number | null }
    }
    throw new Error(response.message || 'Failed to find contact in sheet');
  } catch (error) {
    console.error('Error finding contact via backend:', error);
    throw error; // Re-throw to be handled by caller
  }
};

/**
 * Update a row in a Google Sheet (calls backend)
 * @param sheetId The ID of the sheet to update
 * @param rowIndex The 1-based row index to update
 * @param updates An object with column IDs as keys and new values
 */
export const updateSheetRow = async (
  sheetId: string, 
  rowIndex: number, 
  updates: Record<string, string>
): Promise<boolean> => {
  try {
    const response = await apiRequest('/api/google-sheets/update-row', {
      method: 'PUT',
      body: JSON.stringify({ sheetId, rowIndex, updates })
    });
    if (response.status === 'success') {
      return true;
    }
    throw new Error(response.message || 'Failed to update sheet row');
  } catch (error) {
    console.error('Error updating sheet row via backend:', error);
    throw error;
  }
};

/**
 * Create a new Google Sheet with the specified columns (calls backend)
 */
export const createSheet = async (config: SheetConfig): Promise<{ sheetId: string; spreadsheetUrl: string }> => {
  try {
    const response = await apiRequest('/api/google-sheets/create', {
      method: 'POST',
      body: JSON.stringify({ config })
    });
    if (response.status === 'success' && response.data?.sheetId) {
      return response.data; // Expecting { sheetId: string, spreadsheetUrl: string }
    }
    throw new Error(response.message || 'Failed to create sheet via backend');
  } catch (error) {
    console.error('Error creating sheet via backend:', error);
    throw error;
  }
};

/**
 * Append a row to a Google Sheet (calls backend)
 * @param sheetId The ID of the sheet to append to
 * @param data An object with column IDs as keys and values to append
 */
export const appendSheetRow = async (sheetId: string, data: Record<string, string>) => {
  try {
    const response = await apiRequest('/api/google-sheets/append-row', {
      method: 'POST',
      body: JSON.stringify({ sheetId, rowData: data })
    });
    if (response.status === 'success') {
      return response.data; // Return Google API response if needed
    }
    throw new Error(response.message || 'Failed to append row via backend');
  } catch (error) {
    console.error('Error appending row via backend:', error);
    throw error;
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
 * Check Google Sheets connection status with the server
 * @returns Connection status object
 */
export const checkGoogleSheetsConnection = async () => {
  try {
    const response = await apiRequest('/api/google-sheets/status');
    return response.data || { connected: false };
  } catch (error) {
    console.error('Error checking Google Sheets connection:', error);
    return { connected: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}; 