import { useState } from 'react';
import { doc, updateDoc, getDoc, setDoc, collection, addDoc } from 'firebase/firestore';
import { db, getCurrentUser } from '../services/firebase';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();

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
          limit: 1000,
          reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          paid: false, // Initialize as unpaid
          setup_completed: false // Track whether AI agent setup is completed
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
      const currentTime = new Date();
      
      await setDoc(placeholderChatRef, {
        contactName: 'System',
        lastMessage: 'WhatsApp integration setup complete',
        lastMessageTime: currentTime,
        lastTimestamp: currentTime.getTime(),
        status: 'closed',
        agentStatus: 'off',
        humanAgent: false,
        tags: ['system']
      });

      // Create initial message in the messages subcollection
      const messagesCollectionRef = collection(placeholderChatRef, 'messages');
      await addDoc(messagesCollectionRef, {
        message: 'WhatsApp integration setup complete. You can now start receiving and sending messages.',
        timestamp: currentTime,
        sender: 'agent',
        date: currentTime.toLocaleDateString()
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

      // Call onComplete to navigate to AI agent setup
      onComplete();
    } catch (error) {
      console.error('Error in setup:', error);
      setError('Failed to complete setup. Please try again.');
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
          <li>Click "Create App" in the top right corner</li>
          <li>Select "Business" as the app type</li>
          <li>Enter your app name (e.g., "MyCompany WhatsApp")</li>
          <li>Add your business email for contact</li>
          <li>Click "Create App" to proceed</li>
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
        <h3 className="text-lg font-semibold mb-2">Step 2: Add WhatsApp Product</h3>
        <ol className="list-decimal pl-5 space-y-2">
          <li>In your app dashboard, find and click "Add Product"</li>
          <li>Look for "WhatsApp" in the product list</li>
          <li>Click "Set Up" next to WhatsApp</li>
          <li>You'll be taken to the WhatsApp configuration page</li>
        </ol>
        <button 
          onClick={() => setStep(3)}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          disabled={step !== 2}
        >
          Next
        </button>
      </div>

      {/* Step 3: Configure Webhook */}
      <div className={`mb-8 ${step !== 3 && 'opacity-50'}`}>
        <h3 className="text-lg font-semibold mb-2">Step 3: Configure Webhook</h3>
        <ol className="list-decimal pl-5 space-y-2">
          <li>In the WhatsApp configuration:</li>
          <li>Find the "Webhook" section</li>
          <li>Add webhook URL: <code className="bg-gray-100 px-2 py-1 rounded">https://automation.denoteai.tech/webhook/whatsapp-webhook</code></li>
          <li>Create a Verify Token (can be any string you choose)</li>
          <li>Save your Verify Token somewhere safe</li>
          <li>Scroll down to "Webhook Fields"</li>
          <li>Click "Manage"</li>
          <li>Enable the "messages" field</li>
          <li>Click "Save" to confirm</li>
        </ol>
        <button 
          onClick={() => setStep(4)}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          disabled={step !== 3}
        >
          Next
        </button>
      </div>

      {/* Step 4: Phone Number Setup */}
      <div className={`mb-8 ${step !== 4 && 'opacity-50'}`}>
        <h3 className="text-lg font-semibold mb-2">Step 4: API Setup & Phone Number</h3>
        <ol className="list-decimal pl-5 space-y-2">
          <li>Go to the "API Setup" section</li>
          <li>Click "Add Phone Number"</li>
          <li>Follow the verification process to add your business phone number</li>
          <li>Once verified, copy your Phone Number ID</li>
          <li>Generate a Permanent Access Token:</li>
          <ol className="list-[lower-alpha] ml-8 space-y-1">
            <li>Go to "System Users" in Business Settings</li>
            <li>Create a new System User or select existing</li>
            <li>Give it a name like "WhatsApp API Access"</li>
            <li>Assign "WhatsApp Business Product" role</li>
            <li>Generate new token with "whatsapp_business_messaging" permission</li>
            <li>Copy the token immediately (it won't be shown again)</li>
          </ol>
        </ol>
        <button 
          onClick={() => setStep(5)}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          disabled={step !== 4}
        >
          Next
        </button>
      </div>

      {/* Step 5: Enter Credentials */}
      <div className={`mb-8 ${step !== 5 && 'opacity-50'}`}>
        <h3 className="text-lg font-semibold mb-2">Step 5: Enter Your Credentials</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Access Token</label>
            <input
              type="password"
              value={credentials.access_token}
              onChange={(e) => setCredentials(prev => ({ ...prev, access_token: e.target.value }))}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your permanent access token"
              disabled={step !== 5}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Phone Number ID</label>
            <input
              type="text"
              value={credentials.phone_number_id}
              onChange={(e) => setCredentials(prev => ({ ...prev, phone_number_id: e.target.value }))}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your phone number ID"
              disabled={step !== 5}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Pricing Information */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">Basic Plan Details</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Unlimited conversations (Meta fees apply)</li>
              <li>• Flat rate: 4,000 EGP</li>
              <li>• Full access to all features</li>
              <li>• 24/7 support</li>
            </ul>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isLoading || step !== 5}
            className="w-full mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Setting up...' : 'Complete Setup'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppSetup; 