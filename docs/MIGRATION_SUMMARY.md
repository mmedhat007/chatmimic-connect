# Migration to New Table Structure

This document summarizes the changes made to adapt the application to match exactly the structure expected by n8n.

## Database Structure Changes

### 1. Modified the `user_embeddings` table:

```sql
CREATE TABLE IF NOT EXISTS user_embeddings (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  content TEXT, -- corresponds to Document.pageContent
  metadata JSONB, -- corresponds to Document.metadata
  embedding VECTOR(1536) -- 1536 works for OpenAI embeddings
);
```

This structure:
- Exactly matches the `documents` table structure that n8n's Supabase Vector Store node expects
- Uses the same column names and types as the n8n-compatible table structure
- Adds a `user_id` column for multi-tenancy, which is also included in the metadata

### 2. Implemented the `match_documents` function exactly as n8n expects:

```sql
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding VECTOR(1536),
  match_count INT DEFAULT NULL,
  filter JSONB DEFAULT '{}'
) RETURNS TABLE (
  id BIGINT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
```

We've also provided a text parameter version for alternative ways of calling:

```sql
CREATE OR REPLACE FUNCTION match_documents (
  filter TEXT,
  match_count INT,
  query_embedding TEXT
) RETURNS TABLE (...)
```

This resolves function errors by providing exactly the signatures n8n expects.

### 3. User configs table structure:

```sql
CREATE TABLE IF NOT EXISTS user_configs (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  temperature FLOAT DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 500,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Code Changes

### 1. Supabase Service

We've updated the `supabase.ts` service to work with the new structure:

- Modified `createEmbeddings()` to:
  - Store the `user_id` inside the metadata field (critical for filtering)
  - Store the `queryName` inside the metadata field
  - Use `@>` operator compatible with n8n's filter expectations

- Modified `deleteEmbeddings()` to:
  - Use `metadata @> {"user_id": "..."}` filter format
  - Add query_name to the filter JSON when provided
  - Use the `@>` containment operator as expected by n8n

- Updated `saveUserConfig()` and `getUserConfig()` to work with the user_configs table

### 2. AgentSetupPage

- No UI changes needed, just updates to use the metadata-based approach
- Now includes user_id in the metadata for filtering

### 3. AutomationsPage

- No UI changes needed, just updates to use the metadata-based approach

## Benefits of the New Structure

1. **Complete n8n compatibility**: Exactly matches the structure n8n's Supabase Vector Store node expects
2. **Standard semantic search**: Uses industry standard metadata filtering with `@>` operator 
3. **Multi-tenancy support**: The structure properly supports filtering by user_id in the metadata
4. **Improved performance**: Using PostgreSQL's native JSONB filtering for fast lookups
5. **Works with n8n out of the box**: No custom configuration needed in n8n

## Using with n8n

To use with n8n's Supabase Vector Store node:

1. Configure as usual with your Supabase credentials
2. Select the `user_embeddings` table
3. Set content field to `content` and embedding field to `embedding`
4. To filter by user, use metadata filter with:
   ```
   {'user_id': 'YOUR_USER_ID'}
   ```

## Testing

After applying these changes, you should:

1. Run the SQL script to create the new table structures
2. Test the AgentSetupPage to ensure saving works correctly
3. Test the AutomationsPage to ensure updates work correctly
4. Verify the n8n integration using the Supabase Vector Store node
5. Check that semantic search continues to work in the application 