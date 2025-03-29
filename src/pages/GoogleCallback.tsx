import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { getCurrentUser } from '../services/firebase';
import { Button } from '../components/ui/button';
import { RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';

const GoogleCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const error = searchParams.get('error');
        
        if (error) {
          setError(`Google authorization failed: ${error}`);
          setLoading(false);
          return;
        }
        
        if (!code) {
          setError('No authorization code received from Google');
          setLoading(false);
          return;
        }
        
        const userUID = getCurrentUser();
        if (!userUID) {
          setError('No user logged in');
          setLoading(false);
          return;
        }

        // Get current Firebase auth token
        const auth = await import('firebase/auth').then(module => module.getAuth());
        const currentUser = auth.currentUser;
        if (!currentUser) {
          setError('Firebase user not authenticated');
          setLoading(false);
          return;
        }

        const idToken = await currentUser.getIdToken();
        
        // Use the secure backend endpoint for token exchange
        const response = await fetch('/api/google-oauth/exchange-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            code,
            redirectUri: `${window.location.origin}/google-callback`
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to exchange token');
        }
        
        const responseData = await response.json();
        
        // Create a toast notification
        toast.success('Google Sheets connected successfully');
        
        // Redirect back to the Google Sheets page
        navigate('/google-sheets');
      } catch (error) {
        console.error('Error in Google OAuth callback:', error);
        setError(error instanceof Error ? error.message : 'Unknown error occurred');
        setLoading(false);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gray-50">
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center mb-6">Google Authorization</h1>
        
        {loading ? (
          <div className="flex flex-col items-center justify-center">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-4" />
            <p className="text-gray-600">Processing authorization...</p>
          </div>
        ) : error ? (
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={() => navigate('/google-sheets')}>
              Return to Google Sheets
            </Button>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-green-600 mb-4">Authorization successful!</p>
            <p className="text-gray-600 mb-4">You will be redirected shortly...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoogleCallback; 