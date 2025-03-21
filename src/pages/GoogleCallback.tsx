import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, updateDoc, getFirestore } from 'firebase/firestore';
import { auth } from '../services/firebase';
import { RefreshCw } from 'lucide-react';

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
    const getTokenFromCode = async (code: string) => {
      try {
        const tokenEndpoint = import.meta.env.VITE_API_URL || '/api/google/token';
        const response = await fetch(tokenEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
        });

        if (!response.ok) {
          throw new Error('Failed to exchange code for token');
        }

        const tokenData: TokenResponse = await response.json();
        
        // Save token to Firebase
        const user = auth.currentUser;
        if (!user) {
          throw new Error('User not authenticated');
        }

        const db = getFirestore();
        await updateDoc(doc(db, 'Users', user.uid), {
          'credentials.googleSheetsOAuth': {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: Date.now() + (tokenData.expires_in * 1000),
          }
        });

        // Navigate back to Google Sheets page
        navigate('/google-sheets', { 
          state: { success: true, message: 'Successfully connected to Google Sheets!' } 
        });
      } catch (error) {
        console.error('Error exchanging code for token:', error);
        setError('Failed to connect Google Sheets. Please try again.');
        setLoading(false);
      }
    };

    // Get the authorization code from URL
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error) {
      setError('Authorization was cancelled or denied.');
      setLoading(false);
      return;
    }

    if (code) {
      getTokenFromCode(code);
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