# Supabase Troubleshooting Guide

This document provides solutions for common issues encountered with Supabase integration in ChatMimic Connect.

## Connection Issues

### Authentication Failed

**Issue**: "Authentication failed for Supabase" or "Invalid API key"  
**Solution**: 
- Verify your Supabase URL and API key in the environment variables
- Check for trailing spaces or typos in the credentials
- Ensure you're using the correct API key type (anon key vs service role key)

**Issue**: "JWT verification failed"  
**Solution**: 
- Check if your JWT secret is properly configured
- Verify the token expiration time
- Ensure the JWT payload structure matches Supabase expectations

## Database Configuration

### PgVector Extension Missing

**Issue**: "Error: extension 'vector' does not exist"  
**Solution**: 
1. Navigate to Supabase SQL Editor
2. Run the following SQL:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. Check if the extension is enabled via:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'vector';
   ```

### Table Creation Failures

**Issue**: "Error creating user tables"  
**Solution**: 
- Check if you have the necessary permissions to create tables
- Verify that the `create_user_table` function exists and is correctly defined
- Check for SQL syntax errors in the table creation function

## Vector Embeddings

### Embedding Generation Failures

**Issue**: "Failed to generate embeddings" with OpenAI API error  
**Solution**: 
- Verify your OpenAI API key is valid and has sufficient credits
- Check that you're using a supported embedding model (e.g., text-embedding-3-small)
- Ensure the input text is not empty and is within token limits

### Vector Search Not Working

**Issue**: "Vector similarity search returns no results"  
**Solution**: 
- Verify that embeddings are correctly stored in the database
- Check that the match threshold isn't too high (try 0.7 as a starting point)
- Ensure the `match_documents` function is correctly defined
- Check that the query embedding has the same dimensions as stored embeddings

**Issue**: "ERROR: function match_documents does not exist"  
**Solution**: 
1. Check if the function exists:
   ```sql
   SELECT * FROM pg_proc WHERE proname = 'match_documents';
   ```
2. If it doesn't exist, create it using the script provided in the Vector Store Integration documentation

## Performance Issues

### Slow Vector Searches

**Issue**: "Vector similarity search is slow"  
**Solution**: 
- Check if indices are properly created on the embedding column
- Consider optimizing the index for your data size:
   ```sql
   CREATE INDEX ON user_embeddings_YOUR_USER_ID 
   USING ivfflat (embedding vector_cosine_ops)
   WITH (lists = 100);
   ```
- Limit the number of results returned (e.g., LIMIT 5)

### Database Connection Pool Exhaustion

**Issue**: "Too many database connections" or "Connection pool exhausted"  
**Solution**: 
- Implement proper connection pooling in your application
- Close database connections after use
- Consider increasing the connection limit in your Supabase settings

## Data Issues

### Missing User Tables

**Issue**: "Table doesn't exist for user"  
**Solution**: 
1. Check if tables are created for the user:
   ```sql
   SELECT * FROM information_schema.tables 
   WHERE table_name LIKE 'user_table_%' OR table_name LIKE 'user_embeddings_%';
   ```
2. If missing, ensure the `create_user_table` function is called during user onboarding
3. Manually create tables if necessary:
   ```sql
   SELECT create_user_table('your-user-id');
   ```

### Data Not Saving

**Issue**: "Data not saving to Supabase"  
**Solution**: 
- Check for SQL errors in the Supabase logs
- Verify that the data structure matches the table schema
- Check for unique constraint violations
- Ensure RLS policies are not blocking the operation

## Row Level Security (RLS) Issues

### Unauthorized Access

**Issue**: "User can access other users' data"  
**Solution**: 
1. Enable RLS on your tables:
   ```sql
   ALTER TABLE user_table_YOUR_USER_ID ENABLE ROW LEVEL SECURITY;
   ALTER TABLE user_embeddings_YOUR_USER_ID ENABLE ROW LEVEL SECURITY;
   ```
2. Create appropriate policies:
   ```sql
   CREATE POLICY "Users can only access their own data"
   ON user_table_YOUR_USER_ID
   USING (auth.uid() = 'YOUR_USER_ID');
   ```

### Too Restrictive Policies

**Issue**: "User cannot access their own data"  
**Solution**: 
- Check existing RLS policies and their conditions
- Temporarily disable RLS for debugging:
   ```sql
   ALTER TABLE user_table_YOUR_USER_ID DISABLE ROW LEVEL SECURITY;
   ```
- Ensure your application code is sending the correct authentication headers

## PostgreSQL Function Issues

### SQL Function Errors

**Issue**: "Error calling PostgreSQL function"  
**Solution**: 
- Check the PostgreSQL function definition for syntax errors
- Verify function parameter types match what's being passed
- Check that the function has appropriate permissions (SECURITY DEFINER)

### Function Parameter Issues

**Issue**: "Wrong parameter type in function call"  
**Solution**: 
- Ensure vector embeddings are being passed as arrays, not strings
- Check that numeric parameters (threshold, limit) are numbers, not strings
- Verify that table names are correctly passed as strings

## Recovery Steps

If you're having persistent issues with the Supabase integration:

### Reset User Tables

To recreate user tables:
```sql
-- Drop existing tables
DROP TABLE IF EXISTS user_table_YOUR_USER_ID;
DROP TABLE IF EXISTS user_embeddings_YOUR_USER_ID;

-- Recreate tables
SELECT create_user_table('YOUR_USER_ID');
```

### Rebuild Vector Indices

If vector search performance degrades:
```sql
-- Rebuild vector index
REINDEX INDEX user_embeddings_YOUR_USER_ID_embedding_idx;
```

### Complete Reset

For a complete reset of your Supabase configuration:

1. Back up important data
2. Drop all user-specific tables
3. Recreate the pgvector extension
4. Redefine SQL functions
5. Recreate tables for each user

## Getting Support

If you continue to experience issues:

1. Check the Supabase logs in the Supabase dashboard
2. Enable detailed logging by setting `log_statement = 'all'` in PostgreSQL configuration
3. Contact Supabase support with specific error messages
4. Reach out to ChatMimic Connect support with database diagnostics 