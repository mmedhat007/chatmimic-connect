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
  const credentials = await getGoogleSheetsCredentials();
  const { accessToken } = credentials;
  
  // First, we need to get the sheet structure to know which column has phone numbers
  const sheetConfig = await getSheetConfig(sheetId);
  if (!sheetConfig) throw new Error('Sheet configuration not found');
  
  // Find which column contains phone numbers
  const phoneColumnIndex = sheetConfig.columns.findIndex(
    col => col.type === 'phone' || col.name.toLowerCase().includes('phone')
  );
  
  if (phoneColumnIndex === -1) {
    console.warn('No phone column found in sheet config');
    return null;
  }
  
  // Convert to A1 notation column
  const phoneColumn = String.fromCharCode(65 + phoneColumnIndex);
  
  // Get all values from the phone column using proxy service
  try {
    const result = await proxyRequest(
      'google',
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${phoneColumn}:${phoneColumn}`,
      {
        method: 'GET',
        headers: {
          'Authorization': createAuthHeader(accessToken)
        }
      }
    );

    // Skip header row (index 0) and search for the phone number
    for (let i = 1; i < (result.values?.length || 0); i++) {
      if (result.values[i] && result.values[i][0] === phoneNumber) {
        return i + 1; // Convert to 1-based row index
      }
    }
    
    return null; // Not found
  } catch (error) {
    console.error('Failed to search sheet data:', error);
    throw new Error(`Failed to search sheet data: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
  const credentials = await getGoogleSheetsCredentials();
  const { accessToken } = credentials;
  
  // Get the sheet config to know the column structure
  const sheetConfig = await getSheetConfig(sheetId);
  if (!sheetConfig) throw new Error('Sheet configuration not found');
  
  // For each update, we'll make a separate API call to update just that cell
  for (const [columnId, value] of Object.entries(updates)) {
    // Find the column index
    const columnIndex = sheetConfig.columns.findIndex(col => col.id === columnId);
    if (columnIndex === -1) continue; // Skip if column not found
    
    // Convert to A1 notation
    const columnLetter = String.fromCharCode(65 + columnIndex);
    const cellRef = `${columnLetter}${rowIndex}`;
    
    try {
      // Update the cell
      await proxyRequest(
        'google',
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${cellRef}?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: {
            'Authorization': createAuthHeader(accessToken)
          },
          body: JSON.stringify({
            range: cellRef,
            majorDimension: 'ROWS',
            values: [[value]]
          })
        }
      );
    } catch (error) {
      console.error(`Failed to update cell ${cellRef}:`, error);
      throw new Error(`Failed to update cell ${cellRef}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  return true;
};

/**
 * Create a new Google Sheet with the specified columns
 */
export const createSheet = async (config: SheetConfig) => {
  const credentials = await getGoogleSheetsCredentials();
  const { accessToken } = credentials;
  
  // First, create the spreadsheet
  if (!config.sheetId) {
    try {
      const createResult = await proxyRequest(
        'google',
        'https://sheets.googleapis.com/v4/spreadsheets',
        {
          method: 'POST',
          headers: {
            'Authorization': createAuthHeader(accessToken)
          },
          body: JSON.stringify({
            properties: {
              title: config.name
            },
            sheets: [
              {
                properties: {
                  title: 'Customer Data'
                }
              }
            ]
          })
        }
      );
      
      config.sheetId = createResult.spreadsheetId;
    } catch (error) {
      console.error('Failed to create spreadsheet:', error);
      throw new Error(`Failed to create spreadsheet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // Now set up the headers in the sheet
  const headers = config.columns.map(col => col.name);
  
  try {
    await proxyRequest(
      'google',
      `https://sheets.googleapis.com/v4/spreadsheets/${config.sheetId}/values/A1:${String.fromCharCode(65 + headers.length - 1)}1?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': createAuthHeader(accessToken)
        },
        body: JSON.stringify({
          range: `A1:${String.fromCharCode(65 + headers.length - 1)}1`,
          majorDimension: 'ROWS',
          values: [headers]
        })
      }
    );
    
    return config;
  } catch (error) {
    console.error('Failed to set up sheet headers:', error);
    throw new Error(`Failed to set up sheet headers: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Append a row to a Google Sheet
 * @param sheetId The ID of the sheet to append to
 * @param data An object with column IDs as keys and values to append
 */
export const appendSheetRow = async (sheetId: string, data: Record<string, string>) => {
  const credentials = await getGoogleSheetsCredentials();
  const { accessToken } = credentials;
  
  // Get the sheet config to know the column structure
  const sheetConfig = await getSheetConfig(sheetId);
  if (!sheetConfig) throw new Error('Sheet configuration not found');
  
  // Create an array with the values in the correct order based on the config's columns
  const values = sheetConfig.columns.map(column => data[column.id] || '');
  
  try {
    const result = await proxyRequest(
      'google',
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A:A:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          'Authorization': createAuthHeader(accessToken)
        },
        body: JSON.stringify({
          range: 'A:A',
          majorDimension: 'ROWS',
          values: [values]
        })
      }
    );
    
    return result;
  } catch (error) {
    console.error('Failed to append row:', error);
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