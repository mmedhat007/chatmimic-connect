# Simplified Supabase Setup Guide

This guide explains the simplified setup for ChatMimic Connect's database structure, which works with both the web app and n8n workflows.

## Overview

We've simplified the database structure to use a single SQL file that creates all necessary tables and functions. The key improvements are:

1. **Everything in one file**: Easier setup with a single SQL script
2. **Improved compatibility**: Works with both our web app and n8n Vector Store node
3. **Metadata support**: JSON metadata field for better filtering and organization
4. **Optimized for performance**: Includes appropriate indexes for faster queries

## Table Structure

### 1. `user_configs` table
Stores user configuration data for the agent:
- `id`: Primary key
- `user_id`: The Firebase UID of the user
- `temperature`: Default temperature setting
- `max_tokens`: Default max_tokens setting
- `created_at` and `updated_at`: Timestamp fields

### 2. `user_embeddings` table
Stores content and embeddings for semantic search, with the following structure:
- `id`: Primary key
- `user_id`: The Firebase UID of the user
- `content`: The actual text content
- `embedding`: Vector field for the OpenAI embedding
- `metadata`: JSONB field for additional metadata and filtering
- `created_at`: Timestamp field

This structure mirrors the standard `documents` table structure used by n8n's Supabase Vector Store node, with the addition of the `user_id` field for multi-tenancy.

## Setup Instructions

### Step 1: Run the SQL Script

1. Go to your Supabase dashboard
2. Navigate to the SQL Editor
3. Create a new query
4. Copy and paste the entire SQL script from `sql/migrations/000_clean_setup.sql`
5. Run the script

```sql
-- Run the SQL script from 000_clean_setup.sql
```

### Step 2: Test Your Setup

Run this query to verify your tables were created:

```sql
SELECT * FROM pg_tables 
WHERE tablename IN ('user_configs', 'user_embeddings');
```

## Using with n8n

The new structure works seamlessly with n8n's Supabase Vector Store node:

1. Configure the node:
   - **Table**: `user_embeddings`
   - **Content Field**: `content`
   - **Embedding Field**: `embedding`
   - **Metadata Field**: `metadata`

2. To filter by user, use a metadata filter:
   - Add `metadata` contains `{"user_id": "YOUR_USER_ID"}`

Alternatively, you can use the `match_documents` function directly through the Supabase node:

```sql
SELECT * FROM match_documents(
  'user_id=YOUR_USER_ID',  -- Filter for user_id
  5,                       -- Number of results
  null                     -- No pre-generated embedding
);
```

## Using in Your Code

The Supabase service in `src/services/supabase.ts` can be updated to work with the new structure. The main functions would be:

1. `createEmbeddings(uid, content, metadata)`: Creates embeddings with optional metadata
2. `updateEmbeddings(id, content, metadata)`: Updates embeddings
3. `deleteEmbeddings(id)`: Deletes embeddings by ID

## Comparing with Previous Setup

| Previous Structure | New Structure |
|-------------------|---------------|
| Multiple SQL files | Single SQL file |
| Complex table relationships | Simple, flat structure |
| n8n compatibility issues | Works with n8n out of the box |
| Limited filtering | Enhanced filtering options |
| Multiple functions | Streamlined functions |

## Important Notes

1. **Existing Data**: If you had data in the old structure, you may need to migrate it manually
2. **OpenAI API Key**: Required for generating embeddings, but the system will still work without it (just without vector search)
3. **Performance**: For large datasets, you may need to adjust the index settings 