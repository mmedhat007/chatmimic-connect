import React from 'react';
import { useNavigate } from 'react-router-dom';
import NavSidebar from '../components/NavSidebar';
import WhatsAppSetupComponent from '../components/WhatsAppSetup';
import { Link } from 'react-router-dom';

const WhatsAppSetup: React.FC = () => {
  const navigate = useNavigate();

  const handleSetupComplete = () => {
    // Navigate to agent setup after WhatsApp setup is complete
    navigate('/agent-setup');
  };

  return (
    <div className="flex h-screen">
      <NavSidebar />
      <div className="flex-1 ml-20 p-6 overflow-y-auto">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold mb-6">WhatsApp Integration</h1>
          <p className="text-gray-600 mb-8">
            Connect your WhatsApp Business account to start automating your customer interactions.
            After completing this setup, you'll configure your AI assistant to handle messages.
          </p>
          
          <WhatsAppSetupComponent onComplete={handleSetupComplete} />
          
          <div className="mt-10 bg-blue-50 p-6 rounded-lg border border-blue-200">
            <h2 className="text-xl font-semibold mb-3">Data Collection with Google Sheets</h2>
            <p className="mb-4">
              Want to collect and organize data from WhatsApp conversations? 
              You can connect Google Sheets to automatically extract and store information 
              from your WhatsApp messages.
            </p>
            <div className="flex items-center mt-2">
              <Link 
                to="/google-sheets" 
                className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded transition-colors duration-300"
              >
                Set up Google Sheets Integration
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppSetup; 