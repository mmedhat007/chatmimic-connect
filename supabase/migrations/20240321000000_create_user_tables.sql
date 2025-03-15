-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS plpgsql;

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to execute dynamic SQL (needed for table creation)
CREATE OR REPLACE FUNCTION execute_sql(sql_query TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_query;
END;
$$;

-- Create the user configurations table
CREATE TABLE IF NOT EXISTS user_configurations (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  company_info JSONB,
  roles JSONB,
  communication_style JSONB,
  scenarios JSONB,
  knowledge_base JSONB,
  compliance_rules JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create trigger for updating timestamps
CREATE TRIGGER update_user_config_timestamp
  BEFORE UPDATE ON user_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

-- Create the embeddings table
CREATE TABLE IF NOT EXISTS user_embeddings (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  content TEXT,
  embedding vector(1536),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES user_configurations(user_id) ON DELETE CASCADE
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS user_embeddings_embedding_idx 
ON user_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Enable Row Level Security (RLS)
ALTER TABLE user_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_embeddings ENABLE ROW LEVEL SECURITY;

-- Create policies for user_configurations table
CREATE POLICY "Users can view own configurations"
  ON user_configurations
  FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own configurations"
  ON user_configurations
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own configurations"
  ON user_configurations
  FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- Create policies for user_embeddings table
CREATE POLICY "Users can view own embeddings"
  ON user_embeddings
  FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own embeddings"
  ON user_embeddings
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own embeddings"
  ON user_embeddings
  FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own embeddings"
  ON user_embeddings
  FOR DELETE
  USING (auth.uid()::text = user_id);

-- Create function to generate embeddings using OpenAI
CREATE OR REPLACE FUNCTION generate_embeddings(content TEXT)
RETURNS vector
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  embedding vector(1536);
  api_key TEXT := current_setting('app.settings.openai_key');
BEGIN
  SELECT INTO embedding
    (
      SELECT json_array_elements_text(
        (response->>'data')::json->0->>'embedding'
      )::float8[]::vector
      FROM (
        SELECT
          net.http_post(
            'https://api.openai.com/v1/embeddings',
            json_build_object(
              'input', content,
              'model', 'text-embedding-3-small'
            )::text,
            NULL,
            ARRAY[
              net.http_header('Authorization', 'Bearer ' || api_key),
              net.http_header('Content-Type', 'application/json')
            ]
          ) AS response
      ) AS http_response
    );
  
  RETURN embedding;
END;
$$; 