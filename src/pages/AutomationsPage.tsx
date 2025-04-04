import { useState, useEffect } from 'react';
import { getCurrentUser } from '../services/firebase';
import NavSidebar from '../components/NavSidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { PlusCircle, Trash2, Save, RefreshCw, AlertTriangle, Brain } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getUserConfig, saveUserConfig, updateEmbeddings, checkEmbeddingsAvailable } from '../services/supabase';
import AgentBehaviorRules from '../components/AgentBehaviorRules';

// Mock functions to replace Supabase - replaced with actual Supabase functions

interface BehaviorRule {
  id: string;
  rule: string;
  description: string;
  enabled: boolean;
}

interface AgentConfig {
  id: number;
  company_info: {
    name: string;
    industry: string;
    website?: string;
    mission?: string;
    target_audience?: string;
    locations: string[];
    operating_hours?: string;
    contact_info: string;
    response_time?: string;
    differentiators: string;
  };
  services: {
    main_offerings: string[];
    pricing_info: string;
    delivery_areas: string[];
    special_features: string[];
  };
  communication_style: {
    tone: string;
    languages: string[];
    emoji_usage: boolean;
    response_length: string;
  };
  business_processes: {
    booking_process: string;
    refund_policy: string;
    common_questions: string[];
    special_requirements: string[];
  };
  integrations: {
    current_tools: string[];
    required_integrations: string[];
    automation_preferences: string;
    lead_process: string;
  };
  behavior_rules?: BehaviorRule[];
}

const AutomationsPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [embeddingsAvailable, setEmbeddingsAvailable] = useState<boolean | null>(null);
  const userUID = getCurrentUser();
  const [activeTab, setActiveTab] = useState("company");

  // Check if embeddings are available
  useEffect(() => {
    const checkEmbeddings = async () => {
      try {
        console.log('AutomationsPage: Checking embeddings availability');
        const available = await checkEmbeddingsAvailable();
        setEmbeddingsAvailable(available);
        
        if (!available) {
          console.log('AutomationsPage: Embeddings not available');
          toast.error('Unable to connect to embeddings service. Some AI features may be unavailable.');
        } else {
          console.log('AutomationsPage: Embeddings available');
        }
      } catch (error) {
        console.error('Error checking embeddings:', error);
        setEmbeddingsAvailable(false);
        toast.error('Error connecting to AI service. Please refresh and try again.');
      }
    };
    
    checkEmbeddings();
  }, []);

  useEffect(() => {
    const fetchConfig = async () => {
      if (!userUID) return;
      
      setLoading(true);
      
      try {
        // First, try to get config from localStorage
        const storedConfig = localStorage.getItem(`user_${userUID}_config`);
        let parsedConfig = null;
        
        if (storedConfig) {
          try {
            parsedConfig = JSON.parse(storedConfig);
            console.log('Retrieved config from localStorage:', parsedConfig);
          } catch (e) {
            console.error('Error parsing stored config:', e);
            // Continue to get from Supabase if localStorage parsing fails
          }
        }
        
        // If not in localStorage, get from Supabase
        if (!parsedConfig) {
          const data = await getUserConfig(userUID);
          
          if (data) {
            parsedConfig = data;
          }
        }
        
        if (parsedConfig) {
          // Transform the data if needed to match expected format
          const formattedConfig: AgentConfig = {
            id: parsedConfig.id || 0,
            company_info: parsedConfig.company_info || {
              name: '',
              industry: '',
              locations: [],
              contact_info: '',
              differentiators: '',
              website: '',
              mission: '',
              target_audience: '',
              operating_hours: '',
              response_time: ''
            },
            services: parsedConfig.services || {
              main_offerings: [],
              pricing_info: '',
              delivery_areas: [],
              special_features: []
            },
            communication_style: parsedConfig.communication_style || {
              tone: 'friendly',
              languages: ['English'],
              emoji_usage: true,
              response_length: 'medium'
            },
            business_processes: parsedConfig.business_processes || {
              booking_process: '',
              refund_policy: '',
              common_questions: [],
              special_requirements: []
            },
            integrations: parsedConfig.integrations || {
              current_tools: [],
              required_integrations: [],
              automation_preferences: '',
              lead_process: ''
            },
            behavior_rules: parsedConfig.behavior_rules || []
          };
          
          setConfig(formattedConfig);
          console.log('Formatted config for Automations page:', formattedConfig);
        } else {
          // If no config exists, create a default one
          setConfig({
            id: 0,
            company_info: {
              name: '',
              industry: '',
              website: '',
              mission: '',
              target_audience: '',
              locations: [],
              operating_hours: '',
              contact_info: '',
              response_time: '',
              differentiators: ''
            },
            services: {
              main_offerings: [],
              pricing_info: '',
              delivery_areas: [],
              special_features: []
            },
            communication_style: {
              tone: 'friendly',
              languages: ['English'],
              emoji_usage: true,
              response_length: 'medium'
            },
            business_processes: {
              booking_process: '',
              refund_policy: '',
              common_questions: [],
              special_requirements: []
            },
            integrations: {
              current_tools: [],
              required_integrations: [],
              automation_preferences: '',
              lead_process: ''
            },
            behavior_rules: []
          });
        }
      } catch (error) {
        console.error('Error fetching configuration:', error);
        // Set default config on error
        setConfig({
          id: 0,
          company_info: {
            name: '',
            industry: '',
            website: '',
            mission: '',
            target_audience: '',
            locations: [],
            operating_hours: '',
            contact_info: '',
            response_time: '',
            differentiators: ''
          },
          services: {
            main_offerings: [],
            pricing_info: '',
            delivery_areas: [],
            special_features: []
          },
          communication_style: {
            tone: 'friendly',
            languages: ['English'],
            emoji_usage: true,
            response_length: 'medium'
          },
          business_processes: {
            booking_process: '',
            refund_policy: '',
            common_questions: [],
            special_requirements: []
          },
          integrations: {
            current_tools: [],
            required_integrations: [],
            automation_preferences: '',
            lead_process: ''
          },
          behavior_rules: []
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchConfig();
  }, [userUID]);

  const handleSave = async () => {
    if (!config || !userUID) return;
    
    setSaving(true);
    
    try {
      // Save configuration to Supabase
      const saveResult = await saveUserConfig(userUID, config);
      
      if (!saveResult) {
        throw new Error('Failed to save configuration');
      }
      
      // Also save to localStorage for faster access
      localStorage.setItem(`user_${userUID}_config`, JSON.stringify(config));
      
      // Handle embeddings with multiple retry attempts
      let embeddingsSuccess = false;
      
      // Only attempt to update embeddings if they're available or we haven't checked yet
      if (embeddingsAvailable === true || embeddingsAvailable === null) {
        try {
          console.log('Attempting to update embeddings...');
          
          // First, check if embeddings are available if we haven't checked yet
          if (embeddingsAvailable === null) {
            const available = await checkEmbeddingsAvailable();
            setEmbeddingsAvailable(available);
            if (!available) {
              console.log('Embeddings service not available');
              // Don't throw - we'll continue without embeddings
            }
          }
          
          // Update embeddings for different sections with metadata
          // Company info embeddings
          await updateEmbeddings(
            userUID, 
            JSON.stringify(config.company_info), 
            'company_info'
          );
          
          // Services embeddings
          await updateEmbeddings(
            userUID,
            JSON.stringify(config.services),
            'services'
          );
          
          // Communication style embeddings
          await updateEmbeddings(
            userUID,
            JSON.stringify(config.communication_style),
            'communication_style'
          );
          
          // Business processes embeddings
          await updateEmbeddings(
            userUID,
            JSON.stringify(config.business_processes),
            'business_processes'
          );
          
          // Complete config embeddings (excluding behavior_rules)
          const configWithoutBehaviorRules = { ...config };
          delete configWithoutBehaviorRules.behavior_rules;
          await updateEmbeddings(
            userUID,
            JSON.stringify(configWithoutBehaviorRules),
            'complete_config'
          );
          
          embeddingsSuccess = true;
          console.log('Successfully updated embeddings');
        } catch (embeddingError) {
          console.error('Error updating embeddings:', embeddingError);
          // Continue anyway, as embeddings are not critical for core functionality
        }
      }
      
      toast.success(
        embeddingsSuccess 
          ? 'Agent configuration saved successfully with AI embeddings!' 
          : 'Agent configuration saved successfully!'
      );
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast.error('Failed to save agent configuration');
    } finally {
      setSaving(false);
    }
  };

  // Company Info handlers
  const updateCompanyInfo = (field: string, value: string) => {
    if (!config) return;
    
    setConfig({
      ...config,
      company_info: {
        ...config.company_info,
        [field]: value
      }
    });
  };

  const updateLocations = (locationsStr: string) => {
    if (!config) return;
    
    const locations = locationsStr.split(',').map(loc => loc.trim());
    
    setConfig({
      ...config,
      company_info: {
        ...config.company_info,
        locations
      }
    });
  };

  // Roles handlers
  const addRole = () => {
    if (!config) return;
    
    const newOfferings = [...config.services.main_offerings, ''];
    
    setConfig({
      ...config,
      services: {
        ...config.services,
        main_offerings: newOfferings
      }
    });
  };
  
  const updateRole = (index: number, value: string) => {
    if (!config) return;
    
    const newOfferings = [...config.services.main_offerings];
    newOfferings[index] = value;
    
    setConfig({
      ...config,
      services: {
        ...config.services,
        main_offerings: newOfferings
      }
    });
  };
  
  const removeRole = (index: number) => {
    if (!config) return;
    
    const newOfferings = [...config.services.main_offerings];
    newOfferings.splice(index, 1);
    
    setConfig({
      ...config,
      services: {
        ...config.services,
        main_offerings: newOfferings
      }
    });
  };
  
  // Communication style handlers
  const updateCommunicationStyle = (field: string, value: any) => {
    if (!config) return;
    
    setConfig({
      ...config,
      communication_style: {
        ...config.communication_style,
        [field]: value
      }
    });
  };
  
  // Scenarios handlers
  const addScenario = () => {
    if (!config) return;
    
    const newQuestions = [...config.business_processes.common_questions, ''];
    
    setConfig({
      ...config,
      business_processes: {
        ...config.business_processes,
        common_questions: newQuestions
      }
    });
  };
  
  const updateScenario = (index: number, value: string) => {
    if (!config) return;
    
    const newQuestions = [...config.business_processes.common_questions];
    newQuestions[index] = value;
    
    setConfig({
      ...config,
      business_processes: {
        ...config.business_processes,
        common_questions: newQuestions
      }
    });
  };
  
  const removeScenario = (index: number) => {
    if (!config) return;
    
    const newQuestions = [...config.business_processes.common_questions];
    newQuestions.splice(index, 1);
    
    setConfig({
      ...config,
      business_processes: {
        ...config.business_processes,
        common_questions: newQuestions
      }
    });
  };
  
  // Knowledge base handlers
  const updateKnowledgeBase = (field: string, value: string) => {
    if (!config) return;
    
    if (field === 'product_catalog') {
      const features = value.split('\n').filter(feature => feature.trim() !== '');
      
      setConfig({
        ...config,
        services: {
          ...config.services,
          special_features: features
        }
      });
    } else {
      setConfig({
        ...config,
        services: {
          ...config.services,
          pricing_info: value
        }
      });
    }
  };
  
  // Compliance handlers
  const updateComplianceRules = (field: string, value: string) => {
    if (!config) return;
    
    setConfig({
      ...config,
      integrations: {
        ...config.integrations,
        automation_preferences: value
      }
    });
  };
  
  const updateForbiddenWords = (forbiddenWords: string) => {
    if (!config) return;
    
    const words = forbiddenWords.split(',').map(word => word.trim());
    
    setConfig({
      ...config,
      integrations: {
        ...config.integrations,
        required_integrations: words
      }
    });
  };

  // Behavior rules handlers
  const updateBehaviorRules = (rules: BehaviorRule[]) => {
    if (!config) return;
    
    setConfig({
      ...config,
      behavior_rules: rules
    });
  };
  
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="flex flex-col items-center">
          <RefreshCw className="h-8 w-8 text-blue-500 animate-spin mb-4" />
          <p className="text-gray-700">Loading agent configuration...</p>
        </div>
      </div>
    );
  }
  
  if (!config) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="bg-red-50 p-6 rounded-lg border border-red-100 max-w-md text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-700 mb-2">Configuration Error</h2>
          <p className="text-gray-700 mb-4">
            We couldn't load your agent configuration. Please try refreshing the page or contact support.
          </p>
          <Button onClick={() => window.location.reload()}>
            Refresh Page
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex h-screen bg-gray-50">
      <NavSidebar />
      <div className="flex-1 ml-16 p-6 overflow-y-auto">
        <div className="container mx-auto max-w-6xl">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold">Agent Configuration</h1>
              <p className="text-gray-500">Customize how your AI agent interacts with customers</p>
            </div>
            {activeTab !== "behavior" && (
              <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Changes
              </Button>
            )}
          </div>
          
          <Tabs defaultValue="company" onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-3 md:grid-cols-7 mb-8">
              <TabsTrigger value="company">Company</TabsTrigger>
              <TabsTrigger value="roles">Roles</TabsTrigger>
              <TabsTrigger value="communication">Communication</TabsTrigger>
              <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
              <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
              <TabsTrigger value="compliance">Compliance</TabsTrigger>
              <TabsTrigger value="behavior">
                <span className="flex items-center gap-1">
                  <Brain className="h-4 w-4" />
                  Behavior
                </span>
              </TabsTrigger>
            </TabsList>
            
            {/* Company Info Tab */}
            <TabsContent value="company">
              <Card>
                <CardHeader>
                  <CardTitle>Company Information</CardTitle>
                  <CardDescription>
                    Basic information about your business that the AI agent will use when interacting with customers.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="company-name">Business Name</Label>
                    <Input
                      id="company-name"
                      value={config.company_info.name}
                      onChange={(e) => updateCompanyInfo('name', e.target.value)}
                      placeholder="Your business name"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="industry">Industry</Label>
                    <Input
                      id="industry"
                      value={config.company_info.industry}
                      onChange={(e) => updateCompanyInfo('industry', e.target.value)}
                      placeholder="e.g., E-commerce, Healthcare, Education"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="locations">Locations</Label>
                    <Input
                      id="locations"
                      value={config.company_info.locations.join(', ')}
                      onChange={(e) => updateLocations(e.target.value)}
                      placeholder="e.g., New York, London, Tokyo (comma separated)"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="contact-info">Contact Information</Label>
                    <Input
                      id="contact-info"
                      value={config.company_info.contact_info}
                      onChange={(e) => updateCompanyInfo('contact_info', e.target.value)}
                      placeholder="e.g., info@example.com, +1 (555) 123-4567"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="differentiators">Key Differentiators</Label>
                    <Textarea
                      id="differentiators"
                      value={config.company_info.differentiators}
                      onChange={(e) => updateCompanyInfo('differentiators', e.target.value)}
                      placeholder="What makes your business unique compared to competitors?"
                      rows={4}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Roles Tab */}
            <TabsContent value="roles">
              <Card>
                <CardHeader>
                  <CardTitle>Roles & Responsibilities</CardTitle>
                  <CardDescription>
                    Define what roles your AI agent should fulfill, in order of priority.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {config.services.main_offerings.map((offering, index) => (
                      <div key={index} className="flex items-start gap-4 p-4 border rounded-lg">
                        <div className="flex-1 space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor={`offering-${index}`}>Offering</Label>
                            <Input
                              id={`offering-${index}`}
                              value={offering}
                              onChange={(e) => updateRole(index, e.target.value)}
                              placeholder="e.g., Answer FAQs, Handle Complaints"
                            />
                          </div>
                        </div>
                        
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => removeRole(index)}
                          disabled={config.services.main_offerings.length <= 1}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    
                    <Button onClick={addRole} className="flex items-center gap-2">
                      <PlusCircle className="w-4 h-4" />
                      Add Offering
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Communication Style Tab */}
            <TabsContent value="communication">
              <Card>
                <CardHeader>
                  <CardTitle>Communication Style</CardTitle>
                  <CardDescription>
                    Define how your AI agent should communicate with customers.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="tone">Tone</Label>
                    <Select
                      value={config.communication_style.tone}
                      onValueChange={(value) => updateCommunicationStyle('tone', value)}
                    >
                      <SelectTrigger id="tone">
                        <SelectValue placeholder="Select tone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="formal">Formal</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="friendly">Friendly</SelectItem>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="emoji-usage">Use Emojis</Label>
                    <Switch
                      id="emoji-usage"
                      checked={config.communication_style.emoji_usage}
                      onCheckedChange={(checked) => updateCommunicationStyle('emoji_usage', checked)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="response-length">Response Length</Label>
                    <Select
                      value={config.communication_style.response_length}
                      onValueChange={(value) => updateCommunicationStyle('response_length', value)}
                    >
                      <SelectTrigger id="response-length">
                        <SelectValue placeholder="Select response length" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="short">Short</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="long">Long</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Scenarios Tab */}
            <TabsContent value="scenarios">
              <Card>
                <CardHeader>
                  <CardTitle>Scenario Handling</CardTitle>
                  <CardDescription>
                    Define how your AI agent should handle common scenarios.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {config.business_processes.common_questions.map((question, index) => (
                      <div key={index} className="flex items-start gap-4 p-4 border rounded-lg">
                        <div className="flex-1 space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor={`question-${index}`}>Question</Label>
                            <Input
                              id={`question-${index}`}
                              value={question}
                              onChange={(e) => updateScenario(index, e.target.value)}
                              placeholder="e.g., Handle Refund Request"
                            />
                          </div>
                        </div>
                        
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => removeScenario(index)}
                          disabled={config.business_processes.common_questions.length <= 1}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    
                    <Button onClick={addScenario} className="flex items-center gap-2">
                      <PlusCircle className="w-4 h-4" />
                      Add Question
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Knowledge Base Tab */}
            <TabsContent value="knowledge">
              <Card>
                <CardHeader>
                  <CardTitle>Knowledge Base</CardTitle>
                  <CardDescription>
                    Provide resources that your AI agent can reference when responding to customers.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="faq-url">FAQ URL</Label>
                    <Input
                      id="faq-url"
                      value={config.services.pricing_info}
                      onChange={(e) => updateKnowledgeBase('faq_url', e.target.value)}
                      placeholder="e.g., https://example.com/faq"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="product-catalog">Product Catalog</Label>
                    <Textarea
                      id="product-catalog"
                      value={config.services.special_features.join('\n')}
                      onChange={(e) => updateKnowledgeBase('product_catalog', e.target.value)}
                      placeholder="Provide information about your products or services"
                      rows={6}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Compliance Tab */}
            <TabsContent value="compliance">
              <Card>
                <CardHeader>
                  <CardTitle>Compliance & Branding Rules</CardTitle>
                  <CardDescription>
                    Define compliance requirements and branding guidelines for your AI agent.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="gdpr-disclaimer">Compliance Disclaimer</Label>
                    <Textarea
                      id="gdpr-disclaimer"
                      value={config.integrations.automation_preferences}
                      onChange={(e) => updateComplianceRules('gdpr_disclaimer', e.target.value)}
                      placeholder="e.g., GDPR compliance statement, industry regulations"
                      rows={4}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="forbidden-words">Forbidden Words/Phrases</Label>
                    <Input
                      id="forbidden-words"
                      value={config.integrations.required_integrations.join(', ')}
                      onChange={(e) => updateForbiddenWords(e.target.value)}
                      placeholder="e.g., spam, scam, guarantee (comma separated)"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Behavior Rules Tab */}
            <TabsContent value="behavior">
              <AgentBehaviorRules 
                behaviorRules={config.behavior_rules || []}
                onRulesChange={updateBehaviorRules}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default AutomationsPage; 