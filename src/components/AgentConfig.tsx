import { useState, useEffect } from 'react';
import { getCurrentUser } from '../services/firebase';
import { getUserConfig, updateUserConfig } from '../services/supabase';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AgentConfig {
  id: number;
  company_info: {
    business_name: string;
    industry: string;
    locations: string[];
    differentiators: string;
  };
  roles: {
    primary_roles: string[];
    role_priority: string;
  };
  communication_style: {
    tone: string;
    emoji_usage: string;
    response_length: string;
  };
  scenarios: {
    common_scenarios: string;
    scenario_responses: string;
  };
  knowledge_base: {
    faq_url?: string;
    product_catalog?: string;
  };
  compliance_rules: {
    disclaimers?: string;
    forbidden_words?: string[];
  };
}

const AgentConfig = () => {
  const { toast } = useToast();
  const [config, setConfig] = useState<AgentConfig>({
    id: 0,
    company_info: {
      business_name: '',
      industry: '',
      locations: [],
      differentiators: ''
    },
    roles: {
      primary_roles: [],
      role_priority: ''
    },
    communication_style: {
      tone: '',
      emoji_usage: '',
      response_length: ''
    },
    scenarios: {
      common_scenarios: '',
      scenario_responses: ''
    },
    knowledge_base: {
      faq_url: '',
      product_catalog: ''
    },
    compliance_rules: {
      disclaimers: '',
      forbidden_words: []
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('company_info');
  const userUID = getCurrentUser();

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    if (!userUID) return;

    setIsLoading(true);
    try {
      const data = await getUserConfig(userUID);
      if (data) {
        setConfig({
          ...data,
          company_info: {
            ...data.company_info,
            locations: Array.isArray(data.company_info.locations) ? data.company_info.locations : [],
          },
          compliance_rules: {
            ...data.compliance_rules,
            forbidden_words: Array.isArray(data.compliance_rules?.forbidden_words) ? data.compliance_rules.forbidden_words : [],
          }
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load configuration",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!userUID || !config) return;

    setIsLoading(true);
    try {
      await updateUserConfig(userUID, config.id, config);
      toast({
        title: "Success",
        description: "Configuration saved successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save configuration",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-6 gap-4">
            <TabsTrigger value="company_info">Company Info</TabsTrigger>
            <TabsTrigger value="roles">Roles</TabsTrigger>
            <TabsTrigger value="communication">Communication</TabsTrigger>
            <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
            <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="company_info">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Business Name
                  </label>
                  <Input
                    value={config.company_info.business_name}
                    onChange={(e) => setConfig({
                      ...config,
                      company_info: {
                        ...config.company_info,
                        business_name: e.target.value
                      }
                    })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Industry
                  </label>
                  <Input
                    value={config.company_info.industry}
                    onChange={(e) => setConfig({
                      ...config,
                      company_info: {
                        ...config.company_info,
                        industry: e.target.value
                      }
                    })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Locations (comma-separated)
                  </label>
                  <Input
                    value={config.company_info.locations.join(', ')}
                    onChange={(e) => setConfig({
                      ...config,
                      company_info: {
                        ...config.company_info,
                        locations: e.target.value.split(',').map(s => s.trim())
                      }
                    })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Key Differentiators
                  </label>
                  <Textarea
                    value={config.company_info.differentiators}
                    onChange={(e) => setConfig({
                      ...config,
                      company_info: {
                        ...config.company_info,
                        differentiators: e.target.value
                      }
                    })}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="roles">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Primary Roles
                  </label>
                  <div className="space-y-2">
                    {['Answer FAQs', 'Forward Leads', 'Handle Complaints', 'Process Orders', 'Provide Support'].map((role) => (
                      <label key={role} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={config.roles.primary_roles.includes(role)}
                          onChange={(e) => {
                            const roles = e.target.checked
                              ? [...config.roles.primary_roles, role]
                              : config.roles.primary_roles.filter(r => r !== role);
                            setConfig({
                              ...config,
                              roles: {
                                ...config.roles,
                                primary_roles: roles
                              }
                            });
                          }}
                          className="w-4 h-4"
                        />
                        <span>{role}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Role Priority
                  </label>
                  <Input
                    value={config.roles.role_priority}
                    onChange={(e) => setConfig({
                      ...config,
                      roles: {
                        ...config.roles,
                        role_priority: e.target.value
                      }
                    })}
                    placeholder="e.g., 1. Support, 2. FAQs, 3. Leads"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="communication">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Tone
                  </label>
                  <Select
                    value={config.communication_style.tone}
                    onValueChange={(value) => setConfig({
                      ...config,
                      communication_style: {
                        ...config.communication_style,
                        tone: value
                      }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="formal">Formal</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Emoji Usage
                  </label>
                  <Select
                    value={config.communication_style.emoji_usage}
                    onValueChange={(value) => setConfig({
                      ...config,
                      communication_style: {
                        ...config.communication_style,
                        emoji_usage: value
                      }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="sparingly">Sparingly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Response Length
                  </label>
                  <Select
                    value={config.communication_style.response_length}
                    onValueChange={(value) => setConfig({
                      ...config,
                      communication_style: {
                        ...config.communication_style,
                        response_length: value
                      }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="concise">Concise</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="detailed">Detailed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="scenarios">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Common Scenarios
                  </label>
                  <Textarea
                    value={config.scenarios.common_scenarios}
                    onChange={(e) => setConfig({
                      ...config,
                      scenarios: {
                        ...config.scenarios,
                        common_scenarios: e.target.value
                      }
                    })}
                    placeholder="Describe common scenarios the AI should handle..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Scenario Responses
                  </label>
                  <Textarea
                    value={config.scenarios.scenario_responses}
                    onChange={(e) => setConfig({
                      ...config,
                      scenarios: {
                        ...config.scenarios,
                        scenario_responses: e.target.value
                      }
                    })}
                    placeholder="Describe how the AI should respond to these scenarios..."
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="knowledge">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    FAQ URL
                  </label>
                  <Input
                    value={config.knowledge_base.faq_url || ''}
                    onChange={(e) => setConfig({
                      ...config,
                      knowledge_base: {
                        ...config.knowledge_base,
                        faq_url: e.target.value
                      }
                    })}
                    placeholder="https://example.com/faq"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Product Catalog URL
                  </label>
                  <Input
                    value={config.knowledge_base.product_catalog || ''}
                    onChange={(e) => setConfig({
                      ...config,
                      knowledge_base: {
                        ...config.knowledge_base,
                        product_catalog: e.target.value
                      }
                    })}
                    placeholder="https://example.com/products"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="compliance">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Disclaimers
                  </label>
                  <Textarea
                    value={config.compliance_rules.disclaimers || ''}
                    onChange={(e) => setConfig({
                      ...config,
                      compliance_rules: {
                        ...config.compliance_rules,
                        disclaimers: e.target.value
                      }
                    })}
                    placeholder="Enter any required disclaimers..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Forbidden Words (comma-separated)
                  </label>
                  <Input
                    value={config.compliance_rules.forbidden_words?.join(', ') || ''}
                    onChange={(e) => setConfig({
                      ...config,
                      compliance_rules: {
                        ...config.compliance_rules,
                        forbidden_words: e.target.value.split(',').map(s => s.trim())
                      }
                    })}
                    placeholder="word1, word2, word3"
                  />
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isLoading}>
          Save Changes
        </Button>
      </div>
    </div>
  );
};

export default AgentConfig; 