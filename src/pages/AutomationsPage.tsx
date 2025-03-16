import { useState, useEffect } from 'react';
import { getCurrentUser } from '../services/firebase';
import { getAgentConfig, updateAgentConfig, createUserTable, createEmbeddings } from '../services/supabase';
import NavSidebar from '../components/NavSidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { PlusCircle, Trash2, Save, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import WhatsAppAgentConfig from '../components/WhatsAppAgentConfig';

interface AgentConfig {
  id: number;
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

const AutomationsPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const userUID = getCurrentUser();

  useEffect(() => {
    const fetchConfig = async () => {
      if (!userUID) return;
      
      setLoading(true);
      
      try {
        const data = await getAgentConfig(userUID);
        
        if (data) {
          setConfig(data as AgentConfig);
        } else {
          // If no config exists, create a default one
          setConfig({
            id: 0,
            company_info: {
              name: '',
              industry: '',
              locations: [],
              contact_info: '',
              differentiators: ''
            },
            roles: [{ role: 'Answer FAQs', priority: 1 }],
            communication_style: {
              tone: 'friendly',
              emoji_usage: true,
              response_length: 'medium'
            },
            scenarios: [{ name: 'General Inquiry', workflow: 'Respond with general information about the company.' }],
            knowledge_base: {
              faq_url: '',
              product_catalog: ''
            },
            compliance_rules: {
              gdpr_disclaimer: '',
              forbidden_words: []
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
      const success = await updateAgentConfig(userUID, config.id, {
        company_info: config.company_info,
        roles: config.roles,
        communication_style: config.communication_style,
        scenarios: config.scenarios,
        knowledge_base: config.knowledge_base,
        compliance_rules: config.compliance_rules
      });
      
      if (success) {
        // Create embeddings for the knowledge base
        try {
          await createEmbeddings(userUID, JSON.stringify(config));
        } catch (embeddingsError) {
          console.error('Error creating embeddings:', embeddingsError);
          // Don't show an error to the user for this, as it's not critical
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
    
    const newRole = {
      role: '',
      priority: config.roles.length + 1
    };
    
    setConfig({
      ...config,
      roles: [...config.roles, newRole]
    });
  };

  const updateRole = (index: number, field: string, value: string | number) => {
    if (!config) return;
    
    const updatedRoles = [...config.roles];
    updatedRoles[index] = {
      ...updatedRoles[index],
      [field]: value
    };
    
    setConfig({
      ...config,
      roles: updatedRoles
    });
  };

  const removeRole = (index: number) => {
    if (!config) return;
    
    const updatedRoles = config.roles.filter((_, i) => i !== index);
    // Update priorities
    const reorderedRoles = updatedRoles.map((role, i) => ({
      ...role,
      priority: i + 1
    }));
    
    setConfig({
      ...config,
      roles: reorderedRoles
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
    
    const newScenario = {
      name: '',
      workflow: ''
    };
    
    setConfig({
      ...config,
      scenarios: [...config.scenarios, newScenario]
    });
  };

  const updateScenario = (index: number, field: string, value: string) => {
    if (!config) return;
    
    const updatedScenarios = [...config.scenarios];
    updatedScenarios[index] = {
      ...updatedScenarios[index],
      [field]: value
    };
    
    setConfig({
      ...config,
      scenarios: updatedScenarios
    });
  };

  const removeScenario = (index: number) => {
    if (!config) return;
    
    const updatedScenarios = config.scenarios.filter((_, i) => i !== index);
    
    setConfig({
      ...config,
      scenarios: updatedScenarios
    });
  };

  // Knowledge Base handlers
  const updateKnowledgeBase = (field: string, value: string) => {
    if (!config) return;
    
    setConfig({
      ...config,
      knowledge_base: {
        ...config.knowledge_base,
        [field]: value
      }
    });
  };

  // Compliance Rules handlers
  const updateCompliance = (field: string, value: string) => {
    if (!config) return;
    
    if (field === 'forbidden_words') {
      const words = value.split(',').map(word => word.trim());
      
      setConfig({
        ...config,
        compliance_rules: {
          ...config.compliance_rules,
          forbidden_words: words
        }
      });
    } else {
      setConfig({
        ...config,
        compliance_rules: {
          ...config.compliance_rules,
          [field]: value
        }
      });
    }
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
        <h1 className="text-3xl font-bold mb-6">Automations</h1>
        
        <Tabs defaultValue="agent-config">
          <TabsList className="mb-6">
            <TabsTrigger value="agent-config">Agent Configuration</TabsTrigger>
            <TabsTrigger value="whatsapp-agent">WhatsApp AI Agent</TabsTrigger>
            {/* Add more tabs as needed */}
          </TabsList>
          
          <TabsContent value="agent-config">
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
              
              <p className="text-gray-600 mb-8">
                Customize how your WhatsApp AI agent interacts with your customers. Changes will be applied immediately after saving.
              </p>
              
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
                        {config.roles.map((role, index) => (
                          <div key={index} className="flex items-start gap-4 p-4 border rounded-lg">
                            <div className="flex-1 space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor={`role-${index}`}>Role Description</Label>
                                <Input
                                  id={`role-${index}`}
                                  value={role.role}
                                  onChange={(e) => updateRole(index, 'role', e.target.value)}
                                  placeholder="e.g., Answer FAQs, Handle Complaints"
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label htmlFor={`priority-${index}`}>Priority</Label>
                                <Select
                                  value={role.priority.toString()}
                                  onValueChange={(value) => updateRole(index, 'priority', parseInt(value))}
                                >
                                  <SelectTrigger id={`priority-${index}`}>
                                    <SelectValue placeholder="Select priority" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Array.from({ length: config.roles.length }, (_, i) => (
                                      <SelectItem key={i} value={(i + 1).toString()}>
                                        {i + 1}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => removeRole(index)}
                              disabled={config.roles.length <= 1}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        
                        <Button onClick={addRole} className="flex items-center gap-2">
                          <PlusCircle className="w-4 h-4" />
                          Add Role
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
                        {config.scenarios.map((scenario, index) => (
                          <div key={index} className="flex items-start gap-4 p-4 border rounded-lg">
                            <div className="flex-1 space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor={`scenario-name-${index}`}>Scenario Name</Label>
                                <Input
                                  id={`scenario-name-${index}`}
                                  value={scenario.name}
                                  onChange={(e) => updateScenario(index, 'name', e.target.value)}
                                  placeholder="e.g., Handle Refund Request"
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label htmlFor={`workflow-${index}`}>Workflow</Label>
                                <Textarea
                                  id={`workflow-${index}`}
                                  value={scenario.workflow}
                                  onChange={(e) => updateScenario(index, 'workflow', e.target.value)}
                                  placeholder="Describe how the agent should handle this scenario"
                                  rows={4}
                                />
                              </div>
                            </div>
                            
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => removeScenario(index)}
                              disabled={config.scenarios.length <= 1}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        
                        <Button onClick={addScenario} className="flex items-center gap-2">
                          <PlusCircle className="w-4 h-4" />
                          Add Scenario
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
                          value={config.knowledge_base.faq_url}
                          onChange={(e) => updateKnowledgeBase('faq_url', e.target.value)}
                          placeholder="e.g., https://example.com/faq"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="product-catalog">Product Catalog</Label>
                        <Textarea
                          id="product-catalog"
                          value={config.knowledge_base.product_catalog}
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
                          value={config.compliance_rules.gdpr_disclaimer}
                          onChange={(e) => updateCompliance('gdpr_disclaimer', e.target.value)}
                          placeholder="e.g., GDPR compliance statement, industry regulations"
                          rows={4}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="forbidden-words">Forbidden Words/Phrases</Label>
                        <Input
                          id="forbidden-words"
                          value={config.compliance_rules.forbidden_words.join(', ')}
                          onChange={(e) => updateCompliance('forbidden_words', e.target.value)}
                          placeholder="e.g., spam, scam, guarantee (comma separated)"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>
          
          <TabsContent value="whatsapp-agent">
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold">WhatsApp AI Agent</h2>
              <p className="text-gray-600">
                Configure your WhatsApp AI agent to automatically respond to customer messages using your company's knowledge base.
              </p>
              
              <WhatsAppAgentConfig />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AutomationsPage; 