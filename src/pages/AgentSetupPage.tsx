import { useState, useRef, useEffect } from 'react';
import { Send, AlertTriangle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import NavSidebar from '../components/NavSidebar';
import { apiRequest } from '../utils/api';
import { saveUserConfig, createEmbeddings, checkEmbeddingsAvailable, getUserConfig } from '../services/supabase';
import { toast } from 'react-hot-toast';
import { supabase } from '../services/supabase';
import TestResultsDisplay from '../components/TestResultsDisplay';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

interface BehaviorRule {
  id: string;
  rule: string;
  description: string;
  enabled: boolean;
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
  behavior_rules?: BehaviorRule[];
}

// Function to generate industry-specific structure
const generateIndustryStructure = async (industry: string): Promise<any> => {
  try {
    // Use apiRequest with the specific proxy path
    const response = await apiRequest('/api/proxy/openai/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        data: { 
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
        }
      })
    });

    // Access the OpenAI choice from the nested structure 
    const messageContent = response?.data?.choices?.[0]?.message?.content;
    if (!messageContent) {
      throw new Error('Invalid response structure received from proxy');
    }
    return JSON.parse(messageContent);

  } catch (error) {
    console.error('Error generating industry structure via proxy:', error);
    toast.error('Failed to generate industry-specific suggestions.');
    return null;
  }
};

// Function to verify that behavior rules were saved correctly
const verifyBehaviorRulesSave = async (uid: string) => {
  try {
    console.log('Verifying behavior rules were saved correctly...');
    
    // We need to directly query Supabase to check both columns
    const { data, error } = await supabase
      .from('user_configs')
      .select('full_config, behavior_rules')
      .eq('user_id', uid)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching saved config:', error);
      return false;
    }
    
    if (!data) {
      console.error('No data found for user:', uid);
      return false;
    }
    
    // Check if behavior_rules exists in the dedicated column
    console.log('Behavior rules from dedicated column:', data.behavior_rules);
    console.log('Number of behavior rules in dedicated column:', 
      Array.isArray(data.behavior_rules) ? data.behavior_rules.length : 'Not an array');
    
    // Check if behavior_rules exists in full_config
    if (data.full_config && data.full_config.behavior_rules) {
      console.log('Behavior rules from full_config:', data.full_config.behavior_rules);
      console.log('Number of behavior rules in full_config:', 
        Array.isArray(data.full_config.behavior_rules) ? data.full_config.behavior_rules.length : 'Not an array');
    } else {
      console.error('No behavior_rules found in full_config');
    }
    
    // Also test getUserConfig to ensure it correctly merges behavior_rules
    const configFromGet = await getUserConfig(uid);
    console.log('Config from getUserConfig:', configFromGet);
    console.log('Behavior rules from getUserConfig:', configFromGet.behavior_rules);
    
    return true;
  } catch (err) {
    console.error('Error in verification:', err);
    return false;
  }
};

