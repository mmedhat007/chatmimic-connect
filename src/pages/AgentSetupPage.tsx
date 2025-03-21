import { useState, useRef, useEffect } from 'react';
import { Send, AlertTriangle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getCurrentUser } from '../services/firebase';
import NavSidebar from '../components/NavSidebar';
import axios from 'axios';
import { saveUserConfig, createEmbeddings, checkEmbeddingsAvailable } from '../services/supabase';
import { toast } from 'react-hot-toast';

// OpenAI API configuration
// In a production environment, this should be stored securely and called from a backend
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

interface BusinessInfo {
  company_info: {
    name: string;
    industry: string;
    locations: string[];
    contact_info: string;
    differentiators: string;
    industry_specific: {
      // Real Estate
      property_types?: string[];
      coverage_areas?: string[];
      key_features?: string[];
      viewing_process?: string;
      price_policy?: string;
      document_requirements?: string[];
      
      // Retail/Supermarket
      operating_hours?: string;
      delivery_options?: {
        areas: string[];
        minimum_order?: number;
        delivery_fee?: number;
      };
      return_policy?: string;
      loyalty_program?: {
        enabled: boolean;
        details?: string;
      };
      bulk_order_policy?: string;
      
      // Restaurant
      menu_categories?: string[];
      dietary_options?: string[];
      reservation_policy?: string;
      delivery_radius?: number;
      catering_services?: {
        available: boolean;
        minimum_notice?: number;
        minimum_order?: number;
      };
      peak_hours?: string[];
      order_modification_policy?: string;
    };
  };
  roles: { 
    role: string; 
    priority: number;
  }[];
  communication_style: {
    tone: string;
    emoji_usage: boolean;
    response_length: string;
  };
  scenarios: { 
    name: string; 
    workflow: string;
  }[];
  knowledge_base: {
    faq_url: string;
    product_catalog: string;
    industry_resources: {
      name: string;
      url: string;
      type: string;
    }[];
  };
  compliance_rules: {
    gdpr_disclaimer: string;
    forbidden_words: string[];
    industry_regulations: {
      name: string;
      description: string;
      required_disclaimers?: string[];
    }[];
  };
}

