# Troubleshooting Vector Search Issues

If you're experiencing issues with vector search not returning results even when you know matching data exists, follow these troubleshooting steps.

## Step 1: Verify Your Data Exists

First, check that you actually have data in your table:

```sql
-- Count all records
SELECT COUNT(*) FROM user_embeddings;

-- View a sample of records
SELECT id, user_id, query_name, content 
FROM user_embeddings 
LIMIT 5;
```

## Step 2: Try Direct Text Search

Instead of vector similarity search, try a basic text search to see if your documents can be found:

```sql
-- Run this SQL to check if your documents contain the text you're looking for
CREATE OR REPLACE FUNCTION text_search_documents(
  search_query TEXT,
  limit_count INT DEFAULT 10
)
RETURNS TABLE (
  id INT,
  user_id TEXT,
  query_name TEXT,
  content TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    user_embeddings.id,
    user_embeddings.user_id,
    user_embeddings.query_name,
    user_embeddings.content
  FROM user_embeddings
  WHERE 
    user_embeddings.content ILIKE '%' || search_query || '%' OR
    user_embeddings.query_name ILIKE '%' || search_query || '%'
  ORDER BY id DESC
  LIMIT limit_count;
END;
$$;

-- Then use it like this
SELECT * FROM text_search_documents('company information');
```

If this returns results but vector search doesn't, the issue is likely with the vector search configuration.

## Step 3: Lower or Remove Similarity Threshold

The vector search might not be returning results because the similarity threshold is too high. Try this modified function with NO threshold filter:

```sql
CREATE OR REPLACE FUNCTION match_documents_no_filter(
  query_text TEXT,
  match_count INT,
  query_embedding TEXT DEFAULT NULL
)
RETURNS TABLE (
  id INT,
  user_id TEXT,
  query_name TEXT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
  embedding_vector VECTOR(1536);
BEGIN
  -- Check if we have an embedding or need to generate one
  IF query_embedding IS NOT NULL AND query_embedding != '' THEN
    -- Try to convert the provided embedding string to a vector
    BEGIN
      embedding_vector := query_embedding::vector(1536);
    EXCEPTION WHEN OTHERS THEN
      -- If conversion fails, return empty result
      RETURN;
    END;
  ELSE
    -- Without an embedding, we can't do a similarity search
    -- Return up to match_count recent entries without user filtering
    RETURN QUERY
    SELECT
      user_embeddings.id,
      user_embeddings.user_id,
      user_embeddings.query_name,
      user_embeddings.content,
      1.0 AS similarity
    FROM user_embeddings
    ORDER BY id DESC
    LIMIT match_count;
    RETURN;
  END IF;

  -- Return matches using the provided embedding without user filtering and without threshold
  RETURN QUERY
  SELECT
    user_embeddings.id,
    user_embeddings.user_id,
    user_embeddings.query_name,
    user_embeddings.content,
    1 - (user_embeddings.embedding <=> embedding_vector) AS similarity
  FROM user_embeddings
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
```

Then run:
```sql
SELECT * FROM match_documents_no_filter('company information', 10, null);
```

This will return results sorted by similarity but without filtering by a threshold, so you'll see ALL documents with their similarity scores.

## Step 4: Check Embedding Generation

If you're still not getting expected results, the issue might be with embedding generation. Try a direct query on the vectors:

```sql
-- Check all embedding values to make sure they look reasonable
SELECT id, ARRAY_LENGTH(embedding, 1) as embedding_dimensions
FROM user_embeddings
LIMIT 5;

-- This should return 1536 for OpenAI embeddings
```

## Step 5: Try n8n with Direct SQL Instead of Vector Store Node

Use a standard Supabase node with a direct SQL query instead of the Vector Store node:

1. Add a Supabase node
2. Set operation to "Execute Query"
3. Use this query which avoids vector search completely:

```sql
SELECT * 
FROM user_embeddings
WHERE content ILIKE '%company%'
   OR query_name ILIKE '%company%'
ORDER BY id DESC
LIMIT 10;
```

## Step 6: Debug the Vector Store Node

If you're determined to use the Vector Store node:

1. Try with a very generic query like "the" which should match almost anything
2. Increase the limit to maximum
3. Check if there are any network errors in n8n logs
4. Try adding a Function node before the Vector Store node to log the parameters being passed

## Step 7: Check for JSON Format Issues

If your content is stored as JSON:

```sql
-- Test if your content is valid JSON
SELECT id, content, 
       (CASE WHEN is_json(content) THEN 'Valid JSON' ELSE 'Not JSON' END) as json_validity
FROM user_embeddings
LIMIT 10;

-- Create a helper function if needed
CREATE OR REPLACE FUNCTION is_json(text) RETURNS boolean AS $$
BEGIN
  RETURN (SELECT $1::json IS NOT NULL);
EXCEPTION
  WHEN others THEN RETURN false;
END;
$$ LANGUAGE plpgsql;
```

## Additional Solutions to Try

1. **Use PostgreSQL Full Text Search**: If vector search is problematic, consider falling back to PostgreSQL's built-in full-text search:

```sql
-- Add a tsvector column if you don't have one
ALTER TABLE user_embeddings ADD COLUMN IF NOT EXISTS content_search tsvector;

-- Update it
UPDATE user_embeddings 
SET content_search = to_tsvector('english', content);

-- Create an index
CREATE INDEX IF NOT EXISTS user_embeddings_content_search_idx ON user_embeddings USING GIN (content_search);

-- Query using full-text search
SELECT id, user_id, query_name, content
FROM user_embeddings
WHERE content_search @@ to_tsquery('english', 'company');
```

2. **Check for Special Characters**: If your query contains special characters, they might be causing issues with the vector search:

```sql
-- Try with a simplified query
SELECT * FROM match_documents_no_filter('company', 10, null);
```

## Last Resort: Get All Documents and Filter in n8n

If all else fails, you can fetch all documents and perform filtering in n8n using a Function node:

```javascript
// Example JavaScript function for n8n
return $input.item.json.map(item => {
  // Keep only items that contain 'company' in their content or query_name
  if (
    item.content.toLowerCase().includes('company') || 
    item.query_name.toLowerCase().includes('company')
  ) {
    return item;
  }
  return null;
}).filter(item => item !== null);
``` 