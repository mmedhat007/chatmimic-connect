import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../services/firebase';
import NavSidebar from '../components/NavSidebar';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = 'https://kutdbashpuuysxywvzgs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1dGRiYXNocHV1eXN4eXd2emdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwMDEyNjQsImV4cCI6MjA1NzU3NzI2NH0.sPX_kiCkssIG9v1AIoRbdlmnEL-7GCmm_MIxudJyVO8';
const supabase = createClient(supabaseUrl, supabaseKey);

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

const AgentSetupPage = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-message',
      text: "👋 Hi! I'm your DenoteAI Business Assistant. I'll help you set up your WhatsApp AI agent by asking a few questions about your business. This will help me understand your needs and customize the agent to best serve your customers.\n\nLet's get started with some basic information about your company. What's your business name?",
      sender: 'bot',
      timestamp: new Date()
    }
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const userUID = getCurrentUser();
  const navigate = useNavigate();

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Track the current question stage
  const [currentStage, setCurrentStage] = useState('company_name');
  // Store collected information
  const [businessInfo, setBusinessInfo] = useState({
    company_info: {
      name: '',
      industry: '',
      locations: [] as string[],
      contact_info: '',
      differentiators: ''
    },
    roles: [] as { role: string, priority: number }[],
    communication_style: {
      tone: '',
      emoji_usage: false,
      response_length: ''
    },
    scenarios: [] as { name: string, workflow: string }[],
    knowledge_base: {
      faq_url: '',
      product_catalog: ''
    },
    compliance_rules: {
      gdpr_disclaimer: '',
      forbidden_words: [] as string[]
    }
  });

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isLoading || !userUID) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: newMessage.trim(),
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setNewMessage('');
    setIsLoading(true);

    // Process the user's response based on the current stage
    processUserResponse(newMessage.trim());
  };

  const processUserResponse = async (response: string) => {
    // Update business info based on current stage
    let nextStage = '';
    let botResponse = '';

    switch (currentStage) {
      case 'company_name':
        setBusinessInfo(prev => ({
          ...prev,
          company_info: { ...prev.company_info, name: response }
        }));
        botResponse = `Thanks for sharing that your business name is "${response}"! What industry are you in?`;
        nextStage = 'industry';
        break;

      case 'industry':
        setBusinessInfo(prev => ({
          ...prev,
          company_info: { ...prev.company_info, industry: response }
        }));
        botResponse = `Great! Now, please tell me about your business location(s). You can list multiple locations separated by commas.`;
        nextStage = 'locations';
        break;

      case 'locations':
        const locations = response.split(',').map(loc => loc.trim());
        setBusinessInfo(prev => ({
          ...prev,
          company_info: { ...prev.company_info, locations }
        }));
        botResponse = `Thanks for sharing your location(s). What's the best contact information for your business? (email, phone, etc.)`;
        nextStage = 'contact_info';
        break;

      case 'contact_info':
        setBusinessInfo(prev => ({
          ...prev,
          company_info: { ...prev.company_info, contact_info: response }
        }));
        botResponse = `What makes your business unique? What are your key differentiators from competitors?`;
        nextStage = 'differentiators';
        break;

      case 'differentiators':
        setBusinessInfo(prev => ({
          ...prev,
          company_info: { ...prev.company_info, differentiators: response }
        }));
        botResponse = `Now, let's talk about what roles you want your WhatsApp AI agent to fulfill. What are the primary roles? (e.g., answer FAQs, forward leads, handle complaints). Please list them in order of priority.`;
        nextStage = 'roles';
        break;

      case 'roles':
        const rolesList = response.split(',').map((role, index) => ({
          role: role.trim(),
          priority: index + 1
        }));
        setBusinessInfo(prev => ({
          ...prev,
          roles: rolesList
        }));
        botResponse = `Great! Now, what tone should your AI agent use when communicating with customers? (e.g., formal, casual, friendly)`;
        nextStage = 'tone';
        break;

      case 'tone':
        setBusinessInfo(prev => ({
          ...prev,
          communication_style: { ...prev.communication_style, tone: response }
        }));
        botResponse = `Should your AI agent use emojis in responses? (yes/no)`;
        nextStage = 'emoji_usage';
        break;

      case 'emoji_usage':
        const useEmojis = response.toLowerCase() === 'yes' || response.toLowerCase() === 'y';
        setBusinessInfo(prev => ({
          ...prev,
          communication_style: { ...prev.communication_style, emoji_usage: useEmojis }
        }));
        botResponse = `How long should the AI agent's responses typically be? (short, medium, or long)`;
        nextStage = 'response_length';
        break;

      case 'response_length':
        setBusinessInfo(prev => ({
          ...prev,
          communication_style: { ...prev.communication_style, response_length: response.toLowerCase() }
        }));
        botResponse = `What are common scenarios your AI agent should handle? (e.g., product inquiries, complaints, refunds). Please describe one scenario at a time, and I'll ask for more if needed.`;
        nextStage = 'scenarios';
        break;

      case 'scenarios':
        // For simplicity, we'll just add one scenario for now
        const newScenario = {
          name: `Scenario ${businessInfo.scenarios.length + 1}`,
          workflow: response
        };
        setBusinessInfo(prev => ({
          ...prev,
          scenarios: [...prev.scenarios, newScenario]
        }));
        botResponse = `Do you have any knowledge base resources like FAQs or product catalogs? If yes, please provide URLs or describe them.`;
        nextStage = 'knowledge_base';
        break;

      case 'knowledge_base':
        setBusinessInfo(prev => ({
          ...prev,
          knowledge_base: { 
            faq_url: response.includes('http') ? response : '',
            product_catalog: response
          }
        }));
        botResponse = `Are there any compliance requirements or disclaimers your AI agent should be aware of? (e.g., GDPR, industry regulations)`;
        nextStage = 'compliance';
        break;

      case 'compliance':
        setBusinessInfo(prev => ({
          ...prev,
          compliance_rules: { 
            ...prev.compliance_rules,
            gdpr_disclaimer: response 
          }
        }));
        botResponse = `Last question: Are there any words or phrases your AI agent should avoid using? Please list them separated by commas, or type "none" if there aren't any.`;
        nextStage = 'forbidden_words';
        break;

      case 'forbidden_words':
        const forbiddenWords = response.toLowerCase() === 'none' 
          ? [] 
          : response.split(',').map(word => word.trim());
        
        setBusinessInfo(prev => ({
          ...prev,
          compliance_rules: { 
            ...prev.compliance_rules,
            forbidden_words: forbiddenWords 
          }
        }));
        
        // Final stage - save to Supabase and complete
        await saveToSupabase();
        
        botResponse = `Thank you for providing all this information! I've saved your preferences and configured your WhatsApp AI agent. You can now access your WhatsApp dashboard and start using your AI agent. You can always update these settings later from the dashboard.`;
        nextStage = 'complete';
        setSetupComplete(true);
        break;

      case 'complete':
        // If we're already complete, just navigate to the dashboard
        navigate('/');
        return;

      default:
        botResponse = `I'm not sure what to ask next. Let's go to your dashboard.`;
        nextStage = 'complete';
        setSetupComplete(true);
    }

    // Add bot response
    setTimeout(() => {
      const botMessage: Message = {
        id: Date.now().toString(),
        text: botResponse,
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMessage]);
      setCurrentStage(nextStage);
      setIsLoading(false);
    }, 1000);
  };

  const saveToSupabase = async () => {
    try {
      if (!userUID) return;

      // Create a table for the user if it doesn't exist
      const { error: createTableError } = await supabase.rpc('create_user_table', {
        uid: userUID
      });

      if (createTableError) {
        console.error('Error creating table:', createTableError);
      }

      // Insert the data into the user's table
      const { error: insertError } = await supabase
        .from(userUID)
        .insert([
          {
            company_info: businessInfo.company_info,
            roles: businessInfo.roles,
            communication_style: businessInfo.communication_style,
            scenarios: businessInfo.scenarios,
            knowledge_base: businessInfo.knowledge_base,
            compliance_rules: businessInfo.compliance_rules
          }
        ]);

      if (insertError) {
        console.error('Error inserting data:', insertError);
      }

      // Create embeddings for the knowledge base
      const { error: embeddingsError } = await supabase.rpc('create_embeddings', {
        uid: userUID,
        content: JSON.stringify(businessInfo)
      });

      if (embeddingsError) {
        console.error('Error creating embeddings:', embeddingsError);
      }

    } catch (error) {
      console.error('Error saving to Supabase:', error);
    }
  };

  const handleContinueToDashboard = () => {
    navigate('/');
  };

  return (
    <div className="flex h-screen">
      <NavSidebar />
      <div className="flex-1 ml-20">
        <div className="p-8 max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">WhatsApp AI Assistant Setup</h1>
            <p className="text-lg text-gray-600">
              Design your perfect WhatsApp AI assistant that understands your business needs. Answer the questions below to customize your AI agent.
            </p>
          </div>
          <div className="h-[600px] bg-white rounded-lg shadow-lg overflow-hidden flex flex-col">
            {/* Chat Header */}
            <div className="bg-white border-b px-4 py-3">
              <div className="flex items-center">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
                    🤖
                  </div>
                  <div className="ml-3">
                    <div className="font-medium">DenoteAI Business Assistant</div>
                    <div className="text-xs text-gray-500">Configuring your WhatsApp AI agent</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg px-4 py-2 ${
                      message.sender === 'user'
                        ? 'bg-blue-500 text-white rounded-bl-none'
                        : 'bg-white text-gray-800 rounded-br-none shadow'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
                    <div
                      className={`text-xs mt-1 ${
                        message.sender === 'user' ? 'text-white/80' : 'text-gray-500'
                      }`}
                    >
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white text-gray-800 rounded-lg rounded-bl-none px-4 py-2 shadow">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input or Continue Button */}
            <div className="p-4 border-t border-gray-200 bg-white">
              {setupComplete ? (
                <button
                  onClick={handleContinueToDashboard}
                  className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Continue to Dashboard
                </button>
              ) : (
                <div className="relative flex items-end">
                  <textarea
                    rows={1}
                    placeholder="Type your answer..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-auto"
                    style={{ maxHeight: '150px', minHeight: '42px' }}
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      // Auto-adjust height
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                      // Allow new line with Shift+Enter
                      if (e.key === 'Enter' && e.shiftKey) {
                        return;
                      }
                    }}
                    disabled={isLoading}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || isLoading}
                    className={`ml-2 px-4 py-2 rounded-lg flex items-center ${
                      newMessage.trim() && !isLoading
                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                        : 'bg-gray-400 text-white cursor-not-allowed'
                    }`}
                    style={{ height: '42px' }}
                  >
                    <Send size={16} className={isLoading ? 'animate-pulse' : ''} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentSetupPage; 