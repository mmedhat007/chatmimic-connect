import { useState, useEffect } from 'react';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db, getCurrentUser } from '../services/firebase';

interface AgentControlsProps {
  phoneNumber: string;
}

const AgentControls = ({ phoneNumber }: AgentControlsProps) => {
  const [activeAgent, setActiveAgent] = useState<'ai' | 'human'>('ai');
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
        } else {
          // Default to AI agent, never "none"
          setActiveAgent('ai');
          
          // If agentStatus is not already 'on', update it
          if (data.agentStatus !== 'on') {
            updateDoc(chatRef, { agentStatus: 'on', humanAgent: false })
              .catch(err => console.error('Error setting default AI agent:', err));
          }
        }
      } else {
        // If document doesn't exist, default to AI agent
        setActiveAgent('ai');
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
      
      // Cycle only between AI and human, never to "none"
      const newState = activeAgent === 'ai'
        ? { agentStatus: 'off', humanAgent: true }   // Switch to human
        : { agentStatus: 'on', humanAgent: false };  // Switch to AI

      await updateDoc(chatRef, newState);
    } catch (error) {
      console.error('Error updating agent status:', error);
    }
  };

  if (loading) {
    return <div className="animate-pulse">Loading agent controls...</div>;
  }

  const getButtonStyle = () => {
    return activeAgent === 'ai'
      ? 'bg-green-100 text-green-800'
      : 'bg-blue-100 text-blue-800';
  };

  const getButtonText = () => {
    return activeAgent === 'ai'
      ? 'AI Agent Active'
      : 'Human Agent Active';
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
        Click to switch between: AI Agent ↔ Human Agent
      </div>
    </div>
  );
};

export default AgentControls; 