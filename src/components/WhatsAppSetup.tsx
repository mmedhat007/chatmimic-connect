import { useState } from 'react';
import { doc, updateDoc, getDoc, setDoc, collection } from 'firebase/firestore';
import { db, getCurrentUser } from '../services/firebase';

interface WhatsAppCredentials {
  access_token: string;
  phone_number_id: string;
}

const WhatsAppSetup = ({ onComplete }: { onComplete: () => void }) => {
  const [step, setStep] = useState(1);
  const [credentials, setCredentials] = useState<WhatsAppCredentials>({
    access_token: '',
    phone_number_id: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const validateCredentials = async (creds: WhatsAppCredentials): Promise<boolean> => {
    try {
      // Test the WhatsApp API with the provided credentials by sending a message to a test number
      const response = await fetch(`https://graph.facebook.com/v17.0/${creds.phone_number_id}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${creds.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: "201103343450",
          type: "text",
          text: { 
            body: "WhatsApp credentials validation test from DenoteAI" 
          }
        })
      });

      const data = await response.json();
      
      // If we get a message id back, the credentials are valid
      if (data.messages && data.messages[0]?.id) {
        return true;
      }

      // If we get an auth error, credentials are invalid
      if (data.error?.type === 'OAuthException') {
        setError('Invalid credentials. Please check your access token and phone number ID.');
        return false;
      }

      // If we get here, something else is wrong
      setError('Could not verify WhatsApp credentials. Please check your phone number ID and access token.');
      console.error('WhatsApp API response:', data);
      return false;
    } catch (error) {
      console.error('Error validating credentials:', error);
      setError('Failed to validate credentials. Please try again.');
      return false;
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Validate credentials
      const isValid = await validateCredentials(credentials);
      if (!isValid) {
        setIsLoading(false);
        return;
      }

      const userUID = getCurrentUser();
      if (!userUID) {
        setError('No user logged in');
        return;
      }

      // Update user document with WhatsApp credentials and workflow
      const userRef = doc(db, 'Users', userUID);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        setError('User document not found');
        return;
      }

      // Update credentials and workflow in Users collection
      await updateDoc(userRef, {
        'credentials.whatsappCredentials': {
          access_token: credentials.access_token,
          phone_number_id: credentials.phone_number_id
        },
        'workflows.whatsapp_agent': {
          executions_used: 0,
          limit: 1000, // Basic plan limit
          reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
        }
      });

      // Create WhatsApp_Data document with initial structure
      const whatsappDataRef = doc(db, 'Whatsapp_Data', userUID);
      await setDoc(whatsappDataRef, {
        client_number: credentials.phone_number_id,
        created_at: new Date(),
        settings: {
          auto_reply: true,
          business_hours: {
            enabled: false,
            start: '09:00',
            end: '17:00',
            timezone: 'Africa/Cairo',
            auto_reply_outside_hours: true
          },
          notification_email: userDoc.data()?.email || '',
        },
        statistics: {
          total_messages: 0,
          total_conversations: 0,
          last_message_date: null
        }
      }, { merge: true });

      // Create initial chats collection with a placeholder document
      const chatsCollectionRef = collection(db, 'Whatsapp_Data', userUID, 'chats');
      const placeholderChatRef = doc(chatsCollectionRef, 'system');
      await setDoc(placeholderChatRef, {
        contactName: 'System',
        lastMessage: 'WhatsApp integration setup complete',
        lastMessageTime: new Date(),
        status: 'closed',
        agentStatus: 'off',
        humanAgent: false,
        tags: ['system']
      });

      // Create initial templates collection with a placeholder document
      const templatesCollectionRef = collection(db, 'Whatsapp_Data', userUID, 'templates');
      const welcomeTemplateRef = doc(templatesCollectionRef, 'welcome');
      await setDoc(welcomeTemplateRef, {
        name: 'Welcome Message',
        content: 'Hello! Thank you for contacting us. How can we assist you today?',
        created_at: new Date(),
        is_active: true,
        type: 'auto_reply'
      });

      onComplete();
    } catch (error) {
      console.error('Error setting up WhatsApp:', error);
      setError('Failed to save WhatsApp configuration. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6">WhatsApp Setup Guide</h2>

      {/* Step 1: Create Meta App */}
      <div className={`mb-8 ${step !== 1 && 'opacity-50'}`}>
        <h3 className="text-lg font-semibold mb-2">Step 1: Create Meta App</h3>
        <ol className="list-decimal pl-5 space-y-2">
          <li>Go to <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Meta Developers</a></li>
          <li>Click "Create App"</li>
          <li>Select "Business" as the app type</li>
          <li>Fill in your app details and create the app</li>
        </ol>
        <button 
          onClick={() => setStep(2)}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          disabled={step !== 1}
        >
          Next
        </button>
      </div>

      {/* Step 2: Add WhatsApp */}
      <div className={`mb-8 ${step !== 2 && 'opacity-50'}`}>
        <h3 className="text-lg font-semibold mb-2">Step 2: Configure WhatsApp</h3>
        <ol className="list-decimal pl-5 space-y-2">
          <li>In your app dashboard, click "Add Product"</li>
          <li>Select "WhatsApp"</li>
          <li>In the WhatsApp configuration:</li>
          <li className="ml-4">Add webhook URL: <code className="bg-gray-100 px-2 py-1 rounded">https://automation.denoteai.tech/webhook/whatsapp-webhook</code></li>
          <li className="ml-4">Add your WhatsApp business number</li>
          <li>Create a permanent access token</li>
        </ol>
        <button 
          onClick={() => setStep(3)}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          disabled={step !== 2}
        >
          Next
        </button>
      </div>

      {/* Step 3: Enter Credentials */}
      <div className={`mb-8 ${step !== 3 && 'opacity-50'}`}>
        <h3 className="text-lg font-semibold mb-2">Step 3: Enter Your Credentials</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Access Token</label>
            <input
              type="password"
              value={credentials.access_token}
              onChange={(e) => setCredentials(prev => ({ ...prev, access_token: e.target.value }))}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your permanent access token"
              disabled={step !== 3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Phone Number ID</label>
            <input
              type="text"
              value={credentials.phone_number_id}
              onChange={(e) => setCredentials(prev => ({ ...prev, phone_number_id: e.target.value }))}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your WhatsApp Phone Number ID"
              disabled={step !== 3}
            />
          </div>
          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}
          <button
            onClick={handleSubmit}
            disabled={!credentials.access_token || !credentials.phone_number_id || isLoading || step !== 3}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Validating...' : 'Complete Setup'}
          </button>
        </div>
      </div>

      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium mb-2">Basic Plan Details:</h4>
        <ul className="space-y-2 text-sm">
          <li>• 1000 conversations per month</li>
          <li>• 2000 EGP monthly</li>
          <li>• For additional executions, please contact us at <a href="mailto:denoteai.eg@gmail.com" className="text-blue-600 hover:underline">denoteai.eg@gmail.com</a></li>
        </ul>
      </div>
    </div>
  );
};

export default WhatsAppSetup; 