import React from 'react';
import { useNavigate } from 'react-router-dom';
import NavSidebar from '../components/NavSidebar';
import WhatsAppSetupComponent from '../components/WhatsAppSetup';

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
        </div>
      </div>
    </div>
  );
};

export default WhatsAppSetup; 