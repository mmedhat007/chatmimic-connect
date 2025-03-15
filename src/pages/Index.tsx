import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db, getCurrentUser } from '../services/firebase';

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkSetup = async () => {
      const userUID = getCurrentUser();
      if (!userUID) {
        navigate('/login');
        return;
      }

      try {
        const userRef = doc(db, 'Users', userUID);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
          navigate('/platform-select');
          return;
        }

        const data = userDoc.data();
        const whatsappAgent = data.workflows?.whatsapp_agent;

        if (!whatsappAgent) {
          navigate('/platform-select');
          return;
        }

        if (!whatsappAgent.setup_completed) {
          navigate('/agent-setup');
          return;
        }

        // Stay on the WhatsApp dashboard
        return;
      } catch (error) {
        console.error('Error checking setup:', error);
        navigate('/platform-select');
      }
    };

    checkSetup();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#09659c]"></div>
    </div>
  );
};

export default Index;
