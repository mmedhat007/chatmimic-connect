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
import { SheetConfig, SheetColumn, getUserSheets, createSheet, saveSheetConfig, getAllSheetConfigs } from '../services/googleSheets';
import { startWhatsAppGoogleSheetsIntegration } from '../services/whatsappGoogleIntegration';
import { auth } from '../services/firebase';

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
  const [isGoogleAuthorized, setIsGoogleAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  
  // New configuration state
  const [newConfig, setNewConfig] = useState<SheetConfig>({
    name: 'Customer Data',
    description: 'Automatically extract customer information from WhatsApp messages',
    sheetId: '',
    columns: [...DEFAULT_COLUMN_TEMPLATES],
    active: true,
    lastUpdated: Date.now()
  });

  // Check if Google Sheets is connected and fetch sheets
  useEffect(() => {
    const checkConnection = async () => {
      setLoading(true);
      try {
        // Fetch user's Google Sheets
        const sheets = await getUserSheets();
        setUserSheets(sheets);
        setIsConnected(sheets.length > 0);
        
        // Fetch saved configurations
        const configs = await getAllSheetConfigs();
        setSavedConfigs(configs);
        
        if (configs.length > 0) {
          setActiveConfig(configs[0]);
        }
      } catch (error) {
        console.error('Error checking Google Sheets connection:', error);
        setIsConnected(false);
      } finally {
        setLoading(false);
      }
    };

    checkConnection();
  }, []);

  // Start the integration when component mounts
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    
    const startIntegration = async () => {
      try {
        const unsubscribe = await startWhatsAppGoogleSheetsIntegration();
        cleanup = unsubscribe;
      } catch (error) {
        console.error('Error starting Google Sheets integration:', error);
      }
    };
    
    if (isConnected && savedConfigs.some(config => config.active)) {
      startIntegration();
    }
    
    return () => {
      if (cleanup) cleanup();
    };
  }, [isConnected, savedConfigs]);

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
  };

  const handleEditConfig = (config: SheetConfig) => {
    setActiveConfig(config);
    setNewConfig({ ...config });
    setIsEditing(true);
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    
    try {
      // Create/update the sheet
      const updatedConfig = await createSheet(newConfig);
      
      // Save the configuration
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
      
      // Restart the integration to apply changes
      const unsubscribe = await startWhatsAppGoogleSheetsIntegration();
      
      // No need to store the unsubscribe function as the component's cleanup will take care of it
    } catch (error) {
      console.error('Error saving Google Sheets configuration:', error);
      toast.error('Failed to save Google Sheets configuration');
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
        updatedColumns[index].aiPrompt = 'Automatically add the current timestamp';
        break;
      default:
        updatedColumns[index].aiPrompt = 'Extract this information from the message';
    }
    
    setNewConfig({
      ...newConfig,
      columns: updatedColumns
    });
  };

  // Function to handle Google authorization
  const handleGoogleAuth = async () => {
    if (isGoogleAuthorized) {
      try {
        // Placeholder for revoking auth
        setIsGoogleAuthorized(false);
        toast.success('Google Sheets disconnected');
      } catch (error) {
        console.error('Error revoking Google auth:', error);
        toast.error('Failed to disconnect Google Sheets');
      }
    } else {
      setAuthLoading(true);
      try {
        // Redirect to Google OAuth flow
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=${GOOGLE_CLIENT_ID}` +
          `&redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI)}` +
          `&response_type=code` +
          `&scope=${encodeURIComponent(GOOGLE_SCOPES)}` +
          `&access_type=offline` +
          `&prompt=consent`;

        window.location.href = authUrl;
      } catch (error) {
        console.error('Error authorizing Google Sheets:', error);
        toast.error('Failed to connect Google Sheets');
        setAuthLoading(false);
      }
    }
  };

  if (loading) {
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
          disabled={authLoading}
          className={isGoogleAuthorized ? "border-green-500 text-green-700 hover:bg-green-50" : ""}
        >
          {authLoading ? (
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
    </div>
  );
};

export default GoogleSheetsConfig; 