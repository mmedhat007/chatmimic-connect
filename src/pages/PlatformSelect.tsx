import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { MessageSquare, Facebook, Instagram } from 'lucide-react';

interface Workflows {
  whatsapp_agent?: boolean;
  meta_agent?: boolean;
}

const PlatformSelect = () => {
  const [workflows, setWorkflows] = useState<Workflows>({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const auth = getAuth();
  const db = getFirestore();

  useEffect(() => {
    const fetchWorkflows = async () => {
      if (!auth.currentUser) {
        navigate('/login');
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'Users', auth.currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setWorkflows(userData.workflows || {});
        }
      } catch (error) {
        console.error('Error fetching workflows:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkflows();
  }, [auth.currentUser, navigate]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#09659c]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <h1 className="text-3xl font-bold text-gray-800 text-center mb-8">
          Select Platform
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* WhatsApp Card */}
          <div 
            onClick={() => workflows.whatsapp_agent ? navigate('/') : null}
            className={`bg-white rounded-xl shadow-lg p-6 flex flex-col items-center justify-center space-y-4 transition-all duration-200 ${
              workflows.whatsapp_agent 
                ? 'cursor-pointer hover:shadow-xl transform hover:-translate-y-1' 
                : 'opacity-50 cursor-not-allowed'
            }`}
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
              {workflows.whatsapp_agent ? 'Connected' : 'Not Connected'}
            </span>
          </div>

          {/* Facebook Card */}
          <div 
            onClick={() => workflows.meta_agent ? navigate('/coming-soon') : null}
            className={`bg-white rounded-xl shadow-lg p-6 flex flex-col items-center justify-center space-y-4 transition-all duration-200 ${
              workflows.meta_agent 
                ? 'cursor-pointer hover:shadow-xl transform hover:-translate-y-1' 
                : 'opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="w-16 h-16 bg-[#09659c] rounded-full flex items-center justify-center">
              <Facebook className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800">Facebook</h2>
            <span className={`px-3 py-1 rounded-full text-sm ${
              workflows.meta_agent 
                ? 'bg-[#e6f3f8] text-[#09659c]' 
                : 'bg-gray-100 text-gray-500'
            }`}>
              {workflows.meta_agent ? 'Coming Soon' : 'Not Connected'}
            </span>
          </div>

          {/* Instagram Card */}
          <div 
            onClick={() => workflows.meta_agent ? navigate('/coming-soon') : null}
            className={`bg-white rounded-xl shadow-lg p-6 flex flex-col items-center justify-center space-y-4 transition-all duration-200 ${
              workflows.meta_agent 
                ? 'cursor-pointer hover:shadow-xl transform hover:-translate-y-1' 
                : 'opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="w-16 h-16 bg-[#09659c] rounded-full flex items-center justify-center">
              <Instagram className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800">Instagram</h2>
            <span className={`px-3 py-1 rounded-full text-sm ${
              workflows.meta_agent 
                ? 'bg-[#e6f3f8] text-[#09659c]' 
                : 'bg-gray-100 text-gray-500'
            }`}>
              {workflows.meta_agent ? 'Coming Soon' : 'Not Connected'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlatformSelect; 