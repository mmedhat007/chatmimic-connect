import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { FileSpreadsheet, LogOut } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { auth } from '../services/firebase';

// Constants for Google OAuth
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const GOOGLE_REDIRECT_URI = `${window.location.origin}/google-callback`;
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file';

const GoogleSheetsButton: React.FC = () => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if user has authorized Google Sheets
    // This is a placeholder - implement actual check in googleSheets.ts
    const checkAuth = async () => {
      setLoading(true);
      try {
        // For now, just assume not authorized - will be implemented in the future
        setIsAuthorized(false);
      } catch (error) {
        console.error('Error checking Google auth status:', error);
      } finally {
        setLoading(false);
      }
    };

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        checkAuth();
      } else {
        setIsAuthorized(false);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleAuth = async () => {
    if (isAuthorized) {
      try {
        // Placeholder for revoking auth - implement in googleSheets.ts
        setIsAuthorized(false);
        toast.success('Google Sheets disconnected');
      } catch (error) {
        console.error('Error revoking Google auth:', error);
        toast.error('Failed to disconnect Google Sheets');
      }
    } else {
      setLoading(true);
      try {
        // Redirect to Google OAuth flow
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=${GOOGLE_CLIENT_ID}` +
          `&redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI)}` +
          `&response_type=code` +
          `&scope=${encodeURIComponent(GOOGLE_SCOPES)}` +
          `&access_type=offline` +
          `&prompt=consent`;

        window.location.href = authUrl;
      } catch (error) {
        console.error('Error authorizing Google Sheets:', error);
        toast.error('Failed to connect Google Sheets');
        setLoading(false);
      }
    }
  };

  return (
    <Button
      variant={isAuthorized ? "outline" : "default"}
      onClick={handleAuth}
      disabled={loading}
      className={isAuthorized ? "border-green-500 text-green-700 hover:bg-green-50" : ""}
    >
      {loading ? (
        <span className="animate-pulse">Loading...</span>
      ) : isAuthorized ? (
        <>
          <LogOut className="mr-2 h-4 w-4" />
          Disconnect Google Sheets
        </>
      ) : (
        <>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Connect Google Sheets
        </>
      )}
    </Button>
  );
};

export default GoogleSheetsButton; 