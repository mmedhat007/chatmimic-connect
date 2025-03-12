import { useState, useEffect } from 'react';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db, getCurrentUser } from '../services/firebase';

interface AgentControlsProps {
  phoneNumber: string;
}

const AgentControls = ({ phoneNumber }: AgentControlsProps) => {
  const [activeAgent, setActiveAgent] = useState<'ai' | 'human' | 'none'>('none');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userUID = getCurrentUser();
    if (!userUID) return;

    const chatRef = doc(db, 'Whatsapp_Data', userUID, 'chats', phoneNumber);
    
    // Set up real-time listener for agent settings
    const unsubscribe = onSnapshot(chatRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.humanAgent) {
          setActiveAgent('human');
        } else if (data.agentStatus === 'on') {
          setActiveAgent('ai');
        } else {
          setActiveAgent('none');
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [phoneNumber]);

  const toggleAgent = async () => {
    const userUID = getCurrentUser();
    if (!userUID) return;

    try {
      const chatRef = doc(db, 'Whatsapp_Data', userUID, 'chats', phoneNumber);
      
      // Cycle through: none -> AI -> human -> none
      const newState = {
        none: { agentStatus: 'on', humanAgent: false }, // Switch to AI
        ai: { agentStatus: 'off', humanAgent: true },   // Switch to human
        human: { agentStatus: 'off', humanAgent: false } // Switch to none
      }[activeAgent];

      await updateDoc(chatRef, newState);
    } catch (error) {
      console.error('Error updating agent status:', error);
    }
  };

  if (loading) {
    return <div className="animate-pulse">Loading agent controls...</div>;
  }

  const getButtonStyle = () => {
    switch (activeAgent) {
      case 'ai':
        return 'bg-green-100 text-green-800';
      case 'human':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getButtonText = () => {
    switch (activeAgent) {
      case 'ai':
        return 'AI Agent Active';
      case 'human':
        return 'Human Agent Active';
      default:
        return 'No Agent Active';
    }
  };

  return (
    <div className="flex flex-col space-y-2">
      <button
        onClick={toggleAgent}
        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${getButtonStyle()}`}
      >
        {getButtonText()}
      </button>
      <div className="text-xs text-gray-500">
        Click to cycle between: No Agent → AI Agent → Human Agent
      </div>
    </div>
  );
};

export default AgentControls; 