# Agent Behavior Rules Documentation

## Overview

The Agent Behavior Rules feature allows you to define specific behavioral patterns for your AI agent when interacting with customers. These rules act as guardrails and instructions that direct the AI's approach to customer interactions, enabling more control over conversation flow and response strategies.

## Key Features

- **Predefined Rule Templates**: Choose from common behavior patterns that can be applied immediately.
- **Custom Rule Creation**: Define your own specific rules to match your unique business requirements.
- **Rule Toggling**: Easily enable or disable rules without deleting them.
- **Priority-Based Application**: Rules are applied in the order they appear in the list.

## Available in Two Locations

The Agent Behavior Rules feature is available in two places within ChatMimic Connect:

1. **Agent Setup Page**: During the initial setup of your WhatsApp agent, default behavior rules are suggested based on your business type.
2. **Automations Page**: Access the dedicated "Behavior" tab to modify existing rules or add new ones at any time.

## Predefined Rule Examples

The system comes with several predefined rules that address common business needs:

| Rule | Description | Effect |
|------|-------------|--------|
| **Ask for customer name after initial inquiry** | The agent will always ask for the customer's name if they haven't provided it after their first message. | Personalizes conversation early, creates customer profile |
| **Never engage with customers, only direct them to sales** | The agent will not attempt to answer customer questions but will instead provide contact details for the sales team. | Ensures human follow-up for all inquiries |
| **Hand off to human agent after 3 messages** | The agent will suggest connecting with a human agent after 3 back-and-forth messages. | Prevents prolonged automated conversations |
| **Qualify leads before providing detailed information** | The agent will ask qualifying questions (budget, timeline, requirements) before sharing product/service details. | Collects valuable lead qualification data |

## Creating Custom Rules

To create a custom behavior rule:

1. Navigate to **Automations > Behavior**
2. Scroll to the "Add Custom Rule" section
3. Enter the rule instructions (e.g., "Always ask for order number first")
4. Add an optional description for your team
5. Click "Add Custom Rule"

## Best Practices

- **Keep Rules Specific**: Write clear, specific instructions rather than vague guidelines.
- **Don't Contradict Rules**: Review all active rules to ensure they don't conflict with each other.
- **Test After Changes**: Always test your agent with new behavior rules before using it with customers.
- **Start Simple**: Begin with 2-3 critical rules and add more as needed, rather than creating many rules at once.

## Technical Implementation

### How Behavior Rules Are Stored
Behavior rules are stored in two places:

1. **In the Supabase database**: 
   - Rules are stored in a dedicated `behavior_rules` column in the `user_configs` table
   - The data is structured as a single JSON object with the following properties:
     - `rules`: Array containing a single object with a consolidated `description` field
     - `last_updated`: Timestamp of when the rules were last modified
     - `version`: Version number to track schema changes
   - All enabled rules are combined into one consolidated description string, separated by periods

2. **In the full configuration object**:
   - For backward compatibility and UI display, rules are stored as separate objects in the `full_config` column
   - When retrieving configurations, the system parses the consolidated description back into individual rules for UI display

### How Behavior Rules Are Applied
When the agent is processing a message:

1. The system loads the consolidated behavior rules description
2. The consolidated description is sent as a single instruction to the AI model
3. The model processes all rules simultaneously as part of its context
4. This simplified approach improves efficiency and ensures consistent rule application

### Application in Different Contexts

Behavior rules are applied across all conversation channels (WhatsApp, web widget, etc.) and are consistent across all user interactions with your agent.

## Data Schema

### UI Behavior Rule Interface
In the application's user interface, behavior rules appear as separate objects:

```typescript
interface BehaviorRule {
  id: string;         // Unique identifier
  rule: string;       // The instruction/rule text
  description: string; // Explanation of the rule
  enabled: boolean;   // Whether the rule is active
}
```

### Database Storage Format
In the database, behavior rules are stored in a simplified format:

```typescript
interface SimplifiedBehaviorRule {
  description: string; // Consolidated description of all enabled rules
}

interface BehaviorRulesObject {
  rules: SimplifiedBehaviorRule[]; // Array with a single object containing all rules
  last_updated: string;            // ISO timestamp of last update
  version: number;                 // Schema version number
}
```

Example database storage:
```json
{
  "rules": [
    {
      "description": ".The agent will always ask for the customer's name if they haven't provided it after their first message. .The agent will ask qualifying questions (budget, timeline, requirements) before sharing product/service details."
    }
  ],
  "last_updated": "2025-03-22T00:20:00.313Z",
  "version": "1.0"
}
```

### Agent Config Interface

```typescript
interface AgentConfig {
  // Other configuration sections...
  company_info: CompanyInfo;
  roles: Roles;
  communication_style: CommunicationStyle;
  scenarios: Scenario[];
  knowledge_base: KnowledgeBase;
  compliance: Compliance;
  
  // Behavior rules (stored as array in UI, but as consolidated description in database)
  behavior_rules: BehaviorRule[];
}
```

### Database Schema

In the Supabase `user_configs` table, there are two relevant columns:

1. `full_config` (JSONB): Contains the complete agent configuration including behavior rules as separate objects
2. `behavior_rules` (JSONB): Contains the simplified consolidated behavior rules object for efficiency

The system transforms between these two formats as needed when saving to or retrieving from the database.

## Limitations

- Rules are applied based on natural language understanding and may not execute with 100% accuracy in all cases.
- Complex, multi-condition rules may be more challenging for the AI to follow consistently.
- Rules are subject to the AI's interpretation of the conversation context.

## Future Enhancements

We plan to expand this feature in upcoming releases with:

- Rule categorization (sales, support, etc.)
- Rule templates per industry
- Analytics on rule effectiveness
- Rule testing simulator

## Support

For any questions or assistance with Agent Behavior Rules, please contact our support team at support@chatmimic.ai or via the in-app chat support.

## Model Selection Guidelines

ChatMimic Connect supports multiple AI models for different use cases. Here are guidelines on when to use specific models:

### OpenAI ChatGPT 4o mini
- **Best for**: General purpose conversational tasks, customer support scenarios, and situations requiring broad knowledge.
- **Use when**: 
  - Handling complex customer inquiries that require nuanced understanding
  - Processing unstructured conversational data
  - Implementing behavior rules that involve contextual understanding
  - For applications requiring a balance of performance and cost-efficiency

### Deepseek R1 model (Groq)
- **Best for**: High-throughput scenarios requiring quick responses with good accuracy.
- **Use when**:
  - Processing high volumes of queries
  - Implementing simpler behavior rules that don't require deep contextual understanding
  - In cases where response speed is prioritized over nuanced comprehension
  - For applications with budget constraints requiring competitive pricing

### Considerations for Behavior Rules Implementation
When implementing behavior rules, consider the following model-specific guidelines:

1. **For complex rules** (multiple conditions, contextual understanding required):
   - Prefer OpenAI ChatGPT 4o mini for better comprehension and execution
   - Provide more detailed rule descriptions to ensure proper implementation

2. **For straightforward rules** (simple triggers, direct responses):
   - Either model will perform well
   - Deepseek R1 may provide faster response times

3. **For rules involving specific industry knowledge**:
   - OpenAI ChatGPT 4o mini typically has better domain expertise
   - Consider supplementing Deepseek R1 with additional knowledge base entries

The behavior rules data is structured as a single object in the database, containing an array of rule objects, making it compatible with all supported models. 