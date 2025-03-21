import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, updateDoc, getFirestore, getDoc } from 'firebase/firestore';
import { auth, db, getCurrentUser } from '../services/firebase';
import { RefreshCw } from 'lucide-react';
import { startWhatsAppGoogleSheetsIntegration } from '../services/whatsappGoogleIntegration';

// Constants for Google OAuth
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = `${window.location.origin}/google-callback`;

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

const GoogleCallback: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Function to directly exchange the code for tokens with Google OAuth API
    const exchangeCodeForToken = async (code: string): Promise<TokenResponse> => {
      const tokenEndpoint = 'https://oauth2.googleapis.com/token';
      
      const params = new URLSearchParams();
      params.append('code', code);
      params.append('client_id', GOOGLE_CLIENT_ID);
      params.append('client_secret', GOOGLE_CLIENT_SECRET);
      params.append('redirect_uri', GOOGLE_REDIRECT_URI);
      params.append('grant_type', 'authorization_code');
      
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Google OAuth error: ${errorData.error_description || errorData.error || 'Unknown error'}`);
      }
      
      return await response.json();
    };

    const handleTokenExchange = async (code: string) => {
      try {
        const tokenData = await exchangeCodeForToken(code);
        
        // Get user ID from either auth or localStorage
        const user = auth.currentUser;
        const userUID = user?.uid || getCurrentUser();
        
        if (!userUID) {
          console.error('No user ID available from auth or localStorage');
          throw new Error('User not authenticated');
        }

        console.log('Using user ID:', userUID);
        
        const userDocRef = doc(db, 'Users', userUID);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
          console.error('User document not found for ID:', userUID);
          navigate('/google-sheets');
          return;
        }

        // Format the token data with expiration time
        const formattedTokenData = {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresAt: Date.now() + tokenData.expires_in * 1000,
        };

        // Update Firestore with the token data
        await updateDoc(userDocRef, {
          'credentials.googleSheetsOAuth': formattedTokenData,
        });

        // Start the WhatsApp Google Sheets integration listener
        startWhatsAppGoogleSheetsIntegration();

        console.log('Successfully connected to Google Sheets!');
        navigate('/google-sheets');
      } catch (error) {
        console.error('Error saving token to Firebase:', error);
        setError('Failed to save Google Sheets credentials');
        setLoading(false);
      }
    };

    // Get the authorization code from URL
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const urlError = params.get('error');

    if (urlError) {
      setError('Authorization was cancelled or denied.');
      setLoading(false);
      return;
    }

    if (code) {
      handleTokenExchange(code);
    } else {
      setError('No authorization code received.');
      setLoading(false);
    }
  }, [location, navigate]);

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
        <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Connecting to Google Sheets</h1>
        <p className="text-gray-500">Please wait while we complete the authorization process...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="bg-red-100 border border-red-200 text-red-700 px-4 py-3 rounded max-w-md mb-4">
          <p>{error}</p>
        </div>
        <button
          onClick={() => navigate('/google-sheets')}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          Return to Google Sheets
        </button>
      </div>
    );
  }

  return null;
};

export default GoogleCallback; 