-- Manual n8n Compatibility Setup SQL
-- Copy this entire file and execute it in the Supabase SQL Editor
-- if you prefer not to use the automated script

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create the timestamp update function
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the user_embeddings table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_embeddings (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  content TEXT, -- corresponds to Document.pageContent
  metadata JSONB, -- corresponds to Document.metadata
  embedding VECTOR(1536), -- 1536 works for OpenAI embeddings
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on user_id for filtering
CREATE INDEX IF NOT EXISTS user_embeddings_user_id_idx ON user_embeddings(user_id);

-- Create an index for vector similarity search
CREATE INDEX IF NOT EXISTS user_embeddings_embedding_idx ON user_embeddings
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Set the trigger for user_embeddings
DROP TRIGGER IF EXISTS update_user_embeddings_timestamp ON user_embeddings;
CREATE TRIGGER update_user_embeddings_timestamp
BEFORE UPDATE ON user_embeddings
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- First, drop existing match_documents functions to avoid conflicts
DROP FUNCTION IF EXISTS match_documents(vector, integer, jsonb);
DROP FUNCTION IF EXISTS match_documents(text, integer, text);
DROP FUNCTION IF EXISTS match_documents(vector, integer, text);
DROP FUNCTION IF EXISTS match_documents_with_embedding;

-- Create the match_documents function with EXACTLY the signature n8n expects
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
language plpgsql
as $$
#variable_conflict use_column
begin
  return query
  select
    id,
    content,
    metadata,
    1 - (user_embeddings.embedding <=> query_embedding) as similarity
  from user_embeddings
  where metadata @> filter
  order by user_embeddings.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Create a compatibility view that exactly matches the n8n expected structure
-- Note: This is just a VIEW that references the user_embeddings table - no separate physical table is created
CREATE OR REPLACE VIEW documents AS
  SELECT 
    id,
    content,
    metadata,
    embedding
  FROM user_embeddings;

-- Create a function specifically for our app's user filtering
CREATE OR REPLACE FUNCTION match_documents_by_user (
  query_embedding vector(1536),
  user_identifier text,
  match_count int default 5,
  similarity_threshold float default 0.7
) returns table (
  id bigint,
  user_id text,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    user_embeddings.id,
    user_embeddings.user_id,
    user_embeddings.content,
    user_embeddings.metadata,
    1 - (user_embeddings.embedding <=> query_embedding) as similarity
  from user_embeddings
  where 
    user_embeddings.user_id = user_identifier AND
    1 - (user_embeddings.embedding <=> query_embedding) > similarity_threshold
  order by similarity desc
  limit match_count;
end;
$$;

-- Match function for our application API
CREATE OR REPLACE FUNCTION match_documents_with_embedding (
  query_embedding vector(1536),
  similarity_threshold float,
  match_count int,
  user_id text
) returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    user_embeddings.id,
    user_embeddings.content,
    user_embeddings.metadata,
    1 - (user_embeddings.embedding <=> query_embedding) as similarity
  from user_embeddings
  where 
    user_embeddings.user_id = match_documents_with_embedding.user_id AND
    1 - (user_embeddings.embedding <=> query_embedding) > similarity_threshold
  order by similarity desc
  limit match_count;
end;
$$; 