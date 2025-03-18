# Supabase Setup Guide

This guide explains how to set up the necessary tables and extensions in Supabase for the ChatMimic Connect application.

## Prerequisites

- A Supabase account
- The Supabase CLI installed (optional, for local development)
- Project credentials:
  - URL: https://kutdbashpuuysxywvzgs.supabase.co
  - Service Role Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1dGRiYXNocHV1eXN4eXd2emdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MjAwMTI2NCwiZXhwIjoyMDU3NTc3MjY0fQ.nU4SxBAAIZdXOihfS0Uo_uFd_QYVtRj9I0VYx00fIOU
  - Public Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1dGRiYXNocHV1eXN4eXd2emdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwMDEyNjQsImV4cCI6MjA1NzU3NzI2NH0.sPX_kiCkssIG9v1AIoRbdlmnEL-7GCmm_MIxudJyVO8

## Step 1: Enable the Vector Extension

Before creating the tables, you need to enable the `vector` extension in your Supabase project:

1. Go to the Supabase Dashboard
2. Select your project
3. Go to the SQL Editor
4. Run the following SQL command:

```sql
-- Enable the vector extension
CREATE EXTENSION IF NOT EXISTS vector;
```

## Step 2: Create the Required Tables

Run the SQL migration script to create the necessary tables and functions:

1. Go to the SQL Editor in the Supabase Dashboard
2. Copy and paste the contents of `sql/migrations/001_create_tables.sql`
3. Run the query

Alternatively, you can use the Supabase CLI to apply the migration:

```bash
supabase sql < sql/migrations/001_create_tables.sql
```

## Step 3: Add the OpenAI pgvector Extensions (Optional but Recommended)

For the `match_documents` function to work properly with n8n, you'll need to set up the pgvector OpenAI extensions:

1. Go to the SQL Editor in the Supabase Dashboard
2. Run the following SQL commands:

```sql
-- Install the pg_embedding extension for OpenAI access (if available in your plan)
CREATE EXTENSION IF NOT EXISTS pg_embedding;

-- Create the OpenAI schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS openai;

-- Create the OpenAI embedding function
CREATE OR REPLACE FUNCTION openai.embedding(
    model text,
    input text
) RETURNS vector
LANGUAGE plpgsql
AS $$
DECLARE
    result vector;
BEGIN
    -- This function requires additional setup with pg_embedding or a custom implementation
    -- The actual implementation depends on your Supabase plan and setup
    RETURN result;
END;
$$;
```

Note: To use the `match_documents` function with direct text input in n8n, you'll need to have the OpenAI integration with Supabase set up. If this isn't available, you can use the `match_documents_with_embedding` function instead, which requires pre-generated embeddings.

## Step 4: Add Specialized Query Functions

Run the additional migration script to add the specialized `match_documents` functions for n8n:

1. Go to the SQL Editor in the Supabase Dashboard
2. Copy and paste the contents of `sql/migrations/002_add_match_documents_function.sql`
3. Run the query

Or with the CLI:

```bash
supabase sql < sql/migrations/002_add_match_documents_function.sql
```

## Step 5: Set Up Row-Level Security (Optional)

For improved security, you may want to set up Row-Level Security (RLS) policies to restrict access to the tables:

```sql
-- Enable RLS on the tables
ALTER TABLE user_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_embeddings ENABLE ROW LEVEL SECURITY;

-- Create policies for user_configs
CREATE POLICY "Users can view their own configs"
  ON user_configs FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own configs"
  ON user_configs FOR UPDATE
  USING (auth.uid()::text = user_id);

-- Create policies for user_embeddings
CREATE POLICY "Users can view their own embeddings"
  ON user_embeddings FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own embeddings"
  ON user_embeddings FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own embeddings"
  ON user_embeddings FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own embeddings"
  ON user_embeddings FOR DELETE
  USING (auth.uid()::text = user_id);
```

Note: Since you're using Firebase authentication, these RLS policies won't work directly. You may need to adjust them based on your authentication method or use service role key for operations.

## Step 6: Verify the Setup

To verify that everything is set up correctly, run the following queries:

```sql
-- Check if tables exist
SELECT * FROM pg_tables WHERE tablename IN ('user_configs', 'user_embeddings');

-- Check if functions exist
SELECT * FROM pg_proc WHERE proname IN ('update_timestamp', 'match_embeddings', 'match_documents', 'match_documents_with_embedding');

-- Check if indices exist
SELECT * FROM pg_indexes WHERE tablename IN ('user_configs', 'user_embeddings');
```

## Using the Tables

The application uses these tables to store:

1. **user_configs**: User configuration data for WhatsApp AI agent
2. **user_embeddings**: Embeddings for semantic search in user data

The data is organized by Firebase user ID, so each user's data is isolated and can be easily retrieved.

## Working with Embeddings in n8n

To use the embeddings in n8n:

1. Use the Supabase node to connect to your Supabase project
2. Create a workflow that uses one of the embedding search functions:

### Option 1: Using match_documents (if OpenAI integration is set up)

This function accepts raw text and generates embeddings internally, making it simpler to use:

```sql
SELECT * FROM match_documents(
  '{{$json["queryText"]}}',
  0.7,
  5,
  '{{$json["userId"]}}'
);
```

Where:
- `queryText` is the text query from the customer
- `0.7` is the similarity threshold (0.0 to 1.0)
- `5` is the maximum number of results to return
- `userId` is the Firebase user ID

### Option 2: Using match_documents_with_embedding

This function requires pre-generated embeddings (which you would create with OpenAI's API in n8n):

```sql
SELECT * FROM match_documents_with_embedding(
  '{{$json["embedding"]}}',
  0.7,
  5,
  '{{$json["userId"]}}'
);
```

Where:
- `embedding` is the vector representation of the query (generated with OpenAI's API)
- `0.7` is the similarity threshold (0.0 to 1.0)
- `5` is the maximum number of results to return
- `userId` is the Firebase user ID

### Option 3: Using the original match_embeddings function

```sql
SELECT * FROM match_embeddings(
  '{{$json["embedding"]}}',
  0.7,
  5,
  '{{$json["userId"]}}'
);
```

## Troubleshooting

If you encounter issues:

1. Check that the vector extension is enabled
2. Verify that the tables and functions were created successfully
3. Ensure that you're using the correct credentials in your application
4. Check for any errors in the Supabase logs

For more help, refer to the [Supabase documentation](https://supabase.com/docs) or contact support. 