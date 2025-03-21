import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { PlusCircle, Trash2, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface BehaviorRule {
  id: string;
  rule: string;
  description: string;
  enabled: boolean;
}

interface AgentBehaviorRulesProps {
  behaviorRules: BehaviorRule[];
  onRulesChange: (rules: BehaviorRule[]) => void;
}

const predefinedRules = [
  {
    id: 'rule-sales-redirect',
    rule: 'Never engage with customers, only direct them to sales',
    description: 'The agent will not attempt to answer customer questions but will instead provide contact details for the sales team.',
    enabled: false,
  },
  {
    id: 'rule-ask-name',
    rule: 'Ask for customer name after initial inquiry',
    description: 'The agent will always ask for the customer\'s name if they haven\'t provided it after their first message.',
    enabled: false,
  },
  {
    id: 'rule-handoff',
    rule: 'Hand off to human agent after 3 messages',
    description: 'The agent will suggest connecting with a human agent after 3 back-and-forth messages.',
    enabled: false,
  },
  {
    id: 'rule-qualify',
    rule: 'Qualify leads before providing detailed information',
    description: 'The agent will ask qualifying questions (budget, timeline, requirements) before sharing product/service details.',
    enabled: false,
  }
];

const AgentBehaviorRules: React.FC<AgentBehaviorRulesProps> = ({ behaviorRules, onRulesChange }) => {
  const [newRule, setNewRule] = useState('');
  const [newRuleDescription, setNewRuleDescription] = useState('');

  const handleAddPredefinedRule = (rule: BehaviorRule) => {
    // Check if rule with this ID already exists
    if (!behaviorRules.some(r => r.id === rule.id)) {
      onRulesChange([...behaviorRules, { ...rule, enabled: true }]);
    }
  };

  const handleAddCustomRule = () => {
    if (newRule.trim() === '') return;
    
    const newRuleObject: BehaviorRule = {
      id: `rule-${Date.now()}`,
      rule: newRule,
      description: newRuleDescription,
      enabled: true,
    };
    
    onRulesChange([...behaviorRules, newRuleObject]);
    setNewRule('');
    setNewRuleDescription('');
  };

  const handleRemoveRule = (id: string) => {
    onRulesChange(behaviorRules.filter(rule => rule.id !== id));
  };

  const handleToggleRule = (id: string) => {
    onRulesChange(
      behaviorRules.map(rule => 
        rule.id === id ? { ...rule, enabled: !rule.enabled } : rule
      )
    );
  };

  const unusedPredefinedRules = predefinedRules.filter(
    predefined => !behaviorRules.some(rule => rule.id === predefined.id)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Agent Behavior Rules
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">Define specific behaviors for your AI agent to follow when interacting with customers.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
        <CardDescription>
          Set rules that control how your agent behaves in conversations
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Active rules */}
        {behaviorRules.length > 0 ? (
          <div className="space-y-4 mb-6">
            <h3 className="text-sm font-medium text-gray-700">Active Rules</h3>
            {behaviorRules.map((rule) => (
              <div key={rule.id} className="flex items-start space-x-4 p-3 rounded-md border bg-white">
                <Switch
                  checked={rule.enabled}
                  onCheckedChange={() => handleToggleRule(rule.id)}
                  id={`toggle-${rule.id}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{rule.rule}</p>
                  {rule.description && (
                    <p className="text-xs text-gray-500 mt-1">{rule.description}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveRule(rule.id)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center bg-gray-50 rounded-md mb-6">
            <p className="text-gray-500 text-sm">No behavior rules defined yet. Add rules to control how your agent behaves.</p>
          </div>
        )}

        {/* Suggested rules */}
        {unusedPredefinedRules.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Suggested Rules</h3>
            <div className="grid gap-2">
              {unusedPredefinedRules.map((rule) => (
                <button
                  key={rule.id}
                  onClick={() => handleAddPredefinedRule(rule)}
                  className="text-left p-2 rounded-md border border-dashed hover:border-solid hover:bg-gray-50 transition-all"
                >
                  <p className="text-sm font-medium">{rule.rule}</p>
                  <p className="text-xs text-gray-500 mt-1">{rule.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Add custom rule */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-sm font-medium text-gray-700">Add Custom Rule</h3>
          <div className="space-y-2">
            <Label htmlFor="rule-input">Rule instruction</Label>
            <Input
              id="rule-input"
              value={newRule}
              onChange={(e) => setNewRule(e.target.value)}
              placeholder="e.g., Always ask for order number first"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rule-description">Description (optional)</Label>
            <Textarea
              id="rule-description"
              value={newRuleDescription}
              onChange={(e) => setNewRuleDescription(e.target.value)}
              placeholder="Explain what this rule does"
              rows={2}
            />
          </div>
          <Button 
            onClick={handleAddCustomRule} 
            className="w-full"
            disabled={newRule.trim() === ''}
          >
            <PlusCircle className="mr-2 h-4 w-4" /> 
            Add Custom Rule
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AgentBehaviorRules; 