// Function to generate industry-specific structure
const generateIndustryStructure = async (industry: string): Promise<any> => {
  try {
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an AI expert in business operations. Generate a minimal set of essential information points for a WhatsApp AI agent. Focus only on the most important aspects that customers typically ask about.`
          },
          {
            role: "user",
            content: `Generate a simple JSON structure for a ${industry} business with only the most essential fields:
            {
              "data_fields": { top 3 most important fields only },
              "customer_queries": [ top 3 most common questions ],
              "operations": { top 2 key operations },
              "compliance": [ only if legally required ]
            }`
          }
        ],
        temperature: 0.7
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        }
      }
    );

    return JSON.parse(response.data.choices[0].message.content);
  } catch (error) {
    console.error('Error generating industry structure:', error);
    return null;
  }
};

const AgentSetupPage = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-message',
      text: "👋 Hi! This is a test version of the DenoteAI WhatsApp Bot Configurator. Just type anything and hit send to complete the setup with test data for a real estate business. No need to answer any questions!",
      sender: 'bot',
      timestamp: new Date()
    }
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const userUID = getCurrentUser() || 'test_user_123';
  const navigate = useNavigate();
  const location = useLocation();
  
  // Track industry structure
  const [industryStructure, setIndustryStructure] = useState<any>(null);
  const [embeddingsAvailable, setEmbeddingsAvailable] = useState<boolean | null>(null);

  // Track conversation state for OpenAI
  const [conversationHistory, setConversationHistory] = useState<{role: string, content: string}[]>([
    {
      role: "system", 
      content: `You are an AI assistant specialized in configuring WhatsApp messaging bots for businesses. Your goal is to gather information that will optimize how the bot behaves and responds to customers.

      IMPORTANT GUIDELINES:
      - Adapt your questions based on the business type provided (e.g., real estate, retail, restaurant)
      - Once you know the business type, ask ONLY industry-specific questions relevant to that business
      - Never ask generic questions that could apply to any business after learning their industry
      - Focus on questions that directly impact messaging capabilities and customer experience
      - Prioritize questions about communication style, customer handling, and common scenarios
      - Be efficient - don't ask for information that isn't relevant to messaging behavior
      - Ask 1-2 focused questions per message
      - If the user has already provided information, don't ask for it again
      
      CONTEXT AWARENESS:
      - For real estate: Focus on property types, viewing processes, document requirements
      - For retail: Focus on product availability, returns, delivery options
      - For restaurants: Focus on reservations, menu options, delivery radius
      - For other industries: Adapt questions to be specifically relevant to that industry
      
      PRIORITIZE THESE CATEGORIES OF QUESTIONS:
      
      1. Customer Interaction Style:
         - Preferred tone (formal, casual, friendly, professional)
         - Response length (concise, detailed)
         - Use of emojis or multimedia
         - Personalization level
         - Languages supported
      
      2. Common Customer Scenarios:
         - Frequently asked questions and ideal responses
         - How to handle complaints or difficult customers
         - Booking/appointment processes
         - Sales inquiries handling
         - After-hours communication policy
      
      3. Business-Specific Automation:
         - Key information that should be provided automatically
         - When to escalate to a human agent
         - Qualification questions for leads
         - Follow-up timing and frequency
         - Integration with business processes
      
      4. Compliance & Boundaries:
         - Topics the bot should avoid
         - Required disclaimers or legal text
         - Privacy handling procedures
         - Information collection limitations
      
      After collecting sufficient information to configure an effective messaging bot, indicate that setup is complete with the text "SETUP_COMPLETE" followed by a JSON object containing all the collected information in this format:
      {
        "company_info": {
          "name": "",
          "industry": "",
          "website": "",
          "locations": [],
          "contact_info": ""
        },
        "services": {
          "main_offerings": [],
          "special_features": []
        },
        "communication_style": {
          "tone": "",
          "languages": [],
          "emoji_usage": false,
          "response_length": ""
        },
        "business_processes": {
          "common_questions": [],
          "special_requirements": []
        },
        "integrations": {
          "required_integrations": [],
          "automation_preferences": "",
          "lead_process": ""
        }
      }

      Start by asking for their business name and type/industry. Then immediately focus on how they want their WhatsApp bot to communicate with customers based on their specific industry.`
    },
    {
      role: "assistant", 
      content: "👋 Hi! I'm your DenoteAI WhatsApp Bot Configurator. Let's set up your messaging bot to perfectly match your business needs.\n\n1. What's your business name?\n2. What industry or business type are you in? (For example: real estate, retail, restaurant, etc.)"
    }
  ]);
  
  // Store collected information with industry-specific fields
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>({
    company_info: {
      name: '',
      industry: '',
      locations: [] as string[],
      contact_info: '',
      differentiators: '',
      industry_specific: {}
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
      product_catalog: '',
      industry_resources: []
    },
    compliance_rules: {
      gdpr_disclaimer: '',
      forbidden_words: [] as string[],
      industry_regulations: []
    }
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // If setup is complete, navigate to dashboard
  useEffect(() => {
    if (setupComplete) {
      navigate('/');
    }
  }, [setupComplete, navigate]);

  // Log user ID when component mounts
  useEffect(() => {
    console.log("AgentSetupPage - Current User UID:", userUID);
    if (!userUID) {
      console.warn("No user ID found. User may not be logged in.");
    }
  }, [userUID]);

  // Check if embeddings are available
  useEffect(() => {
    const checkEmbeddings = async () => {
      const available = await checkEmbeddingsAvailable();
      setEmbeddingsAvailable(available);
      
      if (!available) {
        toast(
          "OpenAI embeddings are not available. The app will still work, but some search features may be limited.",
          { 
            duration: 6000,
            icon: '⚠️'
          }
        );
      }
    };
    
    checkEmbeddings();
  }, []);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isLoading || !userUID) return;

    const userMessage: Message = {
      id: `user-${Date.now().toString()}`,
      text: newMessage.trim(),
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setNewMessage('');
    setIsLoading(true);

    try {
      // Skip the OpenAI call and immediately complete setup with test data
      const testData = {
        company_info: {
          name: "UpWest Real Estate",
          industry: "Real Estate",
          website: "https://upwest-realestate.com",
          locations: ["Cairo", "Alexandria", "New Cairo"],
          contact_info: "sales@upwest-realestate.com | +20 123 456 7890"
        },
        services: {
          main_offerings: ["Residential Properties", "Commercial Properties", "Property Management", "Investment Consulting"],
          special_features: ["Virtual Tours", "3D Floor Plans", "Property Valuation", "Mortgage Assistance"]
        },
        communication_style: {
          tone: "Professional yet friendly",
          languages: ["English", "Arabic"],
          emoji_usage: true,
          response_length: "Balanced - detailed for property info, concise for general inquiries"
        },
        business_processes: {
          common_questions: [
            "What properties are available in New Cairo?", 
            "How do I schedule a viewing?", 
            "What documents are required for purchase?",
            "Do you offer payment plans?",
            "What are the prices for units in UpWest Compound?"
          ],
          special_requirements: [
            "ID verification required for viewings",
            "Pre-qualification for mortgage inquiries",
            "Appointment scheduling for property tours"
          ]
        },
        integrations: {
          required_integrations: ["Calendar", "CRM", "Document Signing"],
          automation_preferences: "High automation for initial inquiries, human handoff for serious buyers",
          lead_process: "Collect contact details, property preferences, budget range, and timeline before human agent follows up"
        }
      };

      // Add a success message to the chat
      const botMessage: Message = {
        id: `bot-${Date.now().toString()}`,
        text: "Thank you for setting up your UpWest Real Estate WhatsApp AI agent! 🏢🔑\n\nYour agent is now configured to handle property inquiries, schedule viewings, and collect lead information for your team. The agent will communicate in both English and Arabic with a professional yet friendly tone.\n\nYou can now access your WhatsApp dashboard and start engaging with potential clients. Your AI agent will automatically handle initial inquiries and transfer serious buyers to your sales team.",
        sender: 'bot',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, botMessage]);
      
      // Save to Supabase
      console.log("Saving data to Supabase...");
      const saveSuccess = await saveToSupabase(userUID, testData);
      console.log("Save to Supabase result:", saveSuccess);
      
      setSetupComplete(true);
    } catch (error) {
      console.error("Error in test setup:", error);
      // Fallback message
      const botMessage: Message = {
        id: `error-${Date.now().toString()}`,
        text: "I'm having trouble processing your request. Please try again or contact support if the issue persists.",
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Save to Supabase
  const saveToSupabase = async (uid: string, config: any) => {
    console.log('Starting Supabase save with UID:', uid);
    
    if (!uid) {
      console.error('No UID provided to save function');
      return false;
    }
    
    try {
      // Save configuration to Supabase (now just stores temperature and max_tokens)
      // Determine values based on the config
      const saveResult = await saveUserConfig(uid, config);
      
      if (!saveResult) {
        console.error('Failed to save configuration to Supabase');
        return false;
      }
      
      console.log('Successfully saved config to Supabase');
      
      // Save the full configuration to localStorage to avoid repeated setup prompts
      localStorage.setItem(`user_${uid}_config`, JSON.stringify(config));
      console.log('Saved full config to localStorage');
      
      // Only attempt to create embeddings if they're available
      if (embeddingsAvailable) {
        try {
          // Create embeddings for different sections with metadata
          // Company info embeddings
          await createEmbeddings(
            uid, 
            JSON.stringify(config.company_info), 
            'company_info',
            { section: 'company_info', type: 'configuration' }
          );
          
          // Services embeddings
          await createEmbeddings(
            uid,
            JSON.stringify(config.services),
            'services',
            { section: 'services', type: 'configuration' }
          );
          
          // Communication style embeddings
          await createEmbeddings(
            uid,
            JSON.stringify(config.communication_style),
            'communication_style',
            { section: 'communication_style', type: 'configuration' }
          );
          
          // Business processes embeddings
          await createEmbeddings(
            uid,
            JSON.stringify(config.business_processes),
            'business_processes',
            { section: 'business_processes', type: 'configuration' }
          );
          
          // Complete config embeddings
          await createEmbeddings(
            uid,
            JSON.stringify(config),
            'complete_config',
            { section: 'complete', type: 'configuration' }
          );
          
          console.log('Successfully created embeddings');
        } catch (embeddingError) {
          console.error('Error creating embeddings:', embeddingError);
          // Continue anyway, as embeddings are not critical for core functionality
        }
      } else {
        console.warn('Skipping embeddings creation as they are not available');
      }
      
      return true;
    } catch (error) {
      console.error('Error in Supabase save function:', error);
      return false;
    }
  };

  const handleContinueToDashboard = () => {
    navigate('/');
  };

  const handleSetupGoogleSheets = () => {
    navigate('/google-sheets');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <NavSidebar />
      <div className="flex-1 ml-20 p-6 overflow-y-auto">
        <div className="container mx-auto max-w-5xl bg-white rounded-lg shadow-sm p-6">
          <h1 className="text-2xl font-bold mb-6">WhatsApp Agent Setup</h1>
          
          {setupComplete ? (
            <div className="text-center py-8">
              <div className="mb-4 flex flex-col items-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-gray-800 mb-2">Setup Complete!</h2>
                <p className="text-gray-600 mb-6">Your WhatsApp agent is now configured and ready to use.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-blue-50 p-6 rounded-lg border border-blue-100">
                  <h3 className="text-lg font-semibold mb-2">Dashboard</h3>
                  <p className="text-gray-600 mb-4">View your agent stats, performance metrics, and manage your WhatsApp conversations.</p>
                  <button
                    onClick={handleContinueToDashboard}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded transition-colors duration-300"
                  >
                    Go to Dashboard
                  </button>
                </div>
                
                <div className="bg-purple-50 p-6 rounded-lg border border-purple-100">
                  <h3 className="text-lg font-semibold mb-2">Google Sheets Integration</h3>
                  <p className="text-gray-600 mb-4">Connect Google Sheets to collect and organize data from your WhatsApp conversations.</p>
                  <button
                    onClick={handleSetupGoogleSheets}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded transition-colors duration-300"
                  >
                    Set up Google Sheets
                  </button>
                </div>
              </div>
              
              <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-100 text-left">
                <div className="flex items-start">
                  <AlertTriangle className="h-6 w-6 text-yellow-600 mr-3 mt-1" />
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Data Collection Tips</h3>
                    <p className="text-gray-600 mb-3">
                      With Google Sheets integration, you can automatically:
                    </p>
                    <ul className="list-disc pl-5 text-gray-600 space-y-1">
                      <li>Extract customer information from conversations</li>
                      <li>Organize leads and inquiries in spreadsheets</li>
                      <li>Track important metrics from WhatsApp interactions</li>
                      <li>Customize which data points to collect</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ) : (
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
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentSetupPage; 