const AgentSetupPage = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-message',
      text: "👋 Hi! I'm your DenoteAI WhatsApp Bot Configurator. Let's set up your messaging bot to perfectly match your business needs.\n\n1. What's your business name?\n2. What industry or business type are you in? (For example: real estate, retail, restaurant, etc.)",
      sender: 'bot',
      timestamp: new Date()
    }
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  
  // --- Authentication State --- 
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true); // Track initial auth check
  const [userUID, setUserUID] = useState<string | null>(null);
  // --------------------------

  // Track industry structure
  const [industryStructure, setIndustryStructure] = useState<any>(null);
  const [embeddingsAvailable, setEmbeddingsAvailable] = useState<boolean | null>(null);

  // Track conversation state for OpenAI
  const [conversationHistory, setConversationHistory] = useState<{role: string, content: string}[]>([
    {
      role: "system", 
      content: `You are an AI assistant specialized in configuring WhatsApp messaging bots for businesses. Your goal is to gather information that will optimize how the bot behaves and responds to customers.

      IMPORTANT GUIDELINES:
      - Begin by asking for the business name and industry/type
      - Based on the business type, ask both general and industry-specific questions
      - Ask relevant questions about how the business wants to engage with customers
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
          "locations": [],
          "contact_info": "",
          "differentiators": ""
        },
        "communication_style": {
          "tone": "",
          "languages": [],
          "emoji_usage": false,
          "response_length": ""
        },
        "scenarios": [
          {
            "name": "",
            "workflow": ""
          }
        ],
        "knowledge_base": {
          "faq_url": "",
          "product_catalog": "",
          "industry_resources": []
        },
        "compliance_rules": {
          "gdpr_disclaimer": "",
          "forbidden_words": [],
          "industry_regulations": []
        }
      }

      Start by asking for their business name and type/industry. Then ask both general and industry-specific questions to build a complete profile for their WhatsApp messaging bot.`
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
    },
    behavior_rules: []
  });

  // --- Effect for Firebase Auth --- 
  useEffect(() => {
    const auth = getAuth();
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('[AgentSetupPage Auth Listener] Auth state changed:', user ? `User UID: ${user.uid}` : 'No User');
      if (user) {
        setAuthUser(user);
        setUserUID(user.uid); 
      } else {
        setAuthUser(null);
        setUserUID(null);
        // Optional: Redirect to login if user becomes null unexpectedly
        // navigate('/login'); 
      }
      setAuthLoading(false); // Mark auth check as complete
    });

    // Cleanup listener on component unmount
    return () => unsubscribe();
  }, [navigate]); // Add navigate dependency if using it inside
  // ------------------------------

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

  // Check if embeddings are available - ONLY RUN WHEN AUTH IS READY
  useEffect(() => {
    // Wait for auth check to complete and ensure user is logged in
    if (!authLoading && authUser) {
      console.log('[AgentSetupPage] Auth ready, checking embeddings availability...');
      const checkEmbeddings = async () => {
        const available = await checkEmbeddingsAvailable();
        setEmbeddingsAvailable(available);
        
        if (!available) {
          toast(
            "OpenAI embeddings check failed or API key is missing. Some search features may be limited.",
            { 
              duration: 6000,
              icon: '⚠️'
            }
          );
        }
      };
      checkEmbeddings();
    } else if (!authLoading && !authUser) {
       console.warn('[AgentSetupPage] Cannot check embeddings: No authenticated user.');
    } else {
       console.debug('[AgentSetupPage] Waiting for auth state before checking embeddings...');
    }
  }, [authLoading, authUser]); // Rerun when auth state changes

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isLoading || !authUser || !userUID) {
       if (!authUser) toast.error('Please log in again to continue setup.');
       return;
    }

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
      const updatedHistory = [
        ...conversationHistory,
        { role: "user", content: userMessage.text }
      ];
      setConversationHistory(updatedHistory);

      // Call specific backend proxy endpoint using apiRequest
      const response = await apiRequest('/api/proxy/openai/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
           data: { 
            model: "gpt-4o-mini",
            messages: updatedHistory,
            temperature: 0.7
           }
        })
      });

      // Access the actual OpenAI response data
      const botResponse = response?.data?.choices?.[0]?.message?.content;

      if (!botResponse) {
         console.error("Invalid response structure from proxy/OpenAI:", response);
         throw new Error("Received an invalid response from the AI service.");
      }
      
      // Update conversation history with bot's response
      setConversationHistory(prev => [...prev, { role: "assistant", content: botResponse }]);

      // Check if the response includes the completion marker
      if (botResponse.includes("SETUP_COMPLETE")) {
        // Extract JSON data from the response
        try {
          const jsonStartIndex = botResponse.indexOf('{');
          const jsonEndIndex = botResponse.lastIndexOf('}');
          
          if (jsonStartIndex === -1 || jsonEndIndex === -1) {
            throw new Error("JSON data not found in response");
          }
          
          const jsonData = botResponse.substring(jsonStartIndex, jsonEndIndex + 1);
          const configData = JSON.parse(jsonData);
          
          // Update business info state
          setBusinessInfo(prev => ({
            ...prev,
            ...configData,
            behavior_rules: [
              {
                id: "rule-ask-name",
                rule: "Ask for customer name after initial inquiry",
                description: "The agent will always ask for the customer's name if they haven't provided it after their first message.",
                enabled: true
              },
              {
                id: "rule-qualify",
                rule: "Qualify leads before providing detailed information",
                description: "The agent will ask qualifying questions (budget, timeline, requirements) before sharing product/service details.",
                enabled: true
              },
              {
                id: "rule-handoff",
                rule: "Hand off to human agent after 3 messages",
                description: "The agent will suggest connecting with a human agent after 3 back-and-forth messages.",
                enabled: false
              }
            ]
          }));
          
          // Save to Supabase
          const saveSuccess = await saveToSupabase(userUID, {
            ...configData,
            behavior_rules: [
              {
                id: "rule-ask-name",
                rule: "Ask for customer name after initial inquiry",
                description: "The agent will always ask for the customer's name if they haven't provided it after their first message.",
                enabled: true
              },
              {
                id: "rule-qualify",
                rule: "Qualify leads before providing detailed information",
                description: "The agent will ask qualifying questions (budget, timeline, requirements) before sharing product/service details.",
                enabled: true
              },
              {
                id: "rule-handoff",
                rule: "Hand off to human agent after 3 messages",
                description: "The agent will suggest connecting with a human agent after 3 back-and-forth messages.",
                enabled: false
              }
            ]
          });
          
          // Verify behavior rules save
          if (saveSuccess) {
            await verifyBehaviorRulesSave(userUID);
          
            // Add a success message
            const completionMessage: Message = {
              id: `bot-completion-${Date.now().toString()}`,
              text: `✅ Great! Your WhatsApp agent setup is complete.\n\nI've saved your configuration with the following details:\n- Business: ${configData.company_info?.name || 'Your business'}\n- Industry: ${configData.company_info?.industry || 'Your industry'}\n\nYour agent is now equipped with default behavior rules:\n- Ask for customer name after initial inquiry\n- Qualify leads before providing detailed information\n\nYou can customize these rules and more in the Automations page.`,
              sender: 'bot',
              timestamp: new Date()
            };
            
            setMessages(prev => [...prev, completionMessage]);
            
            // Allow user to see completion message before redirection
            setTimeout(() => {
              setSetupComplete(true);
            }, 3000);
            
            setIsLoading(false);
            return;
          }
        } catch (jsonError) {
          console.error("Error parsing JSON from OpenAI response:", jsonError);
          // Continue with normal response if JSON parsing fails
        }
      }

      // Add the bot's response as a message
      const botMessage: Message = {
        id: `bot-${Date.now().toString()}`,
        text: botResponse,
        sender: 'bot',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error("Error processing message:", error);
      
      const errorMessageText = error instanceof Error ? error.message : "Sorry, I encountered an error. Please try again or contact support.";
      // Add an error message
      const errorMessage: Message = {
        id: `error-${Date.now().toString()}`,
        text: errorMessageText,
        sender: 'bot',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Save to Supabase - Ensure UID is passed correctly
  const saveToSupabase = async (uid: string, config: any) => {
    console.log('Starting Supabase save with provided UID:', uid);
    
    if (!uid) {
      console.error('No UID provided to save function');
      toast.error('User ID missing, cannot save configuration.');
      return false;
    }
    
    try {
      // Log the behavior rules being saved
      console.log('Behavior rules being saved:', config.behavior_rules);
      console.log('Number of behavior rules:', config.behavior_rules?.length || 0);
      
      // Save configuration to Supabase (now includes behavior_rules in dedicated column)
      const saveResult = await saveUserConfig(uid, config);
      
      if (!saveResult) {
        console.error('Failed to save configuration to Supabase');
        return false;
      }
      
      console.log('Successfully saved config to Supabase with behavior_rules in both full_config and dedicated column');
      
      // Save the full configuration to localStorage to avoid repeated setup prompts
      localStorage.setItem(`user_${uid}_config`, JSON.stringify(config));
      console.log('Saved full config to localStorage');
      
      // The check for authUser happens before calling createEmbeddings
      // Check embeddingsAvailable state (which depends on the auth-guarded useEffect)
      if (embeddingsAvailable && authUser) { // Check authUser again just in case
         console.log('[AgentSetupPage] Auth confirmed, proceeding with embeddings creation...');
         try {
            // Pass the confirmed uid to createEmbeddings
            // apiRequest inside createEmbeddings will use the latest token
            await createEmbeddings(
               uid, // Use the passed UID
               JSON.stringify(config.company_info), 
               'company_info',
               { section: 'company_info', type: 'configuration' }
             );
            
            await createEmbeddings(
              uid,
              JSON.stringify(config.services),
              'services',
              { section: 'services', type: 'configuration' }
            );
            
            await createEmbeddings(
              uid,
              JSON.stringify(config.communication_style),
              'communication_style',
              { section: 'communication_style', type: 'configuration' }
            );
            
            await createEmbeddings(
              uid,
              JSON.stringify(config.business_processes),
              'business_processes',
              { section: 'business_processes', type: 'configuration' }
            );
            
            if (config.behavior_rules && config.behavior_rules.length > 0) {
              console.log('Creating embeddings for behavior rules:', config.behavior_rules);
              await createEmbeddings(
                uid,
                JSON.stringify(config.behavior_rules),
                'behavior_rules',
                { section: 'behavior_rules', type: 'configuration' }
              );
            }
            
            await createEmbeddings(
              uid,
              JSON.stringify(config),
              'complete_config',
              { section: 'complete', type: 'configuration' }
            );
            
            console.log('Successfully created embeddings');
          } catch (embeddingError) {
             console.error('Error creating embeddings:', embeddingError);
             toast.error('Failed to save embeddings. Configuration saved without embeddings.');
          }
      } else {
         console.warn('[AgentSetupPage] Skipping embeddings creation: Embeddings not available or user not authenticated.');
      }
       
      return true;
    } catch (error) {
       console.error('Error in Supabase save function:', error);
       toast.error('Failed to save configuration.');
       return false;
    }
  };

  const handleContinueToDashboard = () => {
    navigate('/');
  };

  const handleSetupGoogleSheets = () => {
    navigate('/google-sheets');
  };

  // --- Render Logic --- 
  // Optional: Show loading state while auth is checked
  if (authLoading) {
     return (
         <div className="flex h-screen items-center justify-center">
             <p>Loading authentication...</p>
             {/* Or a spinner component */}
         </div>
     );
  }
  
  // Optional: Show message if user is not logged in
  if (!authUser) {
     return (
         <div className="flex h-screen items-center justify-center">
             <p>Authentication required. Please <a href="/login" className="underline">log in</a>.</p>
         </div>
     );
  }

  // Main component return JSX
  return (
    <div className="flex h-screen bg-gray-50">
      <NavSidebar />
      <div className="flex-1 ml-16 p-6 overflow-y-auto">
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
              
              {/* Display test results */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">Test Results</h3>
                <TestResultsDisplay />
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