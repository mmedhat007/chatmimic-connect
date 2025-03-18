# n8n Integration Guide

This guide explains how to integrate the ChatMimic Connect application with n8n workflows to create a WhatsApp chatbot that uses the agent configurations and embeddings stored in Supabase.

## Prerequisites

- n8n installed and running
- A WhatsApp Business API account or WhatsApp Cloud API account
- Supabase set up with the tables and functions as described in the [Supabase Setup Guide](SUPABASE_SETUP.md)
- OpenAI API key (if generating embeddings in n8n)

## Basic Workflow Structure

The n8n workflow for the WhatsApp chatbot typically consists of these key components:

1. WhatsApp Trigger node (to receive incoming messages)
2. Supabase node (to fetch user configurations and query embeddings)
3. OpenAI node (for generating responses based on matched content)
4. WhatsApp Send node (to send responses back to the user)

## Example Workflow

Here's an example of a basic n8n workflow for implementing the WhatsApp chatbot:

```json
{
  "nodes": [
    {
      "name": "WhatsApp Trigger",
      "type": "n8n-nodes-base.whatsappTrigger",
      "position": [
        250,
        300
      ],
      "parameters": {
        "phoneNumberId": "{{$env.WHATSAPP_PHONE_NUMBER_ID}}",
        "accessToken": "{{$env.WHATSAPP_ACCESS_TOKEN}}"
      }
    },
    {
      "name": "Extract User Data",
      "type": "n8n-nodes-base.functionItem",
      "position": [
        450,
        300
      ],
      "parameters": {
        "functionCode": "// Extract user phone number and message text\nconst phoneNumber = $input.item.json.from;\nconst messageText = $input.item.json.text?.body || '';\n\n// Look up user by phone number (this would typically be done via a database query)\n// For this example, we'll use a fixed Firebase UID\nconst firebaseUid = 'test_user_123';\n\nreturn {\n  userId: firebaseUid,\n  phoneNumber,\n  messageText\n};"
      }
    },
    {
      "name": "Query Supabase",
      "type": "n8n-nodes-base.supabase",
      "position": [
        650,
        300
      ],
      "parameters": {
        "supabaseUrl": "{{$env.SUPABASE_URL}}",
        "supabaseKey": "{{$env.SUPABASE_SERVICE_KEY}}",
        "operation": "executeQuery",
        "query": "SELECT * FROM match_documents(\n  '{{$json[\"messageText\"]}}',\n  0.7,\n  3,\n  '{{$json[\"userId\"]}}'\n);"
      }
    },
    {
      "name": "Check if matches found",
      "type": "n8n-nodes-base.if",
      "position": [
        850,
        300
      ],
      "parameters": {
        "conditions": {
          "string": [
            {
              "value1": "={{$json[\"queryResult\"].length}}",
              "operation": "notEqual",
              "value2": "0"
            }
          ]
        }
      }
    },
    {
      "name": "Format Response with Matches",
      "type": "n8n-nodes-base.functionItem",
      "position": [
        1050,
        250
      ],
      "parameters": {
        "functionCode": "// Format the response based on the matched content\nconst matches = $input.item.json.queryResult;\n\n// Parse the JSON content from the matches (since it's stored as a string)\nconst parsedContent = matches.map(match => {\n  try {\n    return JSON.parse(match.content);\n  } catch (e) {\n    return { text: match.content };\n  }\n});\n\n// Create a response based on the matched content\nlet response = \"I found some information that might help you:\\n\\n\";\n\nfor (const match of parsedContent) {\n  // Add relevant information from the match\n  // This would be customized based on your data structure\n  if (match.name) response += `${match.name}\\n`;\n  if (match.text) response += `${match.text}\\n`;\n  response += \"\\n\";\n}\n\nreturn {\n  responseText: response\n};"
      }
    },
    {
      "name": "No Matches Response",
      "type": "n8n-nodes-base.functionItem",
      "position": [
        1050,
        450
      ],
      "parameters": {
        "functionCode": "// Create a default response when no matches are found\nreturn {\n  responseText: \"I don't have specific information about that. Could you please rephrase your question or ask something else?\"\n};"
      }
    },
    {
      "name": "Send WhatsApp Response",
      "type": "n8n-nodes-base.whatsapp",
      "position": [
        1250,
        300
      ],
      "parameters": {
        "phoneNumberId": "{{$env.WHATSAPP_PHONE_NUMBER_ID}}",
        "accessToken": "{{$env.WHATSAPP_ACCESS_TOKEN}}",
        "to": "={{$node[\"Extract User Data\"].json[\"phoneNumber\"]}}",
        "messageType": "text",
        "text": "={{$json[\"responseText\"]}}"
      }
    }
  ],
  "connections": {
    "WhatsApp Trigger": {
      "main": [
        [
          {
            "node": "Extract User Data",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Extract User Data": {
      "main": [
        [
          {
            "node": "Query Supabase",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Query Supabase": {
      "main": [
        [
          {
            "node": "Check if matches found",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Check if matches found": {
      "main": [
        [
          {
            "node": "Format Response with Matches",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "No Matches Response",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Format Response with Matches": {
      "main": [
        [
          {
            "node": "Send WhatsApp Response",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "No Matches Response": {
      "main": [
        [
          {
            "node": "Send WhatsApp Response",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

## Alternative: Using OpenAI Embeddings Node

If your Supabase instance doesn't support `pg_embedding` or the OpenAI integration, you can generate embeddings directly in n8n and use the `match_documents_with_embedding` function instead:

```json
{
  "nodes": [
    // ... WhatsApp Trigger and Extract User Data nodes ...
    
    {
      "name": "Generate Embedding",
      "type": "n8n-nodes-base.openAi",
      "position": [
        650,
        300
      ],
      "parameters": {
        "apiKey": "{{$env.OPENAI_API_KEY}}",
        "resource": "embedding",
        "model": "text-embedding-3-small",
        "text": "={{$json[\"messageText\"]}}"
      }
    },
    {
      "name": "Query Supabase with Embedding",
      "type": "n8n-nodes-base.supabase",
      "position": [
        850,
        300
      ],
      "parameters": {
        "supabaseUrl": "{{$env.SUPABASE_URL}}",
        "supabaseKey": "{{$env.SUPABASE_SERVICE_KEY}}",
        "operation": "executeQuery",
        "query": "SELECT * FROM match_documents_with_embedding(\n  '{{$json[\"data\"][0][\"embedding\"]}}',\n  0.7,\n  3,\n  '{{$json[\"userId\"]}}'\n);"
      }
    },
    
    // ... remaining nodes ...
  ]
}
```

## Setting Up Environment Variables

For security, store your API keys and other sensitive information as environment variables in n8n:

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_KEY`: Your Supabase service role key
- `OPENAI_API_KEY`: Your OpenAI API key
- `WHATSAPP_PHONE_NUMBER_ID`: Your WhatsApp phone number ID
- `WHATSAPP_ACCESS_TOKEN`: Your WhatsApp access token

