# N8N Database Compatibility

This document describes how our Supabase database structure maintains compatibility with n8n while preserving the application's functionality.

## Table Structure Compatibility

The primary table for vector embeddings is `user_embeddings`, which has been designed to be compatible with n8n's expected `documents` table structure:

```sql
-- Our user_embeddings table structure
CREATE TABLE IF NOT EXISTS user_embeddings (
  id BIGSERIAL PRIMARY KEY,  -- Same as n8n's documents table
  user_id TEXT NOT NULL,     -- Additional column for our app's user management
  content TEXT,              -- Same as n8n's documents table
  metadata JSONB,            -- Same as n8n's documents table
  embedding VECTOR(1536),    -- Same as n8n's documents table
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

The compatibility script will automatically create this table if it doesn't exist, so it's safe to run after a database reset or in a new environment.

## N8N Compatibility Features

### 1. Compatible Function Signature

We've implemented the `match_documents` function with exactly the signature n8n expects:

```sql
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector(1536),
  match_count int default null,
  filter jsonb DEFAULT '{}'
) returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
```

### 2. User ID in Metadata

To ensure n8n can filter by user, we store the user's ID both:
- As a dedicated column (`user_id`)
- Within the `metadata` JSONB field (`metadata.user_id`)

This allows n8n to filter by user via the metadata filter while our application can use the optimized `user_id` column for faster lookups.

### 3. Documents View

For complete compatibility, we've created a view that exactly matches n8n's expected structure:

```sql
CREATE OR REPLACE VIEW documents AS
  SELECT 
    id,
    content,
    metadata,
    embedding
  FROM user_embeddings;
```

## Usage in API Endpoints

The `/api/proxy/match-documents` endpoint has been updated to use the compatible function signature while maintaining security by ensuring users can only access their own documents.

## Embedding Storage

When storing embeddings via the `/api/proxy/embeddings` endpoint, the system:

1. Automatically includes the user's ID in the metadata
2. Stores the embedding type in the metadata
3. Preserves any additional metadata provided in the request

## N8N Integration Notes

When configuring n8n to use our database:

1. Use the `match_documents` function for similarity searches
2. Include `user_id` in the filter to scope to a specific user
3. Access the embedding vector directly from the `embedding` column

The system is designed to work seamlessly with n8n's LangChain nodes that expect a PostgreSQL/pgvector database with the standard schema.

## Setup and Recovery

The `apply_n8n_compatibility.sh` script in the `scripts` directory will:

1. Create the necessary database extensions (pgvector, pg_trgm) if they don't exist
2. Create the `user_embeddings` table if it doesn't exist
3. Add appropriate indexes for efficient querying
4. Create the required functions and views for n8n compatibility

This makes it safe to run even after a database reset or in a fresh environment. 