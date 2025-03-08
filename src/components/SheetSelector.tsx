import { useState, useEffect } from 'react';
import { getCurrentUser } from '../services/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

interface Sheet {
  id: string;
  name: string;
}

const SheetSelector = () => {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSheet, setSelectedSheet] = useState<string>('');

  useEffect(() => {
    const fetchSheets = async () => {
      const userUID = getCurrentUser();
      if (!userUID) return;

      try {
        const userDoc = await getDoc(doc(db, 'Users', userUID));
        if (!userDoc.exists()) return;

        const data = userDoc.data();
        const accessToken = data.credentials?.googleSheetsOAuth?.accessToken;
        if (!accessToken) return;

        // Fetch user's Google Sheets using Drive API
        const response = await fetch('https://www.googleapis.com/drive/v3/files?q=mimeType%3D%27application%2Fvnd.google-apps.spreadsheet%27', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        if (!response.ok) throw new Error('Failed to fetch sheets');
        
        const result = await response.json();
        setSheets(result.files.map((file: any) => ({
          id: file.id,
          name: file.name
        })));

        // Get previously selected sheet if any
        const selectedSheetId = data.selectedSheetId;
        if (selectedSheetId) {
          setSelectedSheet(selectedSheetId);
        }
      } catch (error) {
        console.error('Error fetching sheets:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSheets();
  }, []);

  const handleSheetSelect = async (sheetId: string) => {
    setSelectedSheet(sheetId);
    const userUID = getCurrentUser();
    if (!userUID) return;

    try {
      const userDoc = await getDoc(doc(db, 'Users', userUID));
      if (!userDoc.exists()) return;

      const data = userDoc.data();
      await updateDoc(doc(db, 'Users', userUID), {
        'credentials.googleSheetsOAuth': {
          ...data.credentials?.googleSheetsOAuth,
          selectedSheetId: sheetId
        }
      });
    } catch (error) {
      console.error('Error saving selected sheet:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-2 text-sm text-gray-600">
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Loading sheets...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <select
        value={selectedSheet}
        onChange={(e) => handleSheetSelect(e.target.value)}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Select a sheet</option>
        {sheets.map((sheet) => (
          <option key={sheet.id} value={sheet.id}>
            {sheet.name}
          </option>
        ))}
      </select>
      {selectedSheet && (
        <span className="text-sm text-green-600 flex items-center">
          <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Selected
        </span>
      )}
    </div>
  );
};

export default SheetSelector; 