# Using Supabase Vector Store with n8n

This guide explains how to use the Supabase Vector Store node in n8n with our improved database structure.

## Setup Instructions

### Step 1: Update Your Database Schema

First, run the migration script to create the new `documents` table and functions:

```sql
-- Run this in Supabase SQL Editor
-- Enable the pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create a documents table with Supabase's standard structure plus user_id
CREATE TABLE IF NOT EXISTS documents (
  id bigserial primary key,
  content text, -- corresponds to Document.pageContent
  metadata jsonb, -- corresponds to Document.metadata
  user_id text, -- added for user-specific filtering
  embedding vector(1536) -- 1536 works for OpenAI embeddings
);

-- Create an index for faster similarity searches
CREATE INDEX IF NOT EXISTS documents_embedding_idx ON documents
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Create a standard Supabase match_documents function with added user_id support
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  filter jsonb DEFAULT '{}'
) RETURNS TABLE (
  id bigint,
  content text,
  metadata jsonb,
  user_id text,
  similarity float
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  SELECT
    id,
    content,
    metadata,
    user_id,
    1 - (documents.embedding <=> query_embedding) AS similarity
  FROM documents
  WHERE metadata @> filter
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### Step 2: Migrate Your Existing Data (If Needed)

If you have existing data in the old `user_embeddings` table, you can migrate it:

```sql
-- Migration helper function
CREATE OR REPLACE FUNCTION migrate_user_embeddings_to_documents() 
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if the user_embeddings table exists
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'user_embeddings'
  ) THEN
    -- Insert data from user_embeddings to documents
    INSERT INTO documents (content, metadata, user_id, embedding)
    SELECT 
      content, 
      jsonb_build_object(
        'query_name', query_name, 
        'created_at', created_at
      ) AS metadata,
      user_id,
      embedding
    FROM user_embeddings
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$;

-- Run the migration
SELECT migrate_user_embeddings_to_documents();
```

## Using with n8n Vector Store Node

### Option 1: Supabase Vector Store Node

The Supabase Vector Store node should now work correctly with this standard configuration:

1. Add a Supabase Vector Store node to your workflow
2. Configure it:
   - **Collection/Table**: Select "documents"
   - **Operation mode**: "Retrieve Documents (As Tool for AI Agent)"
   - **Content Field**: "content"
   - **Embedding Field**: "embedding"
   - **Metadata Field**: "metadata"

3. If you want to filter by user:
   - Click "Add Option"
   - Add a filter with:
     - Key: "user_id"
     - Value: your user ID or "{{$json.userId}}"
   
   OR
   
   - Create a metadata filter:
     ```json
     {"user_id": "your_user_id"}
     ```

### Option 2: Using Standard Supabase Node with Function

If the Vector Store node still doesn't work correctly, you can use the standard Supabase node:

1. Add a regular Supabase node to your workflow
2. Set the operation to "Execute Query"
3. Use this query:

```sql
SELECT * FROM match_documents(
  '{{$json["embedding"]}}',  -- Pass in a pre-generated embedding if you have one
  5,                        -- Number of results to return
  '{"user_id": "your_user_id"}'  -- Filter by user_id
);
```

If you don't have a pre-generated embedding, you can first use OpenAI node to create one, or use the plain text search function:

```sql
SELECT * FROM search_documents(
  '{{$json["query"]}}',  -- Your search text
  5,                    -- Number of results
  '{}'                  -- No filters
);
```

## Example n8n Workflow

Here's a complete example workflow:

1. **Input Node**: Captures user query and user ID
2. **OpenAI Embeddings Node**: Generates embedding for the query
3. **Supabase Node**: Executes search query
4. **IF Node**: Checks if results were found
5. **Function Nodes**: Format the response
6. **Output Node**: Returns the response

## Troubleshooting

If you're still having issues:

1. **Check your data**: Make sure you have documents in the table:
   ```sql
   SELECT COUNT(*) FROM documents;
   ```

2. **Verify embedding format**: Make sure your embeddings are correctly stored:
   ```sql
   SELECT id, ARRAY_LENGTH(embedding, 1) as dimensions 
   FROM documents 
   LIMIT 1;
   ```

3. **Try direct SQL**: Test the match_documents function directly:
   ```sql
   -- Example with a self-matched query (should always return the document)
   SELECT * FROM documents LIMIT 1;
   SELECT * FROM match_documents(
     (SELECT embedding FROM documents LIMIT 1),
     5,
     '{}'
   );
   ```

4. **Check metadata**: Verify your metadata is properly structured:
   ```sql
   SELECT id, metadata FROM documents LIMIT 10;
   ```

5. **Test text search**: If vector search isn't working, try text search:
   ```sql
   SELECT * FROM search_documents('company', 5, '{}');
   ``` 