-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create a function to create a table for a user
CREATE OR REPLACE FUNCTION create_user_table(uid TEXT)
RETURNS VOID AS $$
DECLARE
  table_exists BOOLEAN;
  table_name TEXT := uid;
BEGIN
  -- Check if the table already exists
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public'
    AND table_name = uid
  ) INTO table_exists;
  
  -- If the table doesn't exist, create it
  IF NOT table_exists THEN
    EXECUTE format('
      CREATE TABLE %I (
        id SERIAL PRIMARY KEY,
        company_info JSONB,
        roles JSONB,
        communication_style JSONB,
        scenarios JSONB,
        knowledge_base JSONB,
        compliance_rules JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )', table_name);
      
    -- Create embeddings table for the user
    EXECUTE format('
      CREATE TABLE %I_embeddings (
        id SERIAL PRIMARY KEY,
        content TEXT,
        embedding VECTOR(1536),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )', table_name);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to create embeddings for a user's content
CREATE OR REPLACE FUNCTION create_embeddings(uid TEXT, content TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  embedding_exists BOOLEAN;
  table_name TEXT := uid || '_embeddings';
  embedding_vector VECTOR(1536);
BEGIN
  -- Check if the embeddings table exists
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public'
    AND table_name = uid || '_embeddings'
  ) INTO embedding_exists;
  
  -- If the embeddings table doesn't exist, create it
  IF NOT embedding_exists THEN
    PERFORM create_user_table(uid);
  END IF;
  
  -- Generate embedding using OpenAI API
  -- This is a placeholder - in a real implementation, you would call the OpenAI API
  -- For now, we'll just insert a dummy vector
  embedding_vector := '{0}';
  
  -- Insert the content and embedding
  EXECUTE format('
    INSERT INTO %I (content, embedding)
    VALUES ($1, $2)
  ', table_name) USING content, embedding_vector;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to match documents using embeddings
CREATE OR REPLACE FUNCTION match_documents(uid TEXT, query_text TEXT)
RETURNS TABLE(content TEXT, similarity FLOAT) AS $$
DECLARE
  table_name TEXT := uid || '_embeddings';
  embedding_exists BOOLEAN;
  query_embedding VECTOR(1536);
BEGIN
  -- Check if the embeddings table exists
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public'
    AND table_name = uid || '_embeddings'
  ) INTO embedding_exists;
  
  -- If the embeddings table doesn't exist, return empty result
  IF NOT embedding_exists THEN
    RETURN;
  END IF;
  
  -- Generate embedding for the query using OpenAI API
  -- This is a placeholder - in a real implementation, you would call the OpenAI API
  -- For now, we'll just use a dummy vector
  query_embedding := '{0}';
  
  -- Return matching documents
  RETURN QUERY EXECUTE format('
    SELECT content, 1 - (embedding <=> $1) AS similarity
    FROM %I
    ORDER BY similarity DESC
    LIMIT 5
  ', table_name) USING query_embedding;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 