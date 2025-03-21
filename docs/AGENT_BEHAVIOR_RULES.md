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

Behavior rules are stored in the user's configuration and applied during the AI agent's reasoning process. Each rule has:

- **ID**: Unique identifier for the rule
- **Rule Text**: The specific instruction for the agent to follow
- **Description**: Optional explanation of the rule's purpose
- **Enabled Status**: Whether the rule is currently active

## Data Schema

```typescript
interface BehaviorRule {
  id: string;         // Unique identifier
  rule: string;       // The instruction/rule text
  description: string; // Explanation of the rule
  enabled: boolean;   // Whether the rule is active
}
```

These rules are stored as part of the user's configuration:

```typescript
interface AgentConfig {
  // Other configuration sections
  behavior_rules: BehaviorRule[];
}
```

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

If you have questions about configuring behavior rules, please contact support at support@denoteai.com. 