## Advanced Features

### User Identification

In a production environment, you need to map WhatsApp phone numbers to Firebase user IDs. You can use the `whatsapp_user_mapping` table and `get_user_id_by_phone` function:

```json
{
  "name": "Get User ID",
  "type": "n8n-nodes-base.supabase",
  "position": [
    450,
    300
  ],
  "parameters": {
    "supabaseUrl": "{{$env.SUPABASE_URL}}",
    "supabaseKey": "{{$env.SUPABASE_SERVICE_KEY}}",
    "operation": "executeQuery",
    "query": "SELECT get_user_id_by_phone('{{$json[\"from\"]}}') as user_id;"
  }
}
```

If the user doesn't exist yet, you can create a mapping:

```json
{
  "name": "Create User Mapping",
  "type": "n8n-nodes-base.supabase",
  "position": [
    450,
    400
  ],
  "parameters": {
    "supabaseUrl": "{{$env.SUPABASE_URL}}",
    "supabaseKey": "{{$env.SUPABASE_SERVICE_KEY}}",
    "operation": "executeQuery",
    "query": "INSERT INTO whatsapp_user_mapping (phone_number, user_id) VALUES ('{{$json[\"from\"]}}', '{{$json[\"new_user_id\"]}}') ON CONFLICT (phone_number) DO UPDATE SET user_id = EXCLUDED.user_id RETURNING user_id;"
  }
}
```

### Conversation History

For better context-aware responses, you can:

1. Store conversation history in a Supabase table
2. Include recent messages when generating responses
3. Implement a memory mechanism to track conversation state

### Workflow Decision Tree

For handling different types of user intents:

1. Use a classification model to determine the intent of the message
2. Route to different handlers based on the intent
3. Implement specific logic for common scenarios (appointment booking, FAQs, etc.)

## Querying Embeddings in n8n

There are several ways to query the embeddings in n8n, depending on your setup and requirements:

### Option 1: Using the Fixed match_documents Function (Recommended)

This is the most straightforward approach that works with n8n's parameter naming:

```sql
SELECT * FROM match_documents(
  'user_id={{$json["userId"]}}',  -- Filter with user_id
  5,                             -- Number of results
  '{{$json["embedding"]}}'        -- Optional: Pre-generated embedding
);
```

The parameters are:
- `filter`: A string containing 'user_id=xyz' where xyz is the Firebase user ID
- `match_count`: The maximum number of results to return
- `query_embedding`: Optional. A pre-generated embedding vector (pass as text)

If you don't provide an embedding, the function will fall back to retrieving recent documents.

Example n8n configuration:

1. Set up the function node to extract the user ID:
```javascript
// Extract user ID
return {
  userId: $input.item.json.firebase_uid || 'test_user_123'
}
```

2. Set up the Supabase node:
   - Connection: Your Supabase connection
   - Operation: Execute Query
   - Query: 
   ```sql
   SELECT * FROM match_documents(
     'user_id={{$json["userId"]}}',
     5,
     null
   );
   ```

### Option 2: Using get_recent_documents

If you just need to retrieve recent documents without similarity search:

```sql
SELECT * FROM get_recent_documents(
  '{{$json["userId"]}}',
  10
);
```

The parameters are:
- `user_id`: The Firebase user ID
- `limit_count`: The maximum number of results to return

### Option 3: Using match_documents_with_embedding with OpenAI Node

If you want more advanced control and have already generated embeddings with the OpenAI node:

1. First use the OpenAI node to generate an embedding
2. Then use the Supabase node with a raw query:

```sql
SELECT * 
FROM user_embeddings
WHERE user_id = '{{$json["userId"]}}'
ORDER BY embedding <=> '{{$json["embedding"]}}' 
LIMIT 5;
```

This performs a direct vector similarity search in the database.

## Troubleshooting Common Errors

### Error: "Could not find the function"

If you see an error like:
```
PGRST202 Could not find the function public.match_documents(filter, match_count, query_embedding)
```

Make sure:
1. You've run the `004_fix_n8n_match_documents.sql` migration script
2. You're passing parameters exactly as shown in the examples above
3. The parameter names match what n8n expects (filter, match_count, query_embedding)

### Error: "Cannot convert text to vector"

This means your embedding format is incorrect. Make sure:
1. The embedding is a valid array of floats
2. The embedding has exactly 1536 dimensions (for text-embedding-3-small)
3. The embedding is properly formatted as a string when passed to the function 