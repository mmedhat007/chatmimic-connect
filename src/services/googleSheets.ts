import { getCurrentUser } from './firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

// Types
export interface SheetColumn {
  id: string;
  name: string;
  description: string;
  type: 'text' | 'date' | 'name' | 'product' | 'inquiry';
  aiPrompt: string;
}

export interface SheetConfig {
  id?: string;
  name: string;
  description?: string;
  sheetId: string;
  columns: SheetColumn[];
  active: boolean;
  lastUpdated: number;
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
  
  return credentials;
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
 * Append a row of data to the specified Google Sheet
 */
export const appendSheetRow = async (sheetId: string, rowData: Record<string, string>) => {
  const credentials = await getGoogleSheetsCredentials();
  const { accessToken } = credentials;
  
  // Get the sheet config to know the column structure
  const sheetConfig = await getSheetConfig(sheetId);
  if (!sheetConfig) throw new Error('Sheet configuration not found');
  
  // Format the row data based on column order
  const values = sheetConfig.columns.map(column => {
    return rowData[column.id] || '';
  });
  
  // Append the data to the sheet
  const appendResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A:A:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
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

  if (!appendResponse.ok) {
    const error = await appendResponse.json();
    throw new Error(`Failed to append row: ${error.error?.message || 'Unknown error'}`);
  }

  return await appendResponse.json();
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
  const sheetConfigs = userData.sheetConfigs || [];
  
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
  return userData.sheetConfigs || [];
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
  const sheetConfigs = userData.sheetConfigs || [];
  
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
  
  // Save back to Firebase
  await updateDoc(doc(db, 'Users', userUID), {
    sheetConfigs
  });
  
  return config;
}; 