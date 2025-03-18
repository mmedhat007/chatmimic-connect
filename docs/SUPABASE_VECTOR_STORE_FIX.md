# Configuring the Supabase Vector Store Node in n8n

If you're having issues with the Supabase Vector Store node not returning results, here are some ways to fix it:

## Option 1: Use Direct SQL Query (Recommended)

Instead of using the Supabase Vector Store node, use the regular Supabase node with a SQL query:

1. Add a **Supabase** node to your workflow (not the Vector Store one)
2. Configure the node:
   - Operation: "Execute Query"
   - Query:
   ```sql
   SELECT * FROM match_documents(
     'user_id=YOUR_USER_ID',
     5,
     null
   );
   ```
   
   Replace `YOUR_USER_ID` with your actual user ID or use a dynamic value:
   ```sql
   SELECT * FROM match_documents(
     'user_id={{$json["userId"]}}',
     5,
     null
   );
   ```

## Option 2: Fix the Vector Store Node Configuration

If you want to continue using the Vector Store node:

1. Make sure you have data in your `user_embeddings` table first:
   ```sql
   SELECT * FROM user_embeddings LIMIT 10;
   ```

2. In the Vector Store node:
   - Try adding a filter option with the key "user_id" and your user ID as value
   - Make sure the embedding generation is properly configured
   - Reduce the similarity threshold if you're using one
   - Try increasing the limit to see if any results appear

## Option 3: Use a Simpler Query

If you're still having trouble, use a direct SQL query without vector search:

```sql
SELECT * FROM get_recent_documents('YOUR_USER_ID', 10);
```

Or even simpler:

```sql
SELECT * 
FROM user_embeddings
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 10;
```

## Checking Your Data

Before trying any of these approaches, verify that you have data in your table:

1. Go to Supabase SQL Editor
2. Run:
   ```sql
   SELECT * FROM user_embeddings LIMIT 10;
   ```

3. Check if you have records with your user ID:
   ```sql
   SELECT COUNT(*) FROM user_embeddings WHERE user_id = 'YOUR_USER_ID';
   ```

## Regarding Multiple Versions of Functions

It's okay to have both the old and new `match_documents` functions as long as:

1. The parameter names and types are different (which they are in our case)
2. You're calling the correct version in your workflow

PostgreSQL supports function overloading, meaning you can have multiple functions with the same name but different parameter signatures. The database will choose the appropriate function based on the parameters you provide. 