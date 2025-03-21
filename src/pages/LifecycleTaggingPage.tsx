import React, { useEffect, useState } from 'react';
import LifecycleTaggingConfig from '../components/LifecycleTaggingConfig';
import { startLifecycleTaggingIntegration } from '../services/lifecycleTagging';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Loader2, ChevronRight, Tag } from 'lucide-react';
import { toast } from 'react-hot-toast';
import NavSidebar from '../components/NavSidebar';
import PageHeader from '../components/PageHeader';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from '../components/ui/breadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

const LifecycleTaggingPage: React.FC = () => {
  const [isIntegrationRunning, setIsIntegrationRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if integration is already running
    // This is a placeholder - in a real implementation, you would need to
    // store the integration status in the user's document
    setLoading(false);
  }, []);

  const handleToggleIntegration = async () => {
    try {
      if (!isIntegrationRunning) {
        // Start the integration
        await startLifecycleTaggingIntegration();
        toast.success('Lifecycle tagging integration started successfully');
        setIsIntegrationRunning(true);
      } else {
        // In a real implementation, you would need a way to stop the integration
        toast.success('Lifecycle tagging integration stopped');
        setIsIntegrationRunning(false);
      }
    } catch (error) {
      console.error('Error toggling integration:', error);
      toast.error('Failed to toggle lifecycle tagging integration');
    }
  };

  return (
    <div className="h-screen flex bg-gray-50">
      <NavSidebar />
      <div className="flex-1 ml-16 overflow-auto">
        <div className="container mx-auto p-6 space-y-8">
          {/* Page Header */}
          <PageHeader
            title="Lifecycle Tagging"
            description="Automatically tag contacts based on message content"
            icon={<Tag className="h-6 w-6" />}
          />

          {/* Breadcrumbs */}
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <ChevronRight className="h-4 w-4" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbLink>Lifecycle Tagging</BreadcrumbLink>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Overview */}
          <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-100 mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5 text-purple-600" />
                <span>Automate your lead categorization</span>
              </CardTitle>
              <CardDescription>
                Automatically categorize leads based on keywords in their conversations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                The Lifecycle Tagging feature automatically updates a contact's lifecycle stage based on keywords in their messages.
                Define your own rules to identify leads at different stages, such as interested prospects, hot leads, or customers ready for payment.
              </p>
            </CardContent>
          </Card>

          <div className="flex items-center gap-4 p-4 border rounded-lg bg-background mb-6">
            <div className="flex-1">
              <h3 className="font-semibold">Automatic Lifecycle Tagging</h3>
              <p className="text-sm text-muted-foreground">
                {isIntegrationRunning 
                  ? 'Active: WhatsApp messages are being analyzed for lifecycle keywords.' 
                  : 'Inactive: Turn this on to start auto-tagging contacts based on your rules.'}
              </p>
            </div>
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <div className="flex items-center gap-2">
                <Switch
                  checked={isIntegrationRunning}
                  onCheckedChange={handleToggleIntegration}
                  id="integration-toggle"
                />
                <label htmlFor="integration-toggle" className="text-sm">
                  {isIntegrationRunning ? 'On' : 'Off'}
                </label>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="border-b pb-2">
              <h2 className="text-xl font-semibold">Configure Tagging Rules</h2>
              <p className="text-sm text-muted-foreground">
                Define keywords that will automatically update a contact's lifecycle stage when detected in messages.
              </p>
            </div>
            
            <LifecycleTaggingConfig />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LifecycleTaggingPage; 