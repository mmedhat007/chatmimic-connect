import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Facebook, Instagram } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db, getCurrentUser } from '../services/firebase';
import WhatsAppSetup from '../components/WhatsAppSetup';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const PlatformSelect = () => {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState({
    whatsapp_agent: false,
    meta_agent: false
  });
  const [showWhatsAppSetup, setShowWhatsAppSetup] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWorkflows = async () => {
      const userUID = getCurrentUser();
      if (!userUID) {
        navigate('/login');
        return;
      }

      try {
        const userRef = doc(db, 'Users', userUID);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const data = userDoc.data();
          setWorkflows({
            whatsapp_agent: !!data.workflows?.whatsapp_agent,
            meta_agent: !!data.workflows?.meta_agent
          });
        }
      } catch (error) {
        console.error('Error fetching workflows:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkflows();
  }, [navigate]);

  const handleWhatsAppClick = () => {
    if (workflows.whatsapp_agent) {
      navigate('/agent-setup');
    } else {
      setShowWhatsAppSetup(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#09659c]"></div>
      </div>
    );
  }

  if (showWhatsAppSetup) {
    return (
      <div className="min-h-screen bg-gray-100 p-4">
        <WhatsAppSetup onComplete={() => {
          setWorkflows(prev => ({ ...prev, whatsapp_agent: true }));
          navigate('/agent-setup');
        }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">
          Select Your Platform
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* WhatsApp Card */}
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={handleWhatsAppClick}>
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white">
                <MessageSquare size={24} />
              </div>
              <div>
                <h2 className="text-xl font-semibold">WhatsApp</h2>
                <p className="text-gray-600">Connect your WhatsApp Business account</p>
              </div>
            </div>
            <div className="mt-4">
              <Button className="w-full">
                {workflows.whatsapp_agent ? 'Configure AI Agent' : 'Get Started'}
              </Button>
            </div>
          </Card>

          {/* Meta Platforms Card */}
          <Card className="p-6 opacity-50 cursor-not-allowed">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white absolute -rotate-12">
                  <Facebook size={24} />
                </div>
                <div className="w-12 h-12 bg-pink-600 rounded-full flex items-center justify-center text-white absolute rotate-12">
                  <Instagram size={24} />
                </div>
              </div>
              <div>
                <h2 className="text-xl font-semibold">Meta Platforms</h2>
                <p className="text-gray-600">Facebook & Instagram</p>
              </div>
            </div>
            <div className="mt-4">
              <Button className="w-full" disabled>Coming Soon</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PlatformSelect; 