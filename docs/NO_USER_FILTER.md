# Using Supabase Vector Search Without User ID Filtering

If you want to search across all documents in your database without filtering by user ID, follow this guide.

## Step 1: Run the New SQL Functions

First, add these functions to your Supabase database by running the following SQL in the SQL Editor:

```sql
-- Create a version of match_documents that doesn't filter by user_id
-- This function will search across all documents regardless of user_id
CREATE OR REPLACE FUNCTION match_documents_no_filter(
  query_text TEXT,              -- The search query text
  match_count INT,              -- Number of results to return
  query_embedding TEXT DEFAULT NULL  -- Optional embedding if already generated
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
  match_threshold FLOAT := 0.7;  -- Default threshold
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

  -- Return matches using the provided embedding without user filtering
  RETURN QUERY
  SELECT
    user_embeddings.id,
    user_embeddings.user_id,
    user_embeddings.query_name,
    user_embeddings.content,
    1 - (user_embeddings.embedding <=> embedding_vector) AS similarity
  FROM user_embeddings
  WHERE 1 - (user_embeddings.embedding <=> embedding_vector) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Create a simpler version that returns recent documents without user filtering
CREATE OR REPLACE FUNCTION get_all_recent_documents(
  limit_count INT DEFAULT 10
)
RETURNS TABLE (
  id INT,
  user_id TEXT,
  query_name TEXT,
  content TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    user_embeddings.id,
    user_embeddings.user_id,
    user_embeddings.query_name,
    user_embeddings.content,
    user_embeddings.created_at
  FROM user_embeddings
  ORDER BY created_at DESC
  LIMIT limit_count;
END;
$$;
```

## Step 2: Using in n8n Workflows

### Option 1: Using the Standard Supabase Node

1. Add a **Supabase** node to your workflow (not the Vector Store one)
2. Configure the node:
   - Operation: "Execute Query"
   - Query:
   ```sql
   SELECT * FROM match_documents_no_filter(
     'your search query here',
     10,
     null
   );
   ```
   
   If you want to use a dynamic search query:
   ```sql
   SELECT * FROM match_documents_no_filter(
     '{{$json["searchQuery"]}}',
     10,
     null
   );
   ```

### Option 2: Using Vector Store Node Without User Filtering

For the Supabase Vector Store node:

1. Configure the Vector Store node:
   - Do NOT add a filter for user_id
   - Make sure your query is in the input field
   - Adjust the limit as needed (default 10)

2. If you're still not getting results, try a direct SQL approach using:
   ```sql
   SELECT * 
   FROM user_embeddings
   ORDER BY created_at DESC
   LIMIT 10;
   ```

## Step 3: Getting the Most Recent Documents

If you just want to retrieve recent documents without any similarity search:

```sql
SELECT * FROM get_all_recent_documents(10);
```

This will return the 10 most recent documents from all users.

## Testing Your Functions

To verify these functions are working properly:

1. Run a simple test query:
   ```sql
   SELECT * FROM match_documents_no_filter('test query', 5, null);
   ```

2. Check if you have any documents at all:
   ```sql
   SELECT COUNT(*) FROM user_embeddings;
   ```

3. Check if the vector search is working by running a direct query:
   ```sql
   SELECT id, content, 1 - (embedding <=> embedding) as similarity
   FROM user_embeddings
   LIMIT 5;
   ```

## Important Notes

1. Using no user filter means ALL documents will be searched, which might be slower with large datasets
2. Consider adding an index for better performance:
   ```sql
   CREATE INDEX IF NOT EXISTS user_embeddings_embedding_idx ON user_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
   ```
3. You can adjust the similarity threshold in the function for stricter or looser matching 