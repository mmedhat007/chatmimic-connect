-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create the user_configs table to store user configuration data
CREATE TABLE IF NOT EXISTS user_configs (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  temperature FLOAT DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 500,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS user_configs_user_id_idx ON user_configs(user_id);

-- Create a table to store your documents with user_id column
CREATE TABLE IF NOT EXISTS user_embeddings (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  content TEXT, -- corresponds to Document.pageContent
  metadata JSONB, -- corresponds to Document.metadata
  embedding VECTOR(1536) -- 1536 works for OpenAI embeddings
);

-- Create an index on user_id for filtering
CREATE INDEX IF NOT EXISTS user_embeddings_user_id_idx ON user_embeddings(user_id);

-- Create an index for vector similarity search
CREATE INDEX IF NOT EXISTS user_embeddings_embedding_idx ON user_embeddings
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Create a trigger to update the updated_at field on record changes
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Set the trigger for user_configs
CREATE TRIGGER update_user_configs_timestamp
BEFORE UPDATE ON user_configs
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Set the trigger for user_embeddings
CREATE TRIGGER update_user_embeddings_timestamp
BEFORE UPDATE ON user_embeddings
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Standard match_embeddings function for web app use
CREATE OR REPLACE FUNCTION match_embeddings(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT,
  user_identifier TEXT
)
RETURNS TABLE (
  id BIGINT,
  user_id TEXT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    user_embeddings.id,
    user_embeddings.user_id,
    user_embeddings.content,
    user_embeddings.metadata,
    1 - (user_embeddings.embedding <=> query_embedding) AS similarity
  FROM user_embeddings
  WHERE user_embeddings.user_id = user_identifier
  AND 1 - (user_embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- DROP existing match_documents functions to avoid conflicts
DROP FUNCTION IF EXISTS match_documents(vector, integer, jsonb);
DROP FUNCTION IF EXISTS match_documents(text, integer, text);
DROP FUNCTION IF EXISTS match_documents(text, integer, vector, double precision);

-- Create the match_documents function with EXACTLY the signature n8n expects
CREATE OR REPLACE FUNCTION match_documents (
  filter TEXT,
  match_count INT,
  query_embedding TEXT
) RETURNS TABLE (
  id BIGINT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
  embedding_vector VECTOR(1536);
  filter_json JSONB;
BEGIN
  -- Convert filter string to JSONB (empty object if invalid)
  BEGIN
    filter_json := filter::JSONB;
  EXCEPTION WHEN OTHERS THEN
    filter_json := '{}'::JSONB;
  END;

  -- Try to convert the provided embedding string to a vector
  IF query_embedding IS NOT NULL AND query_embedding != '' THEN
    BEGIN
      embedding_vector := query_embedding::VECTOR(1536);
    EXCEPTION WHEN OTHERS THEN
      -- If conversion fails, return empty result
      RETURN;
    END;
  
    -- Return vector search results
    RETURN QUERY
    SELECT
      user_embeddings.id, -- Explicitly qualify the id column
      user_embeddings.content, -- Explicitly qualify the content column
      user_embeddings.metadata, -- Explicitly qualify the metadata column
      1 - (user_embeddings.embedding <=> embedding_vector) AS similarity
    FROM user_embeddings
    WHERE user_embeddings.metadata @> filter_json -- Explicitly qualify the metadata column
    ORDER BY user_embeddings.embedding <=> embedding_vector
    LIMIT match_count;
  ELSE
    -- Without an embedding, return most recent entries
    RETURN QUERY
    SELECT
      user_embeddings.id, -- Explicitly qualify the id column
      user_embeddings.content, -- Explicitly qualify the content column
      user_embeddings.metadata, -- Explicitly qualify the metadata column
      0.0 AS similarity
    FROM user_embeddings
    WHERE user_embeddings.metadata @> filter_json -- Explicitly qualify the metadata column
    ORDER BY user_embeddings.id DESC
    LIMIT match_count;
  END IF;
END;
$$;

-- Simple text search function (fallback when embeddings not available)
CREATE OR REPLACE FUNCTION text_search_documents(
  search_query TEXT,
  user_id_filter TEXT DEFAULT NULL,
  limit_count INT DEFAULT 10
)
RETURNS TABLE (
  id BIGINT,
  user_id TEXT,
  content TEXT,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  IF user_id_filter IS NOT NULL AND user_id_filter != '' THEN
    -- With user_id filter
    RETURN QUERY
    SELECT
      user_embeddings.id,
      user_embeddings.user_id,
      user_embeddings.content,
      user_embeddings.metadata
    FROM user_embeddings
    WHERE 
      user_embeddings.user_id = user_id_filter AND
      user_embeddings.content ILIKE '%' || search_query || '%'
    ORDER BY user_embeddings.id DESC
    LIMIT limit_count;
  ELSE
    -- Without user_id filter
    RETURN QUERY
    SELECT
      user_embeddings.id,
      user_embeddings.user_id,
      user_embeddings.content,
      user_embeddings.metadata
    FROM user_embeddings
    WHERE 
      user_embeddings.content ILIKE '%' || search_query || '%'
    ORDER BY user_embeddings.id DESC
    LIMIT limit_count;
  END IF;
END;
$$;