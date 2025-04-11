import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { PlusCircle, Trash2, Save, RefreshCw, FileSpreadsheet, LogOut } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { 
  SheetConfig, 
  SheetColumn, 
  getUserSheets, 
  createSheet, 
  saveSheetConfig, 
  getAllSheetConfigs,
  getGoogleAuthStatus,
  authorizeGoogleSheets,
  revokeGoogleAuth,
  testGoogleSheetsConnection
} from '../services/googleSheets';
import { auth } from '../services/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
// Import ReactTags and its CSS
import { WithContext as ReactTags, Tag } from 'react-tag-input';
import './ReactTags.css'; // We'll create this file for styling

// Constants for Google OAuth
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const GOOGLE_REDIRECT_URI = `${window.location.origin}/google-callback`;
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file';

// Default column templates that users can select from
const DEFAULT_COLUMN_TEMPLATES: SheetColumn[] = [
  {
    id: 'name',
    name: 'Customer Name',
    description: 'The name of the person sending the message',
    type: 'name',
    aiPrompt: 'Extract any names mentioned in the message'
  },
  {
    id: 'phone',
    name: 'Phone Number',
    description: 'The WhatsApp phone number of the sender',
    type: 'text',
    aiPrompt: 'Get the phone number of the sender'
  },
  {
    id: 'product',
    name: 'Product Interest',
    description: 'Any products or services mentioned in the message',
    type: 'product',
    aiPrompt: 'Extract any product or service names mentioned in the message'
  },
  {
    id: 'inquiry',
    name: 'Customer Inquiry',
    description: 'The main question or request from the customer',
    type: 'inquiry',
    aiPrompt: 'Extract the main question or request from the message'
  },
  {
    id: 'timestamp',
    name: 'Timestamp',
    description: 'When the message was received',
    type: 'date',
    aiPrompt: 'Automatically add the current timestamp'
  }
];

