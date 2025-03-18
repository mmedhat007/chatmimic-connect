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
import { PlusCircle, Trash2, Save, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getUserConfig, saveUserConfig, updateEmbeddings, checkEmbeddingsAvailable } from '../services/supabase';

// Mock functions to replace Supabase - replaced with actual Supabase functions

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
}

const AutomationsPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [embeddingsAvailable, setEmbeddingsAvailable] = useState<boolean | null>(null);
  const userUID = getCurrentUser();

  // Check if embeddings are available
  useEffect(() => {
    const checkEmbeddings = async () => {
      const available = await checkEmbeddingsAvailable();
      setEmbeddingsAvailable(available);
    };
    
    checkEmbeddings();
  }, []);

  useEffect(() => {
    const fetchConfig = async () => {
      if (!userUID) return;
      
      setLoading(true);
      
      try {
        const data = await getUserConfig(userUID);
        
        if (data) {
          setConfig(data as AgentConfig);
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
            }
          });
        }
      } catch (error) {
        console.error('Error fetching agent config:', error);
        toast.error('Failed to load agent configuration');
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [userUID]);

  const handleSave = async () => {
    if (!userUID || !config) return;
    
    setSaving(true);
    
    try {
      // Save config to Supabase (now just temperature and max_tokens)
      const success = await saveUserConfig(userUID, config);
      
      if (success) {
        // Only attempt to update embeddings if they're available
        if (embeddingsAvailable) {
          try {
            // Update embeddings for different sections with metadata
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
            
            // Complete config embeddings
            await updateEmbeddings(
              userUID,
              JSON.stringify(config),
              'complete_config'
            );
          } catch (embeddingsError) {
            console.error('Error updating embeddings:', embeddingsError);
            // Don't show an error to the user for this, as it's not critical
          }
        } else {
          console.warn('Skipping embeddings update as they are not available');
        }
        
        toast.success('Agent configuration saved successfully');
      } else {
        toast.error('Failed to save agent configuration. Please try going through the agent setup process first.');
      }
    } catch (error) {
      console.error('Error saving agent config:', error);
      toast.error('An error occurred while saving');
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

  // Communication Style handlers
  const updateCommunicationStyle = (field: string, value: string | boolean) => {
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

  // Knowledge Base handlers
  const updateKnowledgeBase = (field: string, value: string) => {
    if (!config) return;
    
    setConfig({
      ...config,
      services: {
        ...config.services,
        [field === 'faq_url' ? 'pricing_info' : 'delivery_areas']: value
      }
    });
  };

  // Compliance Rules handlers
  const updateComplianceRules = (field: string, value: string) => {
    if (!config) return;
    
    setConfig({
      ...config,
      integrations: {
        ...config.integrations,
        [field === 'gdpr_disclaimer' ? 'automation_preferences' : 'lead_process']: value
      }
    });
  };

  const updateForbiddenWords = (wordsStr: string) => {
    if (!config) return;
    
    const words = wordsStr.split(',').map(word => word.trim());
    
    setConfig({
      ...config,
      integrations: {
        ...config.integrations,
        required_integrations: words
      }
    });
  };

  if (loading) {
    return (
      <div className="flex h-screen">
        <NavSidebar />
        <div className="flex-1 ml-20 p-8 flex items-center justify-center">
          <div className="flex flex-col items-center">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="mt-4 text-gray-600">Loading agent configuration...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex h-screen">
        <NavSidebar />
        <div className="flex-1 ml-20 p-8">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">WhatsApp AI Agent Configuration</h1>
            <p className="text-red-500">Failed to load agent configuration. Please try again later.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <NavSidebar />
      <div className="flex-1 ml-20 p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">WhatsApp AI Agent Configuration</h1>
              <p className="text-gray-600 mt-2">
                Edit and customize your agent settings here
              </p>
            </div>
            <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
          
          <p className="text-gray-600 mb-4">
            Customize how your WhatsApp AI agent interacts with your customers. Changes will be applied immediately after saving.
          </p>
          
          {/* Show warning if embeddings are not available */}
          {embeddingsAvailable === false && (
            <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start">
              <AlertTriangle className="text-yellow-500 mr-3 mt-0.5" size={18} />
              <p className="text-sm text-yellow-700">
                OpenAI embeddings are not available. Your configuration will be saved, but advanced search features may be limited.
              </p>
            </div>
          )}
          
          <Tabs defaultValue="company">
            <TabsList className="mb-6">
              <TabsTrigger value="company">Company Info</TabsTrigger>
              <TabsTrigger value="roles">Roles</TabsTrigger>
              <TabsTrigger value="communication">Communication</TabsTrigger>
              <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
              <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
              <TabsTrigger value="compliance">Compliance</TabsTrigger>
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
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default AutomationsPage; 