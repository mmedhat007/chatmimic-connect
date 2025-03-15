import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AgentConfig from '../components/AgentConfig';
import KnowledgeBase from '../components/KnowledgeBase';
import { Card } from "@/components/ui/card";

const AgentDashboard = () => {
  const [activeTab, setActiveTab] = useState('config');

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">AI Agent Dashboard</h1>
        </div>

        <Card className="p-6 bg-white shadow-sm">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="config">Configuration</TabsTrigger>
              <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
            </TabsList>

            <TabsContent value="config" className="mt-0">
              <AgentConfig />
            </TabsContent>

            <TabsContent value="knowledge" className="mt-0">
              <KnowledgeBase />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
};

export default AgentDashboard; 