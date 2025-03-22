import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { getCurrentUser } from '../services/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface BehaviorRule {
  id: string;
  rule: string;
  description: string;
  enabled: boolean;
}

interface SimplifiedBehaviorRule {
  description: string;
}

interface BehaviorRulesObject {
  rules: SimplifiedBehaviorRule[];
  last_updated: string;
  version: number;
}

interface TestResult {
  success: boolean;
  fullConfigRules: BehaviorRule[] | null;
  dedicatedColumnRules: SimplifiedBehaviorRule[] | null;
  consolidatedDescription: string | null;
  behaviorRulesObject: BehaviorRulesObject | null;
  error?: string;
}

const TestResultsDisplay: React.FC = () => {
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    // Get the current user ID
    const userId = getCurrentUser();
    setUid(userId);

    if (userId) {
      fetchTestResults(userId);
    } else {
      setLoading(false);
      setTestResult({
        success: false,
        fullConfigRules: null,
        dedicatedColumnRules: null,
        consolidatedDescription: null,
        behaviorRulesObject: null,
        error: 'No user ID found. Please log in.'
      });
    }
  }, []);

  const fetchTestResults = async (userId: string) => {
    try {
      setLoading(true);
      
      // Query Supabase directly to get both columns
      const { data, error } = await supabase
        .from('user_configs')
        .select('full_config, behavior_rules')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (error) {
        throw error;
      }
      
      if (!data) {
        setTestResult({
          success: false,
          fullConfigRules: null,
          dedicatedColumnRules: null,
          consolidatedDescription: null,
          behaviorRulesObject: null,
          error: 'No data found for current user'
        });
        return;
      }
      
      // Extract behavior rules from each location
      const fullConfigRules = data.full_config?.behavior_rules || null;
      
      // Extract rules from the behavior_rules object
      let dedicatedColumnRules = null;
      let consolidatedDescription = null;
      let behaviorRulesObject = null;
      
      if (data.behavior_rules) {
        behaviorRulesObject = data.behavior_rules;
        
        // Get the simplified rules array
        if (data.behavior_rules.rules && Array.isArray(data.behavior_rules.rules)) {
          dedicatedColumnRules = data.behavior_rules.rules;
          
          // Extract the consolidated description if it exists
          if (data.behavior_rules.rules.length > 0 && data.behavior_rules.rules[0].description) {
            consolidatedDescription = data.behavior_rules.rules[0].description;
          }
        }
      }
      
      setTestResult({
        success: true,
        fullConfigRules,
        dedicatedColumnRules,
        consolidatedDescription,
        behaviorRulesObject
      });
    } catch (err) {
      console.error('Error fetching test results:', err);
      setTestResult({
        success: false,
        fullConfigRules: null,
        dedicatedColumnRules: null,
        consolidatedDescription: null,
        behaviorRulesObject: null,
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    if (uid) {
      fetchTestResults(uid);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Loading Test Results
          </CardTitle>
          <CardDescription>
            Retrieving data from Supabase...
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!testResult) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-red-500">Test Results Unavailable</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Could not retrieve test results.</p>
          <Button onClick={handleRefresh} className="mt-4">Retry</Button>
        </CardContent>
      </Card>
    );
  }

  if (!testResult.success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-red-500 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Test Failed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{testResult.error || 'Unknown error occurred'}</AlertDescription>
          </Alert>
          <Button onClick={handleRefresh}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-green-600 flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          Test Results
        </CardTitle>
        <CardDescription>
          Behavior rules storage test results
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="comparison">
          <TabsList className="mb-4">
            <TabsTrigger value="comparison">Comparison</TabsTrigger>
            <TabsTrigger value="fullConfig">full_config Column</TabsTrigger>
            <TabsTrigger value="consolidated">Consolidated Description</TabsTrigger>
            <TabsTrigger value="rawObject">Raw Object</TabsTrigger>
          </TabsList>
          
          <TabsContent value="comparison">
            <div className="space-y-4">
              <Alert variant="default" className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle>Test Complete</AlertTitle>
                <AlertDescription>
                  The behavior rules are now stored in a simplified format with a consolidated description.
                </AlertDescription>
              </Alert>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">full_config Column (Array Format):</h3>
                  <div className="p-3 bg-gray-50 rounded border">
                    {testResult.fullConfigRules ? (
                      <span className="text-green-600">{testResult.fullConfigRules.length} individual rules found</span>
                    ) : (
                      <span className="text-red-500">No behavior rules found</span>
                    )}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium mb-2">behavior_rules Column (Simplified):</h3>
                  <div className="p-3 bg-gray-50 rounded border">
                    {testResult.consolidatedDescription ? (
                      <span className="text-green-600">Consolidated description found</span>
                    ) : (
                      <span className="text-red-500">No consolidated description found</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="fullConfig">
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Rules in full_config Column:</h3>
              {testResult.fullConfigRules ? (
                testResult.fullConfigRules.map((rule) => (
                  <div key={rule.id} className="p-3 bg-gray-50 rounded border">
                    <div className="font-medium">{rule.rule}</div>
                    <div className="text-sm text-gray-500 mt-1">{rule.description}</div>
                    <div className="text-xs mt-2">
                      Status: <span className={rule.enabled ? 'text-green-600' : 'text-gray-400'}>
                        {rule.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 bg-gray-50 text-center rounded border">
                  No behavior rules found in full_config
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="consolidated">
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Consolidated Description:</h3>
              {testResult.consolidatedDescription ? (
                <div className="p-3 bg-gray-50 rounded border">
                  <div className="text-sm">
                    {testResult.consolidatedDescription}
                  </div>
                  
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="text-sm font-medium mb-2">Individual Rules (Split by '.'):</h4>
                    <div className="space-y-2">
                      {testResult.consolidatedDescription.split('.')
                        .map(desc => desc.trim())
                        .filter(desc => desc !== '')
                        .map((ruleText, index) => (
                          <div key={index} className="p-2 bg-white rounded border">
                            {ruleText}
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 text-center rounded border">
                  No consolidated description found
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="rawObject">
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Raw behavior_rules Object:</h3>
              {testResult.behaviorRulesObject ? (
                <div className="p-3 bg-gray-50 rounded border overflow-auto">
                  <pre className="text-xs">{JSON.stringify(testResult.behaviorRulesObject, null, 2)}</pre>
                  
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="text-sm font-medium mb-2">Object Properties:</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="font-semibold">Rules Structure:</div>
                      <div>
                        {Array.isArray(testResult.behaviorRulesObject.rules) ? 
                          `Array with ${testResult.behaviorRulesObject.rules.length} item(s)` : 
                          'Not an array'}
                      </div>
                      
                      <div className="font-semibold">Last Updated:</div>
                      <div>{testResult.behaviorRulesObject.last_updated || 'Not available'}</div>
                      
                      <div className="font-semibold">Version:</div>
                      <div>{testResult.behaviorRulesObject.version || 'Not available'}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 text-center rounded border">
                  No behavior_rules object found
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
        
        <div className="mt-6">
          <Button onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Results
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default TestResultsDisplay; 