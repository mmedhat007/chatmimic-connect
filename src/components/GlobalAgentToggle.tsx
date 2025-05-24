import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, getCurrentUser } from '../services/firebase';

const GlobalAgentToggle = () => {
  const [isGloballyDisabled, setIsGloballyDisabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const fetchGlobalSetting = async () => {
      const userUID = getCurrentUser();
      if (!userUID) return;

      try {
        setLoading(true);
        // Get the root Whatsapp_Data document
        const whatsappDataRef = doc(db, 'Whatsapp_Data', userUID);
        const whatsappDataDoc = await getDoc(whatsappDataRef);
        
        if (whatsappDataDoc.exists()) {
          const data = whatsappDataDoc.data();
          // Check if the globalAgentDisabled field exists
          setIsGloballyDisabled(data.globalAgentDisabled === true);
        }
      } catch (error) {
        console.error('Error fetching global agent settings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGlobalSetting();
  }, []);

  const toggleGlobalAgentStatus = async () => {
    const userUID = getCurrentUser();
    if (!userUID) return;

    try {
      setUpdating(true);
      const whatsappDataRef = doc(db, 'Whatsapp_Data', userUID);
      
      // Update the global setting
      await updateDoc(whatsappDataRef, {
        globalAgentDisabled: !isGloballyDisabled,
        lastUpdated: new Date()
      });
      
      // Update local state
      setIsGloballyDisabled(!isGloballyDisabled);
    } catch (error) {
      console.error('Error updating global agent status:', error);
    } finally {
      setUpdating(false);
    }
  };

  const getButtonStyle = () => {
    return isGloballyDisabled
      ? 'bg-red-100 text-red-800 border-red-300'
      : 'bg-green-100 text-green-800 border-green-300';
  };

  const getButtonText = () => {
    return isGloballyDisabled
      ? 'AI Agent Globally Disabled'
      : 'AI Agent Globally Enabled';
  };

  if (loading) {
    return <div className="animate-pulse p-4">Loading global agent settings...</div>;
  }

  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm mb-4">
      <h3 className="text-lg font-medium mb-2">Global AI Agent Control</h3>
      <p className="text-sm text-gray-600 mb-3">
        {isGloballyDisabled
          ? "The AI agent is currently disabled for ALL chats. Individual chat settings will be ignored."
          : "The AI agent is globally enabled. Individual chats can still be configured separately."}
      </p>
      
      <button
        onClick={toggleGlobalAgentStatus}
        disabled={updating}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${getButtonStyle()} ${updating ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
      >
        {updating ? 'Updating...' : getButtonText()}
      </button>
    </div>
  );
};

export default GlobalAgentToggle; 