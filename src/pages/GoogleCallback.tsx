import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { getCurrentUser } from '../services/firebase';
import { Button } from '../components/ui/button';
import { RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { onAuthStateChanged } from 'firebase/auth';

interface GoogleAuthState {
  uid: string;
  timestamp: number;
}

const GoogleCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [authCode, setAuthCode] = useState<string | null>(null);
  const [stateData, setStateData] = useState<GoogleAuthState | null>(null);

  // First, extract and validate the authorization code and state
  useEffect(() => {
    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');
    const stateParam = searchParams.get('state');
    
    if (errorParam) {
      setError(`Google authorization failed: ${errorParam}`);
      setLoading(false);
      return;
    }
    
    if (!code) {
      setError('No authorization code received from Google');
      setLoading(false);
      return;
    }

    // Parse state parameter if available
    if (stateParam) {
      try {
        const decodedState = JSON.parse(atob(stateParam)) as GoogleAuthState;
        setStateData(decodedState);
        
        // If we got a state with UID, store it to help with re-authentication
        if (decodedState.uid) {
          localStorage.setItem('userUID', decodedState.uid);
        }
      } catch (e) {
        console.error('Error parsing state parameter:', e);
        // Continue even if state param is invalid
      }
    }

    setAuthCode(code);
  }, [searchParams]);

  // Then, wait for Firebase auth to initialize and process the code
  useEffect(() => {
    if (!authCode) return; // Skip if we don't have a valid code

    const maxRetries = 10;
    const retryDelay = 1000; // 1 second between retries
    
    const processAuthCode = async () => {
      try {
        // Get the current Firebase user
        const userUID = getCurrentUser();
        
        // If state contains UID but localStorage doesn't, use the one from state
        if (!userUID && stateData?.uid) {
          localStorage.setItem('userUID', stateData.uid);
        }
        
        // If we have a user in localStorage but Firebase auth isn't ready yet
        if (userUID && !auth.currentUser) {
          if (retryCount < maxRetries) {
            // Wait and retry
            setTimeout(() => {
              setRetryCount(prev => prev + 1);
            }, retryDelay);
            return;
          } else {
            setError('Firebase authentication timed out. Please try again.');
            setLoading(false);
            return;
          }
        }
        
        // If no user is found in localStorage
        if (!userUID) {
          setError('No user logged in. Please log in and try again.');
          setLoading(false);
          return;
        }
        
        // Wait for Firebase auth to be ready
        const currentUser = auth.currentUser;
        if (!currentUser) {
          if (retryCount < maxRetries) {
            // Wait and retry
            setTimeout(() => {
              setRetryCount(prev => prev + 1);
            }, retryDelay);
            return;
          } else {
            setError('Firebase authentication timed out. Please try again.');
            setLoading(false);
            return;
          }
        }

        // Get fresh ID token
        const idToken = await currentUser.getIdToken(true);
        
        // Use the secure backend endpoint for token exchange
        const response = await fetch('/api/google-oauth/exchange-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            code: authCode,
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

    // Start the process
    processAuthCode();
  }, [authCode, retryCount, navigate, stateData]);

  // Manual retry button handler
  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setRetryCount(0);
    
    // If we have state data with UID, ensure it's in localStorage
    if (stateData?.uid) {
      localStorage.setItem('userUID', stateData.uid);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gray-50">
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center mb-6">Google Authorization</h1>
        
        {loading ? (
          <div className="flex flex-col items-center justify-center">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-4" />
            <p className="text-gray-600">Processing authorization{retryCount > 0 ? ` (Retry ${retryCount})` : ''}...</p>
          </div>
        ) : error ? (
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <div className="flex flex-col space-y-2">
              <Button onClick={handleRetry} className="mb-2">
                Retry Authorization
              </Button>
              <Button onClick={() => navigate('/google-sheets')} variant="outline">
                Return to Google Sheets
              </Button>
            </div>
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