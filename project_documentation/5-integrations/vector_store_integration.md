# Vector Store Integration

This document outlines how to integrate and use vector embeddings with ChatMimic Connect. Vector embeddings allow for semantic search and intelligent matching of user queries to your business knowledge base.

## Overview

ChatMimic Connect uses OpenAI's text embeddings to generate vector representations of text and stores them in Supabase's vector database for efficient similarity search.

## Setup

### Prerequisites

1. Supabase project with PostgreSQL database
2. OpenAI API key
3. ChatMimic Connect application properly configured

### Database Configuration

1. Enable the `pgvector` extension in your Supabase project:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

2. Create user-specific tables for storing embeddings:
   ```sql
   -- Function to create user-specific tables
   CREATE OR REPLACE FUNCTION create_user_table(uid TEXT)
   RETURNS BOOLEAN
   LANGUAGE plpgsql
   SECURITY DEFINER
   AS $$
   DECLARE
       sanitized_uid TEXT;
       table_exists BOOLEAN;
       user_table_name TEXT;
       user_embeddings_table_name TEXT;
   BEGIN
       -- MD5 hash for table name to prevent SQL injection
       sanitized_uid := MD5(uid);
       
       -- Table names
       user_table_name := 'user_table_' || sanitized_uid;
       user_embeddings_table_name := 'user_embeddings_' || sanitized_uid;
       
       -- Check if tables already exist
       SELECT EXISTS (
           SELECT FROM information_schema.tables 
           WHERE table_schema = 'public' 
           AND table_name = user_table_name
       ) INTO table_exists;
       
       -- Only create if tables don't exist
       IF NOT table_exists THEN
           -- Create main configuration table
           EXECUTE format('
               CREATE TABLE %I (
                   id SERIAL PRIMARY KEY,
                   company_info JSONB,
                   services JSONB,
                   communication_style JSONB,
                   business_processes JSONB,
                   integrations JSONB,
                   created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                   updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
               )
           ', user_table_name);
           
           -- Create embeddings table
           EXECUTE format('
               CREATE TABLE %I (
                   id SERIAL PRIMARY KEY,
                   content TEXT,
                   embedding VECTOR(1536),
                   query_name TEXT,
                   created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
               )
           ', user_embeddings_table_name);
           
           -- Create index on embeddings for similarity search
           EXECUTE format('
               CREATE INDEX ON %I 
               USING ivfflat (embedding vector_cosine_ops)
               WITH (lists = 100)
           ', user_embeddings_table_name);
           
           -- Disable RLS for now (enable in production)
           EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', user_table_name);
           EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', user_embeddings_table_name);
           
           RETURN TRUE;
       ELSE
           RETURN FALSE;
       END IF;
   END;
   $$;
   ```

3. Create a function for vector similarity search:
   ```sql
   CREATE OR REPLACE FUNCTION match_documents(
       query_embedding VECTOR(1536),
       match_threshold FLOAT,
       match_count INT,
       table_name TEXT
   )
   RETURNS TABLE (
       id BIGINT,
       content TEXT,
       query_name TEXT,
       similarity FLOAT
   )
   LANGUAGE plpgsql
   SECURITY DEFINER
   AS $$
   DECLARE
       sanitized_table_name TEXT;
       table_exists BOOLEAN;
   BEGIN
       -- MD5 hash for table name to prevent SQL injection
       sanitized_table_name := 'user_embeddings_' || MD5(table_name);
       
       -- Check if table exists
       SELECT EXISTS (
           SELECT FROM information_schema.tables 
           WHERE table_schema = 'public' 
           AND table_name = sanitized_table_name
       ) INTO table_exists;
       
       IF table_exists THEN
           RETURN QUERY
           EXECUTE format('
               SELECT 
                   id,
                   content,
                   query_name,
                   1 - (embedding <=> $1) AS similarity
               FROM %I
               WHERE 1 - (embedding <=> $1) > $2
               ORDER BY similarity DESC
               LIMIT $3
           ', sanitized_table_name)
           USING query_embedding, match_threshold, match_count;
       END IF;
   END;
   $$;
   ```

## Usage

### 1. Generating Embeddings

```javascript
import { openai } from './openai-service';
import { supabase } from './supabase-service';

// Generate embeddings for a text
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

// Save embeddings to Supabase
async function saveEmbedding(userId, content, embedding, queryName) {
  try {
    // Get user's embedding table name (MD5 hash of userId)
    const tableName = `user_embeddings_${md5(userId)}`;
    
    // Save to database
    const { data, error } = await supabase
      .from(tableName)
      .insert({
        content,
        embedding,
        query_name: queryName
      });
      
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving embedding:', error);
    throw error;
  }
}
```

### 2. Searching with Embeddings

```javascript
// Search for similar documents
async function searchSimilarDocuments(userId, queryText, threshold = 0.7, limit = 5) {
  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(queryText);
    
    // Call the match_documents function
    const { data, error } = await supabase.rpc(
      'match_documents',
      {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: limit,
        table_name: userId
      }
    );
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error searching documents:', error);
    throw error;
  }
}
```

## Best Practices

1. **Batch Processing**: If generating many embeddings, process them in batches to avoid rate limits.

2. **Embeddings Caching**: Consider implementing a caching mechanism for frequently used embeddings.

3. **Content Chunking**: For long documents, split them into meaningful chunks before generating embeddings.

4. **Periodic Updates**: Update your embeddings when your business information changes.

5. **Query Optimization**: Use appropriate threshold values based on your use case:
   - Higher threshold (0.8-0.9): Returns only very close matches
   - Lower threshold (0.6-0.7): Returns more varied but potentially less relevant results

## Troubleshooting

### Common Issues

1. **Missing `pgvector` Extension**
   - Error: "Extension 'vector' does not exist"
   - Solution: Create the extension in your Supabase project

2. **Embedding Generation Failures**
   - Error: "API key not valid" or rate limiting errors
   - Solution: Check your OpenAI API key and implement proper error handling

3. **Vector Search Not Working**
   - Error: "Function match_documents does not exist"
   - Solution: Ensure the SQL function is created correctly in your database

4. **Dimension Mismatch**
   - Error: "Vector dimension mismatch"
   - Solution: Ensure your vectors are consistently 1536 dimensions for text-embedding-3-small

## Advanced Configuration

### Row-Level Security (RLS)

For production, enable RLS to secure your embeddings:

```sql
-- Enable RLS
ALTER TABLE user_embeddings_YOUR_USER_ID ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Users can only access their own embeddings"
ON user_embeddings_YOUR_USER_ID
USING (auth.uid() = 'YOUR_USER_ID');
```

### Automated Embedding Generation

Implement webhooks or cron jobs to automatically generate embeddings when new content is added:

```javascript
// Example webhook handler
app.post('/webhook/new-content', async (req, res) => {
  const { userId, content, contentType } = req.body;
  
  try {
    const embedding = await generateEmbedding(content);
    await saveEmbedding(userId, content, embedding, contentType);
    res.status(200).send('Embedding created');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Error processing webhook');
  }
});
``` 