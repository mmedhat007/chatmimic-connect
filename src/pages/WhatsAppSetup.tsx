import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { updateWhatsAppConfig } from '../services/api';
import { auth } from '../services/firebase';
import NavSidebar from '../components/NavSidebar';

// Mock function to replace Supabase
const getAgentConfig = async (uid: string) => {
  // Try to get from localStorage first
  const storedConfig = localStorage.getItem(`user_${uid}_config`);
  if (storedConfig) {
    try {
      return JSON.parse(storedConfig);
    } catch (e) {
      console.error('Error parsing stored config:', e);
    }
  }
  return null;
};

const WhatsAppSetup: React.FC = () => {
  const navigate = useNavigate();
  const [userUID, setUserUID] = useState<string | null>(null);
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [whatsappBusinessAccountId, setWhatsappBusinessAccountId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);

  useEffect(() => {
    // Get the user's UID from Firebase
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setUserUID(user.uid);
        
        // Check if the user has completed the agent setup
        try {
          const agentConfig = await getAgentConfig(user.uid);
          
          if (!agentConfig) {
            // If the agent config doesn't exist, redirect to the agent setup page
            toast.error('Please complete the agent setup first before configuring WhatsApp.');
            navigate('/agent-setup');
          }
        } catch (error) {
          console.error('Error checking agent setup:', error);
        } finally {
          setCheckingSetup(false);
        }
      } else {
        setUserUID(null);
        navigate('/login');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleSave = async () => {
    if (!userUID) {
      toast.error('User not authenticated. Please sign in again.');
      return;
    }

    setLoading(true);

    try {
      // Save the WhatsApp configuration
      const { error } = await updateWhatsAppConfig(userUID, {
        phone_number_id: phoneNumberId,
        whatsapp_business_account_id: whatsappBusinessAccountId,
        access_token: accessToken,
        verify_token: verifyToken
      });

      setLoading(false);

      if (error) {
        if (error.code === '42P01') {
          toast.error('Please complete the agent setup first before configuring WhatsApp.');
          navigate('/agent-setup');
          return;
        }
        toast.error(`Failed to save WhatsApp configuration: ${error.message}`);
        return;
      }

      toast.success('WhatsApp configuration saved successfully!');
      // Navigate to agent-setup without any query parameters
      navigate('/agent-setup');
    } catch (error) {
      setLoading(false);
      console.error('Error saving WhatsApp configuration:', error);
      toast.error('An unexpected error occurred. Please try again.');
    }
  };

  if (checkingSetup) {
    return (
      <div className="flex h-screen">
        <NavSidebar />
        <div className="flex-1 ml-20 p-8 flex items-center justify-center">
          <div className="text-xl text-gray-600">Checking setup status...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <NavSidebar />
      <div className="flex-1 ml-20">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-4">WhatsApp Setup</h1>
          <p className="text-gray-600 mb-6">
            Configure your WhatsApp Business API credentials to connect your WhatsApp account. 
            After completing this setup, you'll be guided through the agent configuration process.
          </p>
          
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="phoneNumberId">
                Phone Number ID
              </label>
              <input
                id="phoneNumberId"
                type="text"
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                placeholder="Enter your WhatsApp Phone Number ID"
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="whatsappBusinessAccountId">
                WhatsApp Business Account ID
              </label>
              <input
                id="whatsappBusinessAccountId"
                type="text"
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                value={whatsappBusinessAccountId}
                onChange={(e) => setWhatsappBusinessAccountId(e.target.value)}
                placeholder="Enter your WhatsApp Business Account ID"
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="accessToken">
                Access Token
              </label>
              <input
                id="accessToken"
                type="text"
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Enter your WhatsApp Access Token"
              />
            </div>
            
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="verifyToken">
                Verify Token
              </label>
              <input
                id="verifyToken"
                type="text"
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value)}
                placeholder="Enter your WhatsApp Verify Token"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <button
                className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                type="button"
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppSetup; 