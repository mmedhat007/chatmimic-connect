import { getCurrentUser } from './firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

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
  
  // Check if token is expired and needs refreshing
  if (credentials.expiresAt && credentials.expiresAt < Date.now()) {
    // Token is expired, need to refresh
    if (!credentials.refreshToken) {
      throw new Error('Refresh token not available, re-authorization required');
    }
    
    try {
      const refreshedCredentials = await refreshGoogleToken(credentials.refreshToken);
      // Update credentials in Firebase
      await updateDoc(doc(db, 'Users', userUID), {
        'credentials.googleSheetsOAuth': {
          ...credentials,
          accessToken: refreshedCredentials.access_token,
          expiresAt: Date.now() + (refreshedCredentials.expires_in * 1000),
        }
      });
      
      // Return refreshed credentials
      return {
        ...credentials,
        accessToken: refreshedCredentials.access_token,
        expiresAt: Date.now() + (refreshedCredentials.expires_in * 1000),
      };
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw new Error('Failed to refresh Google token');
    }
  }
  
  return credentials;
};

/**
 * Refresh a Google OAuth token using the refresh token
 */
const refreshGoogleToken = async (refreshToken: string) => {
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '';
  
  const params = new URLSearchParams();
  params.append('client_id', GOOGLE_CLIENT_ID);
  params.append('client_secret', GOOGLE_CLIENT_SECRET);
  params.append('refresh_token', refreshToken);
  params.append('grant_type', 'refresh_token');
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Failed to refresh token: ${errorData.error_description || errorData.error}`);
  }
  
  return await response.json();
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
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${GOOGLE_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(GOOGLE_SCOPES)}` +
    `&access_type=offline` +
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
    // First, revoke the token with Google
    const credentials = await getGoogleSheetsCredentials();
    
    if (credentials.accessToken) {
      // Notify Google to revoke the token
      await fetch(`https://oauth2.googleapis.com/revoke?token=${credentials.accessToken}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
    }
    
    // Then remove the token from Firebase
    await updateDoc(doc(db, 'Users', userUID), {
      'credentials.googleSheetsOAuth': null
    });
    
    return true;
  } catch (error) {
    console.error('Error revoking Google auth:', error);
    throw error;
  }
};

/**
 * Create a new Google Sheet with the specified columns
 */
export const createSheet = async (config: SheetConfig) => {
  const credentials = await getGoogleSheetsCredentials();
  const { accessToken } = credentials;
  
  // First, create the spreadsheet
  if (!config.sheetId) {
    const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
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
    });

    if (!createResponse.ok) {
      const error = await createResponse.json();
      throw new Error(`Failed to create spreadsheet: ${error.error?.message || 'Unknown error'}`);
    }

    const createResult = await createResponse.json();
    config.sheetId = createResult.spreadsheetId;
  }
  
  // Now set up the headers in the sheet
  const headers = config.columns.map(col => col.name);
  
  const updateResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${config.sheetId}/values/A1:${String.fromCharCode(65 + headers.length - 1)}1?valueInputOption=RAW`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      range: `A1:${String.fromCharCode(65 + headers.length - 1)}1`,
      majorDimension: 'ROWS',
      values: [headers]
    })
  });

  if (!updateResponse.ok) {
    const error = await updateResponse.json();
    throw new Error(`Failed to update sheet headers: ${error.error?.message || 'Unknown error'}`);
  }

  return config;
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
  
  // Append the row - fix the URL to use "A:A" consistently
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A:A:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      range: 'A:A',
      majorDimension: 'ROWS',
      values: [values]
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to append row: ${error.error?.message || 'Unknown error'}`);
  }
  
  const result = await response.json();
  return result;
};

/**
 * Get a list of all user's sheets
 */
export const getUserSheets = async () => {
  const credentials = await getGoogleSheetsCredentials();
  const { accessToken } = credentials;
  
  const response = await fetch('https://www.googleapis.com/drive/v3/files?q=mimeType%3D%27application%2Fvnd.google-apps.spreadsheet%27', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to fetch sheets: ${error.error?.message || 'Unknown error'}`);
  }
  
  const result = await response.json();
  return result.files.map((file: any) => ({
    id: file.id,
    name: file.name
  }));
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
  
  // Get all values from the phone column
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${phoneColumn}:${phoneColumn}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to fetch sheet data: ${error.error?.message || 'Unknown error'}`);
  }
  
  const result = await response.json();
  
  // Skip header row (index 0) and search for the phone number
  for (let i = 1; i < (result.values?.length || 0); i++) {
    if (result.values[i] && result.values[i][0] === phoneNumber) {
      return i + 1; // Convert to 1-based row index
    }
  }
  
  return null; // Not found
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
    
    // Update the cell
    const updateResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${cellRef}?valueInputOption=RAW`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        range: cellRef,
        majorDimension: 'ROWS',
        values: [[value]]
      })
    });

    if (!updateResponse.ok) {
      const error = await updateResponse.json();
      throw new Error(`Failed to update cell ${cellRef}: ${error.error?.message || 'Unknown error'}`);
    }
  }
  
  return true;
}; 