import { useState, useEffect, useCallback } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth'; // Import necessary Firebase auth types
// Remove getCurrentUser import as we use onAuthStateChanged
// import { getCurrentUser } from '../services/firebase'; 
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
// Corrected import: updateEmbeddings might not be needed directly here if save handles it
// import { getUserConfig, saveUserConfig, updateEmbeddings, checkEmbeddingsAvailable } from '../services/supabase';
import { getUserConfig, saveUserConfig, checkEmbeddingsAvailable, updateBehaviorRules, updateEmbeddings } from '../services/supabase';
import AgentBehaviorRules from '../components/AgentBehaviorRules';

// Assuming a logger exists - create a simple one if not
const logger = {
  // debug: (...args: any[]) => console.debug('[AutomationsPage]', ...args), // REMOVED
  // info: (...args: any[]) => console.info('[AutomationsPage]', ...args), // REMOVED
  warn: (...args: any[]) => console.warn('[AutomationsPage]', ...args),
  error: (...args: any[]) => console.error('[AutomationsPage]', ...args),
};

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

type AuthState = 'loading' | 'authenticated' | 'unauthenticated';

const AutomationsPage = () => {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true); // Renamed from loading
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [embeddingsAvailable, setEmbeddingsAvailable] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState("company");

  // --- Authentication Handling --- 
  useEffect(() => {
    const auth = getAuth();
    // logger.info REMOVED
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // logger.info REMOVED
        setCurrentUser(user);
        setAuthState('authenticated');
      } else {
        // logger.info REMOVED
        setCurrentUser(null);
        setAuthState('unauthenticated');
        setLoadingConfig(false); // No config to load if not authenticated
        setConfig(null); // Clear config if user logs out
      }
    });

    // Cleanup subscription on unmount
    return () => {
       // logger.info REMOVED
       unsubscribe();
    }
  }, []);

  // --- Effect to check embeddings *after* authentication --- 
  useEffect(() => {
    const checkEmbeddings = async () => {
      // logger.debug REMOVED
      const available = await checkEmbeddingsAvailable();
      // logger.debug REMOVED
      setEmbeddingsAvailable(available);
    };
    
    // Only run if user is authenticated
    if (authState === 'authenticated') {
       // logger.info REMOVED
       checkEmbeddings();
    } else {
       // logger.info REMOVED
    }
  }, [authState]); // Rerun when authState changes

  // Helper function to create a default config structure (Moved Before fetchConfig)
  const createDefaultConfig = useCallback((): AgentConfig => ({
    id: 0,
    company_info: { name: '', industry: '', locations: [], contact_info: '', differentiators: '' },
    services: { main_offerings: [], pricing_info: '', delivery_areas: [], special_features: [] },
    communication_style: { tone: 'friendly', languages: ['English'], emoji_usage: true, response_length: 'medium' },
    business_processes: { booking_process: '', refund_policy: '', common_questions: [], special_requirements: [] },
    integrations: { current_tools: [], required_integrations: [], automation_preferences: '', lead_process: '' },
    behavior_rules: []
  }), []);

  // --- Define fetchConfig using useCallback --- 
  const fetchConfig = useCallback(async (forceReload = false) => {
    // currentUser state is now the source of truth for the UID
    if (!currentUser) { 
      logger.warn('[Config Fetch Effect] currentUser is null, cannot fetch config.');
      setLoadingConfig(false); // Ensure loading stops if currentUser becomes null
      setConfig(null); // Clear config if currentUser becomes null
      return;
    }
    
    const userUID = currentUser.uid;
    // logger.info REMOVED
    setLoadingConfig(true);
    // Don't clear config immediately if not forcing reload, might cause flicker
    if (forceReload) {
      setConfig(null); // Clear previous config while loading new one if forced
    }
    
    try {
      const data = await getUserConfig(userUID); 
      
      if (data) {
         // logger.info REMOVED
         // Transform the data if needed to match expected format
         const formattedConfig: AgentConfig = {
           id: data.id || 0,
           company_info: data.company_info || {
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
           services: data.services || {
             main_offerings: [],
             pricing_info: '',
             delivery_areas: [],
             special_features: []
           },
           communication_style: data.communication_style || {
             tone: 'friendly',
             languages: ['English'],
             emoji_usage: true,
             response_length: 'medium'
           },
           business_processes: data.business_processes || {
             booking_process: '',
             refund_policy: '',
             common_questions: [],
             special_requirements: []
           },
           integrations: data.integrations || {
             current_tools: [],
             required_integrations: [],
             automation_preferences: '',
             lead_process: ''
           },
           // Ensure behavior_rules is an array, default to empty if null/undefined
           behavior_rules: Array.isArray(data.behavior_rules) ? data.behavior_rules : [] 
         };
         
         setConfig(formattedConfig);
         // logger.debug REMOVED
      } else {
         logger.warn('[Config Fetch Effect] No config data found for user, setting default.');
         // If no config exists, create a default one (consider a helper function)
         setConfig(createDefaultConfig()); 
      }
    } catch (error: any) {
      logger.error('[Config Fetch Effect] Error fetching configuration:', error.message || error);
      toast.error(`Failed to load configuration: ${error.message}`);
      setConfig(createDefaultConfig()); // Set default on error
    } finally {
      setLoadingConfig(false);
      // logger.info REMOVED
    }
  }, [currentUser, setLoadingConfig, setConfig, logger, getUserConfig, createDefaultConfig]); // Dependencies for useCallback

  // --- Effect to fetch configuration *after* authentication --- 
  useEffect(() => {
    // Only run fetchConfig if user is authenticated
    if (authState === 'authenticated') {
      // logger.info REMOVED
      fetchConfig(); // Call the memoized function
    } else {
       // logger.info REMOVED
       // Clear config and loading state if user logs out while page is open
       setConfig(null);
       setLoadingConfig(false);
    }
    // Depend on authState and the memoized fetchConfig function itself
  }, [authState, fetchConfig]); 

  // --- Save Handler --- 
  const handleSave = async () => {
    if (!currentUser) {
      toast.error("Authentication error. Please log in again.");
      logger.error('[Save Handler] Save attempt failed: currentUser is null.');
      return;
    }
    if (!config) {
      toast.error("Configuration data is not loaded or missing.");
      logger.error('[Save Handler] Save attempt failed: config is null.');
      return;
    }

    setSaving(true);
    // logger.info REMOVED
    
    // Create a version of the config *without* behavior_rules for saving main config
    const configToSave = { ...config };
    delete configToSave.behavior_rules;
    
    // logger.debug REMOVED

    try {
      // Save the main configuration object (excluding behavior_rules)
      const saveSuccess = await saveUserConfig(currentUser.uid, configToSave);

      if (saveSuccess) {
        // logger.info REMOVED
        toast.success('Configuration saved successfully!');

        // Sections for embedding update (EXCLUDING behavior_rules)
        const sectionsToEmbed: (keyof AgentConfig)[] = [
           'company_info', 'services', 'communication_style', 
           'business_processes', 'integrations'
          ];
          
        const embeddingUpdates = sectionsToEmbed.map(sectionName => {
            // Make sure to reference the original `config` state which includes all sections
            const sectionData = config[sectionName]; 
            const contentString = sectionData ? JSON.stringify(sectionData) : ''; 
            if (!contentString) {
               logger.warn(`[Save Handler] Skipping embedding update for empty section: ${sectionName}`);
               return Promise.resolve({ status: 'skipped' });
            }
            // logger.debug REMOVED
            // Pass the original config section data to updateEmbeddings
            return updateEmbeddings(currentUser.uid, contentString, sectionName);
        });

        const results = await Promise.allSettled(embeddingUpdates);
        
        results.forEach((result, index) => {
           const sectionName = sectionsToEmbed[index];
           if ((result.status === 'fulfilled' && (result.value as any)?.status === 'skipped') || (result.status === 'fulfilled' && result.value === true)) {
             if ((result.value as any)?.status !== 'skipped') { 
                // logger.info REMOVED
             }
           } else if (result.status === 'fulfilled' && result.value === false) {
             logger.warn(`[Save Handler] Embeddings update failed (returned false) for section: ${sectionName}`);
             toast.error(`Failed to update embeddings for ${sectionName}.`);
           } else if (result.status === 'rejected') {
             logger.error(`[Save Handler] Embeddings update threw an error for section: ${sectionName}`, result.reason);
             toast.error(`Error updating embeddings for ${sectionName}.`);
           } else {
             logger.error(`[Save Handler] Unexpected result for embedding update on section ${sectionName}:`, result);
             toast.error(`Unexpected error updating embeddings for ${sectionName}.`);
           }
         });

      } else {
        logger.error('[Save Handler] Failed to save main configuration via service (saveUserConfig returned false).');
        toast.error('Failed to save configuration. Please try again.');
      }
    } catch (error: any) {
      logger.error('[Save Handler] Error during main save process:', error.message || error);
      toast.error(`An error occurred while saving: ${error.message}`);
    } finally {
      setSaving(false);
      // logger.info REMOVED
    }
  };

  // --- Update Handlers --- 
  
  // Helper to update nested state safely
  const handleNestedChange = (section: keyof AgentConfig, field: string, value: any) => {
    setConfig(prevConfig => {
      if (!prevConfig) return null;
      // Ensure the section exists
      const currentSection = prevConfig[section] || {};
      // logger.debug REMOVED
      return {
        ...prevConfig,
        [section]: {
          ...currentSection,
          [field]: value
        }
      };
    });
  };
  
  // Specific handlers using the helper
  const updateCompanyInfo = (field: keyof AgentConfig['company_info'], value: string | string[]) => {
    handleNestedChange('company_info', field, value);
  };
  
  const updateServices = (field: keyof AgentConfig['services'], value: string | string[]) => {
     handleNestedChange('services', field, value);
  };
  
  const updateCommunicationStyle = (field: keyof AgentConfig['communication_style'], value: string | string[] | boolean) => {
    handleNestedChange('communication_style', field, value);
  };
  
  const updateBusinessProcesses = (field: keyof AgentConfig['business_processes'], value: string | string[]) => {
     handleNestedChange('business_processes', field, value);
  };
  
  const updateIntegrations = (field: keyof AgentConfig['integrations'], value: string | string[]) => {
     handleNestedChange('integrations', field, value);
  };

  // Handlers for array inputs (needs specific logic)
  const updateArrayField = (section: keyof AgentConfig, field: string, value: string) => {
    setConfig(prevConfig => {
      if (!prevConfig) return null;
      const currentSection = prevConfig[section] || {};
      // Split by newline, trim, and filter empty strings
      const updatedArray = value.split('\n').map(s => s.trim()).filter(s => s !== '');
       // logger.debug REMOVED
      return {
        ...prevConfig,
        [section]: {
          ...currentSection,
          [field]: updatedArray
        }
      };
    });
  };
  
  // Update behavior rules (passed up from AgentBehaviorRules component)
  const handleBehaviorRulesUpdate = (rules: BehaviorRule[]) => {
    // logger.debug REMOVED
    setConfig(prevConfig => prevConfig ? { ...prevConfig, behavior_rules: rules } : null);
    // Note: If immediate save/embedding update is needed for rules, add logic here.
    // Consider debouncing or explicit save button for behavior rules if updates are frequent.
  };

  // --- Render Logic --- 

  // Display loading indicators based on auth and config loading states
  if (authState === 'loading') {
    return <div className="flex justify-center items-center h-screen">Initializing authentication...</div>;
  }

  if (authState === 'unauthenticated') {
    return <div className="flex justify-center items-center h-screen">Please log in to configure automations.</div>;
  }
  
  // Only show config loading if authenticated
  if (loadingConfig) {
    return <div className="flex justify-center items-center h-screen">Loading configuration...</div>;
  }
  
  // Handle case where config failed to load even after auth
  if (!config) {
    return (
        <div className="flex flex-col justify-center items-center h-screen">
            <p className="mb-4">Failed to load configuration. Please try refreshing the page.</p>
            {/* Optional: Add a refresh button */}
            <Button onClick={() => window.location.reload()}>Refresh Page</Button>
        </div>
    ); 
  }

  // Helper to get array values as newline-separated string for Textarea
  const getArrayAsString = (arr: string[] | undefined): string => {
    return arr ? arr.join('\n') : '';
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <NavSidebar />
      <main className="flex-1 ml-16 p-6 overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-semibold text-gray-800 dark:text-white">Automations Configuration</h1>
          {/* Button Container */}
          <div className="flex items-center gap-2">
            {embeddingsAvailable === false && (
              <span className="mr-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Embeddings inactive - Save may be slow
              </span>
            )}
            {/* Reload Button */}
            <Button 
              variant="outline"
              onClick={() => fetchConfig(true)} // Force reload
              disabled={loadingConfig || saving}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loadingConfig ? 'animate-spin' : ''}`} />
              {loadingConfig ? "Loading..." : "Reload Config"}
            </Button>
            
            {/* Conditional Save Button */}
            {activeTab !== 'behavior' && (
              <Button 
                onClick={handleSave} 
                disabled={saving || loadingConfig || !config} 
                className="flex items-center gap-2"
              >
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Configuration
              </Button>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6 mb-4">
            <TabsTrigger value="company">Company Info</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="communication">Communication</TabsTrigger>
            <TabsTrigger value="processes">Processes</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            <TabsTrigger value="behavior">Behavior Rules</TabsTrigger>
          </TabsList>

          {/* Company Info Tab */}
          <TabsContent value="company">
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
                <CardDescription>Provide details about your business.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="company-name">Company Name</Label>
                    <Input id="company-name" value={config.company_info.name} onChange={(e) => updateCompanyInfo('name', e.target.value)} placeholder="Your Business Name" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="company-industry">Industry</Label>
                    <Input id="company-industry" value={config.company_info.industry} onChange={(e) => updateCompanyInfo('industry', e.target.value)} placeholder="e.g., Restaurant, Retail, SaaS" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="company-website">Website</Label>
                    <Input id="company-website" value={config.company_info.website || ''} onChange={(e) => updateCompanyInfo('website', e.target.value)} placeholder="https://yourbusiness.com" />
                  </div>
                   <div className="space-y-1">
                    <Label htmlFor="company-mission">Mission/Vision</Label>
                    <Textarea id="company-mission" value={config.company_info.mission || ''} onChange={(e) => updateCompanyInfo('mission', e.target.value)} placeholder="What is your company's core purpose?" />
                  </div>
                   <div className="space-y-1">
                    <Label htmlFor="company-audience">Target Audience</Label>
                    <Textarea id="company-audience" value={config.company_info.target_audience || ''} onChange={(e) => updateCompanyInfo('target_audience', e.target.value)} placeholder="Describe your ideal customer." />
                  </div>
                   <div className="space-y-1">
                    <Label htmlFor="company-locations">Locations (One per line)</Label>
                    <Textarea id="company-locations" value={getArrayAsString(config.company_info.locations)} onChange={(e) => updateArrayField('company_info', 'locations', e.target.value)} placeholder="123 Main St, Anytown\n456 Oak Ave, Othertown" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="company-hours">Operating Hours</Label>
                    <Input id="company-hours" value={config.company_info.operating_hours || ''} onChange={(e) => updateCompanyInfo('operating_hours', e.target.value)} placeholder="e.g., Mon-Fri 9am-5pm" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="company-contact">Contact Info</Label>
                    <Textarea id="company-contact" value={config.company_info.contact_info} onChange={(e) => updateCompanyInfo('contact_info', e.target.value)} placeholder="Phone number, email address" />
                  </div>
                   <div className="space-y-1">
                    <Label htmlFor="company-response-time">Typical Response Time</Label>
                    <Input id="company-response-time" value={config.company_info.response_time || ''} onChange={(e) => updateCompanyInfo('response_time', e.target.value)} placeholder="e.g., Within 24 hours, Immediately" />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label htmlFor="company-differentiators">Unique Selling Points</Label>
                    <Textarea id="company-differentiators" value={config.company_info.differentiators} onChange={(e) => updateCompanyInfo('differentiators', e.target.value)} placeholder="What makes your business stand out?" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Services Tab */}
          <TabsContent value="services">
             <Card>
              <CardHeader>
                <CardTitle>Products & Services</CardTitle>
                <CardDescription>Describe what you offer.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1 md:col-span-2">
                    <Label htmlFor="services-offerings">Main Offerings (One per line)</Label>
                    <Textarea id="services-offerings" value={getArrayAsString(config.services.main_offerings)} onChange={(e) => updateArrayField('services', 'main_offerings', e.target.value)} placeholder="Service 1\nProduct A\nConsulting Package" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="services-pricing">Pricing Information</Label>
                    <Textarea id="services-pricing" value={config.services.pricing_info} onChange={(e) => updateServices('pricing_info', e.target.value)} placeholder="General pricing structure, specific prices, link to pricing page" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="services-delivery">Delivery Areas (One per line)</Label>
                    <Textarea id="services-delivery" value={getArrayAsString(config.services.delivery_areas)} onChange={(e) => updateArrayField('services', 'delivery_areas', e.target.value)} placeholder="City Name\nZip Code Area\nNationwide" />
                  </div>
                   <div className="space-y-1 md:col-span-2">
                    <Label htmlFor="services-features">Special Features/Benefits (One per line)</Label>
                    <Textarea id="services-features" value={getArrayAsString(config.services.special_features)} onChange={(e) => updateArrayField('services', 'special_features', e.target.value)} placeholder="Free shipping\n24/7 support\nEco-friendly options" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Communication Tab */}
           <TabsContent value="communication">
             <Card>
              <CardHeader>
                <CardTitle>Communication Style</CardTitle>
                <CardDescription>Define how the agent should interact.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="comm-tone">Tone of Voice</Label>
                    <Select value={config.communication_style.tone} onValueChange={(value) => updateCommunicationStyle('tone', value)}>
                      <SelectTrigger id="comm-tone">
                        <SelectValue placeholder="Select tone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="friendly">Friendly & Approachable</SelectItem>
                        <SelectItem value="professional">Professional & Formal</SelectItem>
                        <SelectItem value="enthusiastic">Enthusiastic & Energetic</SelectItem>
                        <SelectItem value="calm">Calm & Reassuring</SelectItem>
                        <SelectItem value="concise">Concise & Direct</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                   <div className="space-y-1">
                    <Label htmlFor="comm-languages">Languages (Comma-separated)</Label>
                    <Input id="comm-languages" value={config.communication_style.languages.join(', ')} onChange={(e) => updateCommunicationStyle('languages', e.target.value.split(',').map(s => s.trim()).filter(s => s !== ''))} placeholder="English, Spanish" />
                  </div>
                   <div className="flex items-center space-x-2">
                      <Switch id="comm-emoji" checked={config.communication_style.emoji_usage} onCheckedChange={(checked) => updateCommunicationStyle('emoji_usage', checked)} />
                      <Label htmlFor="comm-emoji">Use Emojis Appropriately</Label>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="comm-length">Response Length</Label>
                      <Select value={config.communication_style.response_length} onValueChange={(value) => updateCommunicationStyle('response_length', value)}>
                        <SelectTrigger id="comm-length">
                          <SelectValue placeholder="Select length" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="short">Short & Concise</SelectItem>
                          <SelectItem value="medium">Medium & Informative</SelectItem>
                          <SelectItem value="long">Detailed & Comprehensive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Business Processes Tab */}
          <TabsContent value="processes">
             <Card>
              <CardHeader>
                <CardTitle>Business Processes</CardTitle>
                <CardDescription>Detail your standard operating procedures.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <Label htmlFor="proc-booking">Booking/Appointment Process</Label>
                      <Textarea id="proc-booking" value={config.business_processes.booking_process} onChange={(e) => updateBusinessProcesses('booking_process', e.target.value)} placeholder="Describe steps to book, link to booking system if applicable."
                      />
                    </div>
                     <div className="space-y-1">
                      <Label htmlFor="proc-refund">Return/Refund Policy</Label>
                      <Textarea id="proc-refund" value={config.business_processes.refund_policy} onChange={(e) => updateBusinessProcesses('refund_policy', e.target.value)} placeholder="Summarize your policy or provide a link."
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label htmlFor="proc-faq">Common Questions & Answers (One Q&A per line, format: Q: Question? A: Answer.)</Label>
                      <Textarea id="proc-faq" value={getArrayAsString(config.business_processes.common_questions)} onChange={(e) => updateArrayField('business_processes', 'common_questions', e.target.value)} placeholder="Q: What are your hours? A: We are open Mon-Fri 9am-5pm.\nQ: Do you offer discounts? A: Yes, we offer a 10% discount for first-time customers."
                        rows={5}
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label htmlFor="proc-special">Special Requirements/Instructions (One per line)</Label>
                      <Textarea id="proc-special" value={getArrayAsString(config.business_processes.special_requirements)} onChange={(e) => updateArrayField('business_processes', 'special_requirements', e.target.value)} placeholder="All new clients require a consultation first.\nInternational shipping requires extra verification."
                      />
                    </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Integrations Tab */}
          <TabsContent value="integrations">
             <Card>
              <CardHeader>
                <CardTitle>Integrations & Tools</CardTitle>
                <CardDescription>List tools and define automation preferences.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <Label htmlFor="int-current">Current Tools (One per line)</Label>
                      <Textarea id="int-current" value={getArrayAsString(config.integrations.current_tools)} onChange={(e) => updateArrayField('integrations', 'current_tools', e.target.value)} placeholder="CRM (e.g., HubSpot)\nCalendar (e.g., Google Calendar)\nPayment Processor (e.g., Stripe)"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="int-required">Required Integrations (One per line)</Label>
                      <Textarea id="int-required" value={getArrayAsString(config.integrations.required_integrations)} onChange={(e) => updateArrayField('integrations', 'required_integrations', e.target.value)} placeholder="Must integrate with our custom booking system.\nNeeds to update Google Sheets."
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="int-automation">Automation Preferences</Label>
                      <Textarea id="int-automation" value={config.integrations.automation_preferences} onChange={(e) => updateIntegrations('automation_preferences', e.target.value)} placeholder="When should the agent hand over to a human? What tasks should be fully automated?"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="int-lead">Lead Handling Process</Label>
                      <Textarea id="int-lead" value={config.integrations.lead_process} onChange={(e) => updateIntegrations('lead_process', e.target.value)} placeholder="How should new leads be qualified and routed? (e.g., add to CRM, notify sales team)"
                      />
                    </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Behavior Rules Tab */}
          <TabsContent value="behavior">
            <AgentBehaviorRules
              behaviorRules={config.behavior_rules || []}
              onRulesChange={handleBehaviorRulesUpdate}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AutomationsPage; 