import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../services/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = import.meta.env.VITE_GOOGLE_REDIRECT_URI;

const GoogleCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the authorization code from URL
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');

        if (error) {
          throw new Error(`OAuth error: ${error}`);
        }

        if (!code) {
          throw new Error('No authorization code received');
        }

        // Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: GOOGLE_REDIRECT_URI,
            grant_type: 'authorization_code',
          }),
        });

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
          throw new Error(`Token exchange failed: ${tokenData.error}`);
        }

        // Store tokens in Firestore
        const userUID = getCurrentUser();
        if (!userUID) {
          throw new Error('No user logged in');
        }

        const userRef = doc(db, 'Users', userUID);
        await updateDoc(userRef, {
          'credentials.googleSheetsOAuth': {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiryDate: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
          },
        });

        // Redirect back to the main page
        navigate('/');
      } catch (error) {
        console.error('Error in Google callback:', error);
        // Redirect to error page or show error message
        navigate('/error', { state: { error: error.message } });
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Connecting to Google Sheets...</p>
      </div>
    </div>
  );
};

export default GoogleCallback; 