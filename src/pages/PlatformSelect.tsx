import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Facebook, Instagram } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db, getCurrentUser } from '../services/firebase';
import WhatsAppSetup from '../components/WhatsAppSetup';

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
      navigate('/');
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
          navigate('/');
        }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <h1 className="text-3xl font-bold text-gray-800 text-center mb-8">
          Select Platform
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* WhatsApp Card */}
          <div 
            onClick={handleWhatsAppClick}
            className="bg-white rounded-xl shadow-lg p-6 flex flex-col items-center justify-center space-y-4 transition-all duration-200 cursor-pointer hover:shadow-xl transform hover:-translate-y-1"
          >
            <div className="w-16 h-16 bg-[#09659c] rounded-full flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800">WhatsApp</h2>
            <span className={`px-3 py-1 rounded-full text-sm ${
              workflows.whatsapp_agent 
                ? 'bg-[#e6f3f8] text-[#09659c]' 
                : 'bg-gray-100 text-gray-500'
            }`}>
              {workflows.whatsapp_agent ? 'Connected' : 'Click to Setup'}
            </span>
          </div>

          {/* Meta Platforms Card (Facebook & Instagram) */}
          <div 
            className="bg-white rounded-xl shadow-lg p-6 flex flex-col items-center justify-center space-y-4 transition-all duration-200 opacity-50 cursor-not-allowed"
          >
            <div className="relative w-24 h-16 flex items-center justify-center">
              <div className="absolute left-0 w-16 h-16 bg-[#09659c] rounded-full flex items-center justify-center transform -rotate-12">
                <Facebook className="w-8 h-8 text-white" />
              </div>
              <div className="absolute right-0 w-16 h-16 bg-[#09659c] rounded-full flex items-center justify-center transform rotate-12">
                <Instagram className="w-8 h-8 text-white" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-gray-800">Meta Platforms</h2>
            <p className="text-sm text-gray-600 text-center -mt-2">Facebook & Instagram</p>
            <span className="px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-500">
              Coming Soon
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlatformSelect; 