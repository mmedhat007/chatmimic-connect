import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getCurrentUser } from '../services/firebase';
import NavSidebar from '../components/NavSidebar';
import { supabase, createUserTable, createEmbeddings } from '../services/supabase';
import axios from 'axios';

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
  };
  roles: { role: string; priority: number }[];
  communication_style: {
    tone: string;
    emoji_usage: boolean;
    response_length: string;
  };
  scenarios: { name: string; workflow: string }[];
  knowledge_base: {
    faq_url: string;
    product_catalog: string;
  };
  compliance_rules: {
    gdpr_disclaimer: string;
    forbidden_words: string[];
  };
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
  const userUID = getCurrentUser() || 'test_user_123';
  const navigate = useNavigate();
  const location = useLocation();
  
  // Track conversation state for OpenAI
  const [conversationHistory, setConversationHistory] = useState<{role: string, content: string}[]>([
    {
      role: "system", 
      content: `You are a helpful AI assistant guiding a business owner through setting up their WhatsApp AI agent. 
      Your goal is to collect the following information in a conversational way:
      1. Company information (name, industry, locations, contact info, differentiators)
      2. Roles for the AI agent (e.g., answer FAQs, handle complaints)
      3. Communication style (tone, emoji usage, response length)
      4. Common scenarios the AI should handle
      5. Knowledge base resources
      6. Compliance requirements and forbidden words
      
      Start by welcoming them and asking for their business name. Be friendly but professional.
      After collecting all information, indicate that setup is complete with the text "SETUP_COMPLETE" 
      followed by a JSON object containing all the collected information in this format:
      {
        "company_info": {
          "name": "",
          "industry": "",
          "locations": [],
          "contact_info": "",
          "differentiators": ""
        },
        "roles": [{"role": "", "priority": 1}],
        "communication_style": {
          "tone": "",
          "emoji_usage": false,
          "response_length": ""
        },
        "scenarios": [{"name": "", "workflow": ""}],
        "knowledge_base": {
          "faq_url": "",
          "product_catalog": ""
        },
        "compliance_rules": {
          "gdpr_disclaimer": "",
          "forbidden_words": []
        }
      }`
    },
    {
      role: "assistant", 
      content: "👋 Hi! I'm your DenoteAI Business Assistant. I'll help you set up your WhatsApp AI agent by asking a few questions about your business. This will help me understand your needs and customize the agent to best serve your customers.\n\nLet's get started with some basic information about your company. What's your business name?"
    }
  ]);
  
  // Store collected information
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>({
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

    // Add user message to conversation history
    const updatedHistory = [
      ...conversationHistory,
      { role: "user", content: newMessage.trim() }
    ];
    setConversationHistory(updatedHistory);

    try {
      // Call OpenAI API
      const response = await axios.post(
        OPENAI_API_URL,
        {
          model: "gpt-4o-mini",
          messages: updatedHistory,
          temperature: 0.7,
          max_tokens: 1000
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
          }
        }
      );

      const botResponse = response.data.choices[0].message.content;
      
      // Update conversation history with bot's response
      setConversationHistory([
        ...updatedHistory,
        { role: "assistant", content: botResponse }
      ]);

      // Check if setup is complete
      if (botResponse.includes("SETUP_COMPLETE")) {
        console.log("Setup complete signal received from OpenAI");
        // Extract the JSON data
        const jsonMatch = botResponse.match(/SETUP_COMPLETE\s*({[\s\S]*})/);
        if (jsonMatch && jsonMatch[1]) {
          try {
            console.log("Extracted JSON data:", jsonMatch[1]);
            const extractedData = JSON.parse(jsonMatch[1]);
            setBusinessInfo(extractedData);
            
            // Save to Supabase
            console.log("Saving data to Supabase...");
            const saveSuccess = await saveToSupabase(extractedData);
            console.log("Save to Supabase result:", saveSuccess);
            
            // Add a clean version of the message (without the JSON) to the chat
            const cleanMessage = botResponse.replace(/SETUP_COMPLETE\s*({[\s\S]*})/, 
              "Thank you for providing all this information! I've saved your preferences and configured your WhatsApp AI agent. You can now access your WhatsApp dashboard and start using your AI agent. You can always update these settings later from the dashboard.");
            
            const botMessage: Message = {
              id: Date.now().toString(),
              text: cleanMessage,
              sender: 'bot',
              timestamp: new Date()
            };
            
            setMessages(prev => [...prev, botMessage]);
            setSetupComplete(true);
          } catch (error) {
            console.error("Error parsing JSON from OpenAI response:", error);
            // Handle the error gracefully
            const botMessage: Message = {
              id: Date.now().toString(),
              text: "I've collected all the information needed. Let me save your configuration now.",
              sender: 'bot',
              timestamp: new Date()
            };
            setMessages(prev => [...prev, botMessage]);
            
            // Try to save anyway with whatever data we have
            const saveSuccess = await saveToSupabase(businessInfo);
            console.log("Fallback save to Supabase result:", saveSuccess);
            setSetupComplete(true);
          }
        } else {
          console.error("Could not extract JSON data from OpenAI response");
          const botMessage: Message = {
            id: Date.now().toString(),
            text: "I've collected all the information needed, but there was an issue processing it. Let me save what I have.",
            sender: 'bot',
            timestamp: new Date()
          };
          setMessages(prev => [...prev, botMessage]);
          
          // Try to save anyway with whatever data we have
          const saveSuccess = await saveToSupabase(businessInfo);
          console.log("Fallback save to Supabase result (no JSON match):", saveSuccess);
          setSetupComplete(true);
        }
      } else {
        // Regular response
        const botMessage: Message = {
          id: Date.now().toString(),
          text: botResponse,
          sender: 'bot',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botMessage]);
      }
    } catch (error) {
      console.error("Error calling OpenAI API:", error);
      // Fallback message
      const botMessage: Message = {
        id: Date.now().toString(),
        text: "I'm having trouble processing your request. Please try again or contact support if the issue persists.",
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const saveToSupabase = async (data: BusinessInfo) => {
    try {
      console.log("Starting saveToSupabase with userUID:", userUID);
      if (!userUID) return false;

      // First, check if the user table exists and create it if it doesn't
      console.log("Checking if table exists for user:", userUID);
      const tableExists = await createUserTable(userUID);
      
      if (!tableExists) {
        console.error(`Failed to create table for user ${userUID}`);
        return false;
      }
      console.log("Table exists or was created successfully for user:", userUID);

      // Insert the data into the user's table
      console.log("Inserting data into table for user:", userUID);
      const { error: insertError } = await supabase
        .from(userUID)
        .insert([
          {
            company_info: data.company_info,
            roles: data.roles,
            communication_style: data.communication_style,
            scenarios: data.scenarios,
            knowledge_base: data.knowledge_base,
            compliance_rules: data.compliance_rules
          }
        ]);

      if (insertError) {
        // If we get a specific error about the relation not existing, log it
        if (insertError.code === '42P01') {
          console.log(`Table ${userUID} doesn't exist. Please contact support.`);
          return false;
        } else {
          console.error('Error inserting data:', insertError);
          return false;
        }
      }
      console.log("Data inserted successfully for user:", userUID);

      // Create embeddings for the knowledge base
      try {
        console.log("Creating embeddings for user:", userUID);
        await createEmbeddings(userUID, JSON.stringify(data));
        console.log("Embeddings created successfully for user:", userUID);
      } catch (embeddingsError) {
        console.error('Error creating embeddings:', embeddingsError);
        // Don't return false for this, as it's not critical
      }

      console.log("saveToSupabase completed successfully for user:", userUID);
      return true;
    } catch (error) {
      console.error('Error saving to Supabase:', error);
      return false;
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