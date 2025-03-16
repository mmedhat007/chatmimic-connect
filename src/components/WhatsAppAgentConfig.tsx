import React, { useState, useEffect } from 'react';
import { getCurrentUser, getWhatsAppAgentConfig, updateWhatsAppAgentConfig } from '../services/firebase';
import { getWhatsAppConfig, updateWhatsAppConfig } from '../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { toast } from 'react-hot-toast';

interface WhatsAppAgentConfigProps {
  onConfigured?: () => void;
}

const WhatsAppAgentConfig: React.FC<WhatsAppAgentConfigProps> = ({ onConfigured }) => {
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [whatsappBusinessAccountId, setWhatsappBusinessAccountId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [agentEnabled, setAgentEnabled] = useState(false);
  const [executionLimit, setExecutionLimit] = useState(100);
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const userUID = getCurrentUser();

  useEffect(() => {
    const fetchConfig = async () => {
      if (!userUID) return;
      
      try {
        // Fetch WhatsApp configuration from Supabase
        const { data, error } = await getWhatsAppConfig(userUID);
        
        if (error) {
          console.error('Error fetching WhatsApp config:', error);
          toast.error('Failed to load WhatsApp configuration');
        } else if (data) {
          setPhoneNumberId(data.phone_number_id || '');
          setWhatsappBusinessAccountId(data.whatsapp_business_account_id || '');
          setAccessToken(data.access_token || '');
          setVerifyToken(data.verify_token || '');
        }
        
        // Fetch WhatsApp agent configuration from Firebase
        const agentConfig = await getWhatsAppAgentConfig(userUID);
        
        if (agentConfig) {
          setAgentEnabled(agentConfig.enabled);
          setExecutionLimit(agentConfig.limit);
        }
      } catch (error) {
        console.error('Error in fetchConfig:', error);
        toast.error('An unexpected error occurred while loading configuration');
      } finally {
        setConfigLoading(false);
      }
    };

    fetchConfig();
  }, [userUID]);

  const handleSave = async () => {
    if (!userUID) {
      toast.error('User not authenticated. Please sign in again.');
      return;
    }

    if (!phoneNumberId || !whatsappBusinessAccountId || !accessToken || !verifyToken) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);

    try {
      // Save the WhatsApp configuration to Supabase
      const { error } = await updateWhatsAppConfig(userUID, {
        phone_number_id: phoneNumberId,
        whatsapp_business_account_id: whatsappBusinessAccountId,
        access_token: accessToken,
        verify_token: verifyToken
      });

      if (error) {
        toast.error(`Failed to save WhatsApp configuration: ${error.message}`);
        setLoading(false);
        return;
      }

      // Update Firebase with agent settings
      await updateWhatsAppAgentConfig(userUID, {
        enabled: agentEnabled,
        executionLimit: executionLimit
      });
      
      toast.success('WhatsApp AI agent configuration saved successfully!');
      
      if (onConfigured) {
        onConfigured();
      }
    } catch (error) {
      console.error('Error saving WhatsApp configuration:', error);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getWebhookUrl = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/api/webhook/whatsapp`;
  };

  if (configLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>WhatsApp AI Agent Configuration</CardTitle>
          <CardDescription>Loading configuration...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>WhatsApp AI Agent Configuration</CardTitle>
        <CardDescription>Configure your WhatsApp AI agent to automatically respond to customer messages</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="agent-enabled">Enable AI Agent</Label>
              <Switch
                id="agent-enabled"
                checked={agentEnabled}
                onCheckedChange={setAgentEnabled}
              />
            </div>
            <p className="text-sm text-gray-500">
              When enabled, the AI agent will automatically respond to incoming WhatsApp messages
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="execution-limit">Monthly Execution Limit</Label>
            <Input
              id="execution-limit"
              type="number"
              value={executionLimit}
              onChange={(e) => setExecutionLimit(parseInt(e.target.value) || 0)}
              placeholder="100"
            />
            <p className="text-sm text-gray-500">
              Maximum number of AI responses per month
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone-number-id">Phone Number ID</Label>
            <Input
              id="phone-number-id"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              placeholder="Enter your WhatsApp Phone Number ID"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="business-account-id">WhatsApp Business Account ID</Label>
            <Input
              id="business-account-id"
              value={whatsappBusinessAccountId}
              onChange={(e) => setWhatsappBusinessAccountId(e.target.value)}
              placeholder="Enter your WhatsApp Business Account ID"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="access-token">Access Token</Label>
            <Input
              id="access-token"
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Enter your WhatsApp API Access Token"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="verify-token">Verify Token</Label>
            <Input
              id="verify-token"
              value={verifyToken}
              onChange={(e) => setVerifyToken(e.target.value)}
              placeholder="Enter your Webhook Verify Token"
            />
          </div>

          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <div className="flex items-center space-x-2">
              <Input
                value={getWebhookUrl()}
                readOnly
                className="bg-gray-50"
              />
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(getWebhookUrl());
                  toast.success('Webhook URL copied to clipboard');
                }}
              >
                Copy
              </Button>
            </div>
            <p className="text-sm text-gray-500">
              Use this URL in your WhatsApp Business API settings
            </p>
          </div>

          <Button
            onClick={handleSave}
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default WhatsAppAgentConfig; 