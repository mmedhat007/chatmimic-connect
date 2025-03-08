import { useState, useEffect } from 'react';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db, getCurrentUser } from '../services/firebase';

interface AgentControlsProps {
  phoneNumber: string;
}

interface AgentSettings {
  aiAgent: boolean;
  humanAgent: boolean;
}

const AgentControls = ({ phoneNumber }: AgentControlsProps) => {
  const [settings, setSettings] = useState<AgentSettings>({
    aiAgent: true,
    humanAgent: false
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userUID = getCurrentUser();
    if (!userUID) return;

    const chatRef = doc(db, 'Whatsapp_Data', userUID, 'chats', phoneNumber);
    
    // Set up real-time listener for agent settings
    const unsubscribe = onSnapshot(chatRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setSettings({
          aiAgent: data.agentStatus === 'on',
          humanAgent: data.humanAgent || false
        });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [phoneNumber]);

  const toggleAIAgent = async () => {
    const userUID = getCurrentUser();
    if (!userUID) return;

    try {
      const chatRef = doc(db, 'Whatsapp_Data', userUID, 'chats', phoneNumber);
      await updateDoc(chatRef, {
        agentStatus: settings.aiAgent ? 'off' : 'on'
      });
    } catch (error) {
      console.error('Error updating AI agent status:', error);
    }
  };

  const toggleHumanAgent = async () => {
    const userUID = getCurrentUser();
    if (!userUID) return;

    try {
      const chatRef = doc(db, 'Whatsapp_Data', userUID, 'chats', phoneNumber);
      await updateDoc(chatRef, {
        humanAgent: !settings.humanAgent
      });
    } catch (error) {
      console.error('Error toggling human agent:', error);
    }
  };

  if (loading) {
    return <div className="animate-pulse">Loading agent controls...</div>;
  }

  return (
    <div className="flex flex-col space-y-4 p-4 bg-white rounded-lg shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* AI Agent Control */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">AI Agent:</span>
            <button
              onClick={toggleAIAgent}
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                settings.aiAgent
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {settings.aiAgent ? 'Active' : 'Inactive'}
            </button>
          </div>

          {/* Human Agent Control */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Human Agent:</span>
            <button
              onClick={toggleHumanAgent}
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                settings.humanAgent
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {settings.humanAgent ? 'Active' : 'Inactive'}
            </button>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      <div className="text-xs text-gray-500">
        {settings.aiAgent && settings.humanAgent ? (
          <span className="text-blue-600">
            Both AI and human agents are active. AI will assist while human agent is responding.
          </span>
        ) : settings.aiAgent ? (
          <span className="text-green-600">
            AI agent is handling this chat automatically.
          </span>
        ) : settings.humanAgent ? (
          <span className="text-blue-600">
            Human agent is handling this chat manually.
          </span>
        ) : (
          <span className="text-red-600">
            Chat is inactive. Enable either AI or human agent to start responding.
          </span>
        )}
      </div>
    </div>
  );
};

export default AgentControls; 