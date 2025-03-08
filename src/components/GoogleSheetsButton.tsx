import { useState, useEffect } from 'react';
import { getCurrentUser } from '../services/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import SheetSelector from './SheetSelector';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_REDIRECT_URI = import.meta.env.VITE_GOOGLE_REDIRECT_URI;
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file';

const GoogleSheetsButton = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const checkConnection = async () => {
      const userUID = getCurrentUser();
      if (!userUID) return;

      try {
        const userDoc = await getDoc(doc(db, 'Users', userUID));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setIsConnected(!!data.credentials?.googleSheetsOAuth?.accessToken);
        }
      } catch (error) {
        console.error('Error checking Google Sheets connection:', error);
      }
    };

    checkConnection();
  }, []);

  const handleGoogleLogin = () => {
    setIsLoading(true);
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${GOOGLE_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(GOOGLE_SCOPES)}` +
      `&access_type=offline` +
      `&prompt=consent`;

    window.location.href = authUrl;
  };

  const handleDisconnect = async () => {
    const userUID = getCurrentUser();
    if (!userUID) return;

    try {
      await updateDoc(doc(db, 'Users', userUID), {
        'credentials.googleSheetsOAuth': null
      });
      setIsConnected(false);
    } catch (error) {
      console.error('Error disconnecting Google Sheets:', error);
    }
  };

  return (
    <div className="flex items-center space-x-4">
      {!isConnected ? (
        <button
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="flex items-center justify-center px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Connecting...
            </span>
          ) : (
            <span className="flex items-center">
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/>
              </svg>
              Connect Google Sheets
            </span>
          )}
        </button>
      ) : (
        <div className="flex items-center space-x-2">
          <span className="flex items-center text-sm text-green-600">
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Connected
          </span>
          <SheetSelector />
          <button
            onClick={handleDisconnect}
            className="text-sm text-red-600 hover:text-red-700 focus:outline-none"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
};

export default GoogleSheetsButton; 