const GoogleSheetsConfig: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [userSheets, setUserSheets] = useState<{id: string, name: string}[]>([]);
  const [savedConfigs, setSavedConfigs] = useState<SheetConfig[]>([]);
  const [activeConfig, setActiveConfig] = useState<SheetConfig | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authStatusLoading, setAuthStatusLoading] = useState(true);
  const [isGoogleAuthorized, setIsGoogleAuthorized] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  
  // New configuration state
  const [newConfig, setNewConfig] = useState<SheetConfig>({
    name: 'Customer Data',
    description: 'Automatically extract customer information from WhatsApp messages',
    sheetId: '',
    columns: [...DEFAULT_COLUMN_TEMPLATES],
    active: true,
    lastUpdated: Date.now()
  });

  // State for trigger and update settings
  const [addTrigger, setAddTrigger] = useState<'first_message' | 'Interest Detected' | 'manual'>('first_message');
  const [autoUpdateFields, setAutoUpdateFields] = useState(true);
  // Use the imported Tag type for the state
  const [interestKeywordsTags, setInterestKeywordsTags] = useState<Tag[]>([]); 

  // Effect to listen for Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('[Auth Listener] State changed, user:', user ? user.uid : null);
      setAuthUser(user);
      setAuthStatusLoading(false);
    });
    return () => unsubscribe(); 
  }, []);

  // Effect to load Google Sheets data *after* auth state is confirmed
  useEffect(() => {
    const loadInitialData = async () => {
      if (authStatusLoading || !authUser) {
        console.log('[Data Load] Skipping data load: Auth loading or no user.');
        if (!authStatusLoading && !authUser) {
          setLoading(false);
        }
        return;
      }
      
      console.log('[Data Load] Auth ready, proceeding with data load for user:', authUser.uid);
      setLoading(true);

      try {
        // Fetch Google-specific auth status (needed for UI, separate from Firebase auth)
        const isGoogleLinked = await getGoogleAuthStatus(); 
        setIsGoogleAuthorized(isGoogleLinked);
        
        // Start non-dependent calls in parallel
        const connectionTestPromise = testGoogleSheetsConnection();
        const savedConfigsPromise = getAllSheetConfigs();

        // Wait for parallel calls to complete
        const [isBackendConnected, configs] = await Promise.all([
          connectionTestPromise,
          savedConfigsPromise
        ]);

        // Add explicit logging for the connection test result
        console.log(`[GoogleSheetsConfig] Backend connection test result: ${isBackendConnected}`);

        // Update state based on results
        setIsConnected(isBackendConnected); // Connection status from backend test
        setSavedConfigs(configs);

        if (configs.length > 0 && !activeConfig) { 
          setActiveConfig(configs[0]);
        }

        // Fetch user sheets list ONLY if the backend says we are connected
        if (isBackendConnected) { 
          try {
            const sheets = await getUserSheets(); 
            setUserSheets(sheets);
          } catch (sheetError) {
             console.error('Error fetching user sheets list:', sheetError);
             toast.error('Could not fetch list of your Google Sheets. Please try reconnecting.');
             setUserSheets([]);
          }
        } else {
           setUserSheets([]);
        }

      } catch (error) {
        console.error('Error loading initial Google Sheets data:', error);
        toast.error('Failed to load Google Sheets configuration data.');
        setIsConnected(false); // Ensure disconnected state on general error
        setIsGoogleAuthorized(false);
        setUserSheets([]);
        setSavedConfigs([]);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [authUser, authStatusLoading]);

  const handleCreateNewConfig = () => {
    setActiveConfig(null);
    setIsEditing(true);
    setNewConfig({
      name: 'Customer Data',
      description: 'Automatically extract customer information from WhatsApp messages',
      sheetId: userSheets.length > 0 ? userSheets[0].id : '',
      columns: [...DEFAULT_COLUMN_TEMPLATES],
      active: true,
      lastUpdated: Date.now()
    });
    setAddTrigger('first_message');
    setAutoUpdateFields(true);
    // Reset tags state
    setInterestKeywordsTags([]); 
  };

  const handleEditConfig = (config: SheetConfig) => {
    setActiveConfig(config);
    setNewConfig({ ...config });
    setAddTrigger(config.addTrigger as 'first_message' | 'Interest Detected' | 'manual' || 'first_message');
    setAutoUpdateFields(config.autoUpdateFields !== undefined ? config.autoUpdateFields : true);
    // Convert string[] from config to Tag[] for the component state
    // Explicitly add className to satisfy the Tag type
    const initialTags: Tag[] = (config.interestKeywords || []).map((text, index) => ({
       id: String(index), 
       text: text,
       className: undefined // Add className explicitly
    }));
    setInterestKeywordsTags(initialTags);
    setIsEditing(true);
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    
    try {
      // Convert Tag[] back to string[] for saving
      const keywordsToSave = interestKeywordsTags.map(tag => tag.text);

      const updatedConfig: SheetConfig = {
        ...newConfig,
        addTrigger,
        autoUpdateFields,
        // Save the string array
        interestKeywords: addTrigger === 'Interest Detected' ? keywordsToSave : [], 
        columns: newConfig.columns.map(col => ({
          ...col,
        }))
      };
      
      // Create/update the sheet (if this implies header creation etc.)
      // const configWithSheet = await createSheet(updatedConfig);
      // If createSheet ONLY creates headers, it might still be needed.
      // For now, assume saving config just updates Firestore.
      
      // Save the configuration to Firestore via backend API
      const savedConfig = await saveSheetConfig(updatedConfig);
      
      // Update local state
      const configIndex = savedConfigs.findIndex(c => c.sheetId === savedConfig.sheetId);
      if (configIndex >= 0) {
        const updated = [...savedConfigs];
        updated[configIndex] = savedConfig;
        setSavedConfigs(updated);
      } else {
        setSavedConfigs([...savedConfigs, savedConfig]);
      }
      
      setActiveConfig(savedConfig);
      setIsEditing(false);
      
      toast.success('Google Sheets configuration saved successfully');
      
      // REMOVED: No need to restart frontend listener
      // const unsubscribe = await startWhatsAppGoogleSheetsIntegration();
      
    } catch (error) {
      console.error('Error saving Google Sheets configuration:', error);
      toast.error(`Failed to save Google Sheets configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAddColumn = () => {
    const newId = `column_${Date.now()}`;
    setNewConfig({
      ...newConfig,
      columns: [
        ...newConfig.columns,
        {
          id: newId,
          name: 'New Column',
          description: 'Enter description here',
          type: 'text',
          aiPrompt: 'Extract this information from the message'
        }
      ]
    });
  };

  const handleColumnChange = (index: number, field: keyof SheetColumn, value: string) => {
    const updatedColumns = [...newConfig.columns];
    updatedColumns[index] = {
      ...updatedColumns[index],
      [field]: value
    };
    
    // If name changes, generate a new ID if it's a custom column
    if (field === 'name' && !DEFAULT_COLUMN_TEMPLATES.some(t => t.id === updatedColumns[index].id)) {
      updatedColumns[index].id = value.toLowerCase().replace(/\s+/g, '_');
    }
    
    setNewConfig({
      ...newConfig,
      columns: updatedColumns
    });
  };

  const handleRemoveColumn = (index: number) => {
    const updatedColumns = [...newConfig.columns];
    updatedColumns.splice(index, 1);
    setNewConfig({
      ...newConfig,
      columns: updatedColumns
    });
  };

  const handleColumnTypeChange = (index: number, type: string) => {
    const updatedColumns = [...newConfig.columns];
    updatedColumns[index] = {
      ...updatedColumns[index],
      type: type as 'text' | 'date' | 'name' | 'product' | 'inquiry'
    };
    
    // Update the AI prompt based on the type
    switch (type) {
      case 'name':
        updatedColumns[index].aiPrompt = 'Extract any names mentioned in the message';
        break;
      case 'product':
        updatedColumns[index].aiPrompt = 'Extract any product or service names mentioned in the message';
        break;
      case 'inquiry':
        updatedColumns[index].aiPrompt = 'Extract the main question or request from the message';
        break;
      case 'date':
        updatedColumns[index].aiPrompt = 'Automatically add the current timestamp'; // Backend listener should handle timestamp logic
        break;
      default:
        updatedColumns[index].aiPrompt = 'Extract this information from the message';
    }
    
    setNewConfig({
      ...newConfig,
      columns: updatedColumns
    });
  };

  // --- ReactTags Handlers ---
  const handleKeywordDelete = (i: number) => {
    setInterestKeywordsTags(interestKeywordsTags.filter((_, index) => index !== i));
  };

  const handleKeywordAddition = (tag: Tag) => {
    if (!tag.text.trim() || interestKeywordsTags.some(existingTag => existingTag.text.toLowerCase() === tag.text.trim().toLowerCase())) {
      return;
    }
    // When adding, ensure the structure matches the Tag type (id, text, optional className)
    const newTag: Tag = { id: tag.text.trim(), text: tag.text.trim(), className: undefined }; 
    setInterestKeywordsTags([...interestKeywordsTags, newTag]);
  };

  const handleKeywordDrag = (tag: Tag, currPos: number, newPos: number) => {
    const newTags = [...interestKeywordsTags];
    newTags.splice(currPos, 1);
    newTags.splice(newPos, 0, tag);
    setInterestKeywordsTags(newTags);
  };
  // --- End ReactTags Handlers ---

  // Function to handle Google authorization
  const handleGoogleAuth = async () => {
    if (!authUser) {
        toast.error("Authentication state not loaded yet. Please wait.");
        return;
    }
    setAuthStatusLoading(true); // Show loading indicator during auth actions
    try {
        if (isGoogleAuthorized) { // Disconnect
           console.log('Attempting to revoke Google Auth...');
           await revokeGoogleAuth();
           setIsGoogleAuthorized(false);
           setIsConnected(false); // Assume disconnected if revoked
           setUserSheets([]);
           setActiveConfig(null); // Clear active config on disconnect
           setIsEditing(false);
           toast.success('Successfully disconnected from Google');
        } else { // Connect
           console.log('Attempting to authorize Google Sheets...');
           await authorizeGoogleSheets(); // This should trigger redirect/callback flow
           // State update will happen when component reloads after callback
           toast.loading('Redirecting to Google for authorization...');
        }
    } catch (error) {
      console.error('Error during Google Auth handling:', error);
      toast.error(`Google connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Reset state on error?
      setIsGoogleAuthorized(false);
      setIsConnected(false);
    } finally {
        setAuthStatusLoading(false);
    }
  };

  const handleTestIntegration = async () => {
    if (!authUser) {
     toast.error("Please ensure you are logged in first.");
     return;
   }
   if (!savedConfigs.some(config => config.active)) {
     toast.error('Please activate at least one sheet configuration before testing');
     return;
   }
   const activeConfigForToast = savedConfigs.find(config => config.active);
   const configName = activeConfigForToast ? activeConfigForToast.name : 'your sheet';

   const testIntegrationToastId = 'test-integration';
   toast.loading('Sending & processing test message...', { id: testIntegrationToastId });

   try {
     const testPhoneNumber = `test-${Date.now()}`;
     const testMessageId = `test-message-${Date.now()}`;
     
     // Dynamically import firestore functions to avoid making them direct dependencies if not needed
     const { doc, setDoc } = await import('firebase/firestore');
     const { db } = await import('../services/firebase');
     const userUID = authUser.uid;
     
     // Create test message document with the isTestMessage flag
     await setDoc(
       doc(db, `Whatsapp_Data/${userUID}/chats/${testPhoneNumber}/messages/${testMessageId}`),
       {
         message: 'Hello, this is a test message from ChatMimic Connect. Please extract my name (Test User) and my inquiry (Checking test functionality). My number is +10000000000. Product: Test Product.',
         timestamp: Date.now(),
         sender: 'user',
         isTestMessage: true // Flag for backend service to ignore
       }
     );
     console.log(`[Test Integration] Added test message doc ${testMessageId} for ${testPhoneNumber}`);

     // Call the frontend service function which handles the test flow via API calls
     console.log(`[Test Integration] Calling processWhatsAppMessage for ${testPhoneNumber}/${testMessageId}`);
     const { processWhatsAppMessage } = await import('../services/whatsappGoogleIntegration');
     const processingResult = await processWhatsAppMessage(testPhoneNumber, testMessageId);

     if (processingResult) {
       toast.success(`Test message processed successfully! Check sheet "${configName}".`, { id: testIntegrationToastId, duration: 6000 });
       console.log(`[Test Integration] Test processing calls initiated successfully for ${testPhoneNumber}/${testMessageId}`);
     } else {
       toast.error("Test message processing failed. Check console for details.", { id: testIntegrationToastId, duration: 5000 });
       console.error(`[Test Integration] Test processing initiated failed for ${testPhoneNumber}/${testMessageId}`);
     }

   } catch (error) {
     console.error("Error during test integration:", error);
     toast.error(`Failed to test integration: ${error instanceof Error ? error.message : 'Unknown error'}`, { id: testIntegrationToastId });
   }
 };

  if (authStatusLoading || loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-500" />
        <span className="ml-2 text-gray-500">Loading Google Sheets configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-gray-800">Google Sheets Integration</h2>
        <Button
          variant={isGoogleAuthorized ? "outline" : "default"}
          onClick={handleGoogleAuth}
          disabled={authStatusLoading}
          className={isGoogleAuthorized ? "border-green-500 text-green-700 hover:bg-green-50" : ""}
        >
          {authStatusLoading ? (
            <span className="animate-pulse">Loading...</span>
          ) : isGoogleAuthorized ? (
            <>
              <LogOut className="mr-2 h-4 w-4" />
              Disconnect Google Sheets
            </>
          ) : (
            <>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Connect Google Sheets
            </>
          )}
        </Button>
      </div>

      {!isConnected ? (
        <Card>
          <CardHeader>
            <CardTitle>Connect to Google Sheets</CardTitle>
            <CardDescription>
              Connect your Google account to enable the Google Sheets integration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Connect your Google account to automatically export customer data from WhatsApp messages to Google Sheets.
            </p>
          </CardContent>
        </Card>
      ) : isEditing ? (
        <Card>
          <CardHeader>
            <CardTitle>{activeConfig ? 'Edit Configuration' : 'Create New Configuration'}</CardTitle>
            <CardDescription>
              Configure how your WhatsApp data is exported to Google Sheets
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic configuration */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="config-name">Configuration Name</Label>
                  <Input 
                    id="config-name" 
                    value={newConfig.name} 
                    onChange={(e) => setNewConfig({...newConfig, name: e.target.value})}
                    placeholder="e.g., Customer Data" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sheet-select">Google Sheet</Label>
                  <Select 
                    value={newConfig.sheetId} 
                    onValueChange={(value) => setNewConfig({...newConfig, sheetId: value})}
                  >
                    <SelectTrigger id="sheet-select">
                      <SelectValue placeholder="Select a Google Sheet" />
                    </SelectTrigger>
                    <SelectContent>
                      {userSheets.map((sheet) => (
                        <SelectItem key={sheet.id} value={sheet.id}>
                          {sheet.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="config-description">Description</Label>
                <Textarea 
                  id="config-description" 
                  value={newConfig.description || ''} 
                  onChange={(e) => setNewConfig({...newConfig, description: e.target.value})}
                  placeholder="Describe what data this configuration collects" 
                  rows={2}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch 
                  id="active-config" 
                  checked={newConfig.active} 
                  onCheckedChange={(checked) => setNewConfig({...newConfig, active: checked})}
                />
                <Label htmlFor="active-config">Active</Label>
              </div>
            </div>

            {/* New fields for addTrigger and autoUpdateFields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                 <Label htmlFor="addTriggerSelect">When to Add/Update Row</Label>
                 <Select 
                   value={addTrigger} 
                   onValueChange={(value) => setAddTrigger(value as 'first_message' | 'Interest Detected' | 'manual')}
                 >
                   <SelectTrigger id="addTriggerSelect">
                     <SelectValue placeholder="Select when to add..." />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="first_message">On First Message</SelectItem>
                     <SelectItem value="Interest Detected">When Interest is Detected</SelectItem>
                     <SelectItem value="manual">Manually Only</SelectItem>
                   </SelectContent>
                 </Select>
                 <p className="text-sm text-muted-foreground mt-1">
                   {
                     ({
                       'first_message': 'Adds the contact only the first time they message.',
                       'Interest Detected': 'Adds/updates when AI detects buying interest (keywords recommended).',
                       'manual': 'Only adds contacts manually, no automatic processing.'
                     })[addTrigger]
                   }
                 </p>
              </div>
              {/* Auto Update Toggle */}
              <div className="flex items-center space-x-2">
                 <Switch 
                   id="autoUpdateSwitch"
                   checked={autoUpdateFields}
                   onCheckedChange={setAutoUpdateFields}
                 />
                 <Label htmlFor="autoUpdateSwitch">Auto-update fields on subsequent messages</Label>
              </div>
            </div>

            {/* Keywords Input (Conditional & Using ReactTags) */}
            {addTrigger === 'Interest Detected' && (
              <div className="react-tags-wrapper">
                <Label htmlFor="interestKeywords">Interest Keywords (Optional)</Label>
                 <ReactTags
                   tags={interestKeywordsTags}
                   handleDelete={handleKeywordDelete}
                   handleAddition={handleKeywordAddition}
                   handleDrag={handleKeywordDrag}
                   placeholder="Add keywords (e.g., price, quote)"
                   inputFieldPosition="top"
                   autocomplete
                   allowDragDrop
                   delimiters={[188, 13]} // Comma, Enter
                   classNames={{
                     tags: 'tagsContainer',
                     tagInput: 'tagInput',
                     tagInputField: 'tagInputField',
                     selected: 'selectedTags',
                     tag: 'tagItem',
                     remove: 'tagRemoveButton',
                     suggestions: 'tagSuggestions',
                     activeSuggestion: 'activeSuggestion'
                   }}
                 />
                <p className="text-sm text-muted-foreground mt-2">
                  Keywords help the AI identify messages showing buying interest. Press Enter or type a comma to add a keyword.
                </p>
              </div>
            )}

            {/* Columns configuration */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Data to Extract</h3>
                <Button variant="outline" size="sm" onClick={handleAddColumn}>
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Add Column
                </Button>
              </div>
              
              <div className="border rounded-md">
                {newConfig.columns.map((column, index) => (
                  <div 
                    key={column.id} 
                    className={`p-4 ${index !== newConfig.columns.length - 1 ? 'border-b' : ''}`}
                  >
                    <div className="grid grid-cols-12 gap-4">
                      <div className="col-span-3">
                        <Label className="mb-1 block">Column Name</Label>
                        <Input 
                          value={column.name} 
                          onChange={(e) => handleColumnChange(index, 'name', e.target.value)}
                          placeholder="e.g., Customer Name" 
                        />
                      </div>
                      <div className="col-span-3">
                        <Label className="mb-1 block">Data Type</Label>
                        <Select 
                          value={column.type} 
                          onValueChange={(value) => handleColumnTypeChange(index, value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="name">Name</SelectItem>
                            <SelectItem value="product">Product</SelectItem>
                            <SelectItem value="inquiry">Inquiry</SelectItem>
                            <SelectItem value="date">Date/Time</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-5">
                        <Label className="mb-1 block">Description</Label>
                        <Input 
                          value={column.description} 
                          onChange={(e) => handleColumnChange(index, 'description', e.target.value)}
                          placeholder="Describe what data to extract" 
                        />
                      </div>
                      <div className="col-span-1 flex items-end justify-end">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleRemoveColumn(index)}
                          disabled={newConfig.columns.length <= 1}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveConfig} disabled={saving}>
              {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Configuration
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <>
          <div className="flex justify-end mb-4">
            <Button onClick={handleCreateNewConfig}>
              <PlusCircle className="w-4 h-4 mr-2" />
              New Configuration
            </Button>
          </div>

          {savedConfigs.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No Configurations</CardTitle>
                <CardDescription>
                  You haven't created any Google Sheets configurations yet
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Create a new configuration to start exporting data from WhatsApp messages to Google Sheets automatically.
                </p>
              </CardContent>
              <CardFooter>
                <Button onClick={handleCreateNewConfig}>
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Create New Configuration
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedConfigs.map((config) => (
                <Card key={config.sheetId} className={!config.active ? 'opacity-70' : ''}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{config.name}</CardTitle>
                      {config.active && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                      )}
                    </div>
                    <CardDescription>
                      {config.description || 'Extracts data from WhatsApp messages'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-sm text-gray-500">
                        Columns: {config.columns.length}
                      </div>
                      <div className="text-sm text-gray-500">
                        Last updated: {new Date(config.lastUpdated).toLocaleString()}
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => handleEditConfig(config)}
                    >
                      Edit Configuration
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Test Integration */}
      {isGoogleAuthorized && userSheets.length > 0 && savedConfigs.some(config => config.active) && (
        <div className="mt-4 p-4 bg-blue-50 rounded-md border border-blue-100">
          <h3 className="text-sm font-medium text-blue-800 mb-2">Test Your Integration</h3>
          <p className="text-xs text-blue-600 mb-3">
            This will create a test message with sample customer data to verify your Google Sheets integration is working correctly.
            The test will follow your configuration settings for when contacts should be added and what data should be extracted.
          </p>
          <Button 
            onClick={handleTestIntegration} 
            variant="outline" 
            className="w-full border-blue-200 text-blue-700 hover:bg-blue-100"
          >
            <div className="flex items-center justify-center w-full">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Test Google Sheets Integration
            </div>
          </Button>
        </div>
      )}
    </div>
  );
};

export default GoogleSheetsConfig; 