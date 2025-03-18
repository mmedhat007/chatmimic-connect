# Using n8n with Supabase Vector Store

This guide explains how to use n8n with our Supabase Vector Store implementation.

## Prerequisites

1. A Supabase project with our SQL setup applied (Run the `sql/migrations/000_clean_setup.sql` script)
2. An n8n instance running
3. Supabase API credentials (URL and service role key)
4. OpenAI API key (for generating embeddings)

## Using the Supabase Vector Store Node

n8n provides a dedicated Supabase Vector Store node that is compatible with our implementation.

### Basic Setup

1. Add a **Supabase Vector Store** node to your workflow
2. Configure the connection:
   - **Host**: Your Supabase URL (e.g., `https://[project-id].supabase.co`)
   - **Service Role Key**: Your Supabase service role key
   - **Table**: `user_embeddings`
   - **Content Field**: `content`
   - **Embedding Field**: `embedding`
   - **Metadata Field**: `metadata`

### Adding User ID Filters

Since our implementation stores embeddings for multiple users, you must filter by `user_id` in the metadata:

1. In the Supabase Vector Store node configuration:
   - Add a metadata filter:
     - Key: **Leave this empty**
     - Value: `{"user_id": "YOUR_USER_ID"}`

This is critical - n8n will use the `@>` operator with this filter directly.

## Function Implementation

We've implemented the exact function signature that n8n expects:

```sql
CREATE OR REPLACE FUNCTION match_documents (
  filter TEXT,
  match_count INT,
  query_embedding TEXT
) RETURNS TABLE (
  id BIGINT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
```

This function:
- Takes parameters in the exact order n8n expects
- Handles both JSON and text-based filters
- Converts text embeddings to vectors automatically
- Returns results in the format n8n expects

## Complete n8n Workflow Example

Here's a complete example workflow:

### 1. Function Node (Input)

```javascript
// Prepare search parameters
return {
  userQuery: $input.item.json.query || "Default query",
  userId: $input.item.json.user_id || "default_user_id"
};
```

### 2. OpenAI Node (Generate Embedding)

1. Configure an OpenAI node:
   - **Resource**: Embedding
   - **Model**: text-embedding-3-small
   - **Input**: `{{$json.userQuery}}`

### 3. Supabase Vector Store Node

Configure this node as described above, and:
- **Operation**: "Search Similar Embeddings"  
- **Input Type**: "Embedding"
- **Embedding**: `{{$json["embedding"]}}` (from OpenAI node)
- **Metadata Filter**:
  - Value: `{"user_id": "{{$json.userId}}"}` (no key needed)
- **Result Limit**: `5`
- **Similarity Threshold**: `0.7`

### 4. Function Node (Process Results)

```javascript
// This processes the search results
const results = $input.item.json.data;

if (!results || results.length === 0) {
  return {
    success: false,
    message: "No matching information found",
    data: []
  };
}

return {
  success: true,
  message: "Found relevant information",
  data: results.map(item => ({
    content: item.content,
    similarity: item.similarity,
    metadata: item.metadata
  }))
};
```

## Troubleshooting

### If you see function errors:

1. Make sure you've executed the latest SQL script that includes our fixes
2. Verify your filter contains the user_id in the exact format: `{"user_id": "YOUR_USER_ID"}`
3. Try testing a direct SQL query in Supabase:

```sql
SELECT * FROM match_documents(
  '{"user_id": "YOUR_USER_ID"}',
  5,
  '[1.2, 0.8, ...]'  -- Your embedding array as text
);
```

### Other troubleshooting:

- **No results**: Check that your user_id is correct and you have data for this user
- **Error 400**: Make sure you're using proper JSON format in the metadata filter
- **Missing data**: Use the direct SQL feature to check if data exists:

```sql
SELECT * FROM user_embeddings 
WHERE metadata @> '{"user_id": "YOUR_USER_ID"}' 
LIMIT 10;
```

## Complete JSON Example

Here's a complete n8n workflow JSON you can import:

```json
{
  "nodes": [
    {
      "parameters": {
        "functionCode": "return {\n  userQuery: $input.item.json.query || \"Default query\",\n  userId: $input.item.json.user_id || \"default_user_id\"\n};"
      },
      "id": "Input_Function",
      "name": "Function",
      "type": "n8n-nodes-base.function",
      "position": [400, 300]
    },
    {
      "parameters": {
        "authentication": "apiKey",
        "resource": "embedding",
        "model": "text-embedding-3-small",
        "text": "={{$json.userQuery}}",
        "options": {}
      },
      "id": "OpenAI_Embedding",
      "name": "OpenAI",
      "type": "n8n-nodes-base.openAi",
      "position": [600, 300],
      "credentials": {
        "openAiApi": {
          "id": "OpenAI_API_Key",
          "name": "OpenAI API"
        }
      }
    },
    {
      "parameters": {
        "operation": "searchSimilarEmbeddings",
        "table": "user_embeddings",
        "textColumn": "content",
        "embeddingColumn": "embedding",
        "metadataColumn": "metadata",
        "inputType": "embedding",
        "embedding": "={{$json.embedding}}",
        "filters": {
          "metadata": [{"value": "{\"user_id\": \"{{$json.userId}}\"}"}]
        },
        "limit": 5,
        "similarityThreshold": 0.7
      },
      "id": "Supabase_Vector_Search",
      "name": "Supabase Vector Store",
      "type": "n8n-nodes-base.supabaseVectorStore",
      "position": [800, 300],
      "credentials": {
        "supabaseApi": {
          "id": "Supabase_Credentials",
          "name": "Supabase API"
        }
      }
    },
    {
      "parameters": {
        "functionCode": "const results = $input.item.json.data;\n\nif (!results || results.length === 0) {\n  return {\n    success: false,\n    message: \"No matching information found\",\n    data: []\n  };\n}\n\nreturn {\n  success: true,\n  message: \"Found relevant information\",\n  data: results.map(item => ({\n    content: item.content,\n    similarity: item.similarity,\n    metadata: item.metadata\n  }))\n};"
      },
      "id": "Process_Results",
      "name": "Function",
      "type": "n8n-nodes-base.function",
      "position": [1000, 300]
    }
  ],
  "connections": {
    "Input_Function": {
      "main": [
        [
          {
            "node": "OpenAI_Embedding",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OpenAI_Embedding": {
      "main": [
        [
          {
            "node": "Supabase_Vector_Search",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Supabase_Vector_Search": {
      "main": [
        [
          {
            "node": "Process_Results",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
} 