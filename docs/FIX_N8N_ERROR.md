# Fixing "Could not find the function" Error in n8n

If you're encountering the error:

```
Error searching for documents: PGRST202 Could not find the function public.match_documents(filter, match_count, query_embedding) in the schema cache Searched for the function public.match_documents with parameters filter, match_count, query_embedding or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.
```

Follow these steps to resolve the issue:

## Step 1: Run the Fix Script

Connect to your Supabase dashboard and go to the SQL Editor. Create a new query and run the following SQL script:

```sql
-- Create a n8n-friendly version of the match_documents function
-- This function uses parameter names that match what n8n expects
CREATE OR REPLACE FUNCTION match_documents(
  filter TEXT,              -- This is the query text
  match_count INT,          -- Number of results to return
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
  user_id_value TEXT;
  match_threshold FLOAT := 0.7;  -- Default threshold
BEGIN
  -- Parse the filter to extract user_id
  -- The filter is expected to be in the format 'user_id=xyz'
  IF filter LIKE 'user_id=%' THEN
    user_id_value := substring(filter FROM 9);
  ELSE
    -- Fallback to using the whole filter as user_id
    user_id_value := filter;
  END IF;
  
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
    -- Return up to match_count recent entries for the user
    RETURN QUERY
    SELECT
      user_embeddings.id,
      user_embeddings.user_id,
      user_embeddings.query_name,
      user_embeddings.content,
      1.0 AS similarity
    FROM user_embeddings
    WHERE user_embeddings.user_id = user_id_value
    ORDER BY id DESC
    LIMIT match_count;
    RETURN;
  END IF;

  -- Return matches using the provided embedding
  RETURN QUERY
  SELECT
    user_embeddings.id,
    user_embeddings.user_id,
    user_embeddings.query_name,
    user_embeddings.content,
    1 - (user_embeddings.embedding <=> embedding_vector) AS similarity
  FROM user_embeddings
  WHERE user_embeddings.user_id = user_id_value
  AND 1 - (user_embeddings.embedding <=> embedding_vector) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Create a simpler version that just returns the most recent entries
CREATE OR REPLACE FUNCTION get_recent_documents(
  user_id_param TEXT,  -- Parameter name changed to avoid conflict with column name
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
  WHERE user_embeddings.user_id = user_id_param
  ORDER BY created_at DESC
  LIMIT limit_count;
END;
$$;
```

## Step 2: Update Your n8n Workflow

Now, modify your n8n Supabase node to use the correct parameter format:

1. In your n8n workflow, open the Supabase node that's giving the error
2. Set the operation to "Execute Query"
3. Update your query to:

```sql
SELECT * FROM match_documents(
  'user_id=your_firebase_uid_here',
  5,
  null
);
```

Or use the dynamic version with variables:

```sql
SELECT * FROM match_documents(
  'user_id={{$json["userId"]}}',
  5,
  null
);
```

## Step 3: Test Your Workflow

1. Make sure you have some data in your `user_embeddings` table for the specified user ID
2. Run your workflow and check if it successfully retrieves documents

## Step 4: Alternative Approach (If Still Having Issues)

If you're still having trouble with the `match_documents` function, you can use a simpler direct query:

```sql
SELECT * FROM get_recent_documents('your_firebase_uid_here', 10);
```

Or, for a direct query on the table:

```sql
SELECT * 
FROM user_embeddings
WHERE user_id = '{{$json["userId"]}}'
ORDER BY created_at DESC
LIMIT 5;
```

## Troubleshooting Common Issues

1. **Wrong parameter order**: Make sure your parameters match exactly (filter, match_count, query_embedding)
2. **No data in the table**: Check if there are records in the `user_embeddings` table for your user
3. **Incorrect user ID format**: Make sure your user ID is correctly formatted
4. **Database permissions**: Ensure the Supabase service role has appropriate permissions
5. **Parameter name conflicts**: In Postgres functions, parameter names shouldn't conflict with column names in the return table

## Need More Help?

If you're still encountering issues:

1. Check if the functions exist in your database:
   ```sql
   SELECT * FROM pg_proc WHERE proname = 'match_documents';
   ```

2. Verify that your user has records in the database:
   ```sql
   SELECT COUNT(*) FROM user_embeddings WHERE user_id = 'your_firebase_uid_here';
   ```

3. Try running a test query directly in the Supabase SQL editor before using it in n8n. 