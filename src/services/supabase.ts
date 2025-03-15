import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabaseUrl = 'https://kutdbashpuuysxywvzgs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1dGRiYXNocHV1eXN4eXd2emdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwMDEyNjQsImV4cCI6MjA1NzU3NzI2NH0.sPX_kiCkssIG9v1AIoRbdlmnEL-7GCmm_MIxudJyVO8';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Enable browser usage
});

// Function to generate embeddings for a text
const generateEmbedding = async (text: string) => {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
};

// Function to save embeddings
const saveEmbeddings = async (uid: string, config: any) => {
  try {
    // Generate embeddings for relevant text content
    const embeddings = [];
    
    // Company info
    if (config.company_info) {
      // Ensure locations is an array
      const locations = Array.isArray(config.company_info.locations) 
        ? config.company_info.locations 
        : typeof config.company_info.locations === 'string'
          ? config.company_info.locations.split(',').map(s => s.trim())
          : [];

      const companyText = `
        Business Name: ${config.company_info.business_name || ''}
        Industry: ${config.company_info.industry || ''}
        Locations: ${locations.join(', ')}
        Differentiators: ${config.company_info.differentiators || ''}
      `.trim();

      if (companyText.length > 0) {
        const embedding = await generateEmbedding(companyText);
        embeddings.push({
          content: companyText,
          embedding,
          metadata: { type: 'company_info' }
        });
      }
    }

    // Scenarios
    if (config.scenarios) {
      const scenariosText = `
        Common Scenarios: ${config.scenarios.common_scenarios || ''}
        Scenario Responses: ${config.scenarios.scenario_responses || ''}
      `.trim();

      if (scenariosText.length > 0) {
        const embedding = await generateEmbedding(scenariosText);
        embeddings.push({
          content: scenariosText,
          embedding,
          metadata: { type: 'scenarios' }
        });
      }
    }

    // Save embeddings to Supabase
    if (embeddings.length > 0) {
      console.log('Saving embeddings:', embeddings); // Debug log
      const { error } = await supabase
        .from(`${uid}_embeddings`)
        .insert(embeddings);

      if (error) {
        console.error('Error inserting embeddings:', error); // Debug log
        throw new Error(`Failed to save embeddings: ${error.message}`);
      }
    }
  } catch (error) {
    console.error('Error in saveEmbeddings:', error);
    throw error;
  }
};

// Function to create a new user table
export const createUserTable = async (uid: string) => {
  try {
    // Create the table using raw SQL with policy cleanup
    const { error: createError } = await supabase.rpc('execute_sql', {
      sql_query: `
        -- Drop existing policies if they exist
        DO $$ 
        BEGIN
          -- Drop policies for main table if they exist
          IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = '${uid}') THEN
            DROP POLICY IF EXISTS "${uid}_policy" ON "${uid}";
          END IF;

          -- Drop policies for embeddings table if they exist
          IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = '${uid}_embeddings') THEN
            DROP POLICY IF EXISTS "${uid}_embeddings_policy" ON "${uid}_embeddings";
          END IF;
        END $$;

        -- Create tables if they don't exist
        CREATE TABLE IF NOT EXISTS "${uid}" (
          id SERIAL PRIMARY KEY,
          company_info JSONB,
          roles JSONB,
          communication_style JSONB,
          scenarios JSONB,
          knowledge_base JSONB,
          compliance_rules JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Create trigger for updating timestamps
        DROP TRIGGER IF EXISTS update_${uid}_timestamp ON "${uid}";
        CREATE TRIGGER update_${uid}_timestamp
        BEFORE UPDATE ON "${uid}"
        FOR EACH ROW
        EXECUTE FUNCTION update_timestamp();

        -- Create embeddings table
        CREATE TABLE IF NOT EXISTS "${uid}_embeddings" (
          id SERIAL PRIMARY KEY,
          content TEXT,
          embedding vector(1536),
          metadata JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Create index for vector similarity search
        DROP INDEX IF EXISTS ${uid}_embeddings_idx;
        CREATE INDEX IF NOT EXISTS ${uid}_embeddings_idx 
        ON "${uid}_embeddings"
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);

        -- Enable RLS
        ALTER TABLE "${uid}" ENABLE ROW LEVEL SECURITY;
        ALTER TABLE "${uid}_embeddings" ENABLE ROW LEVEL SECURITY;

        -- Create unified policies that allow all operations based on table name
        CREATE POLICY "${uid}_policy" ON "${uid}"
          FOR ALL
          USING (true)
          WITH CHECK (true);

        CREATE POLICY "${uid}_embeddings_policy" ON "${uid}_embeddings"
          FOR ALL
          USING (true)
          WITH CHECK (true);
      `
    });

    if (createError) throw new Error(`Failed to create tables: ${createError.message}`);
  } catch (error) {
    console.error('Error in createUserTable:', error);
    throw error;
  }
};

// Function to save user configuration
export const saveUserConfig = async (uid: string, config: any) => {
  try {
    // Ensure proper data structure
    const formattedConfig = {
      ...config,
      company_info: {
        ...config.company_info,
        locations: Array.isArray(config.company_info?.locations)
          ? config.company_info.locations
          : typeof config.company_info?.locations === 'string'
            ? config.company_info.locations.split(',').map(s => s.trim())
            : []
      }
    };

    const { error } = await supabase
      .from(uid)
      .insert([formattedConfig]);
    
    if (error) {
      if (error.code === '42P01') {
        // Table doesn't exist, try to create it first
        await createUserTable(uid);
        // Try insert again
        const { error: retryError } = await supabase
          .from(uid)
          .insert([formattedConfig]);
        if (retryError) throw new Error(`Failed to save config: ${retryError.message}`);
      } else {
        throw new Error(`Failed to save config: ${error.message}`);
      }
    }

    console.log('Config saved successfully, generating embeddings...'); // Debug log
    // Generate and save embeddings
    await saveEmbeddings(uid, formattedConfig);
    console.log('Embeddings saved successfully'); // Debug log
  } catch (error) {
    console.error('Error in saveUserConfig:', error);
    throw error;
  }
};

// Function to get user configuration
export const getUserConfig = async (uid: string) => {
  try {
    const { data, error } = await supabase
      .from(uid)
      .select('*')
      .order('id', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      if (error.code === '42P01') {
        // Table doesn't exist yet
        return null;
      }
      throw new Error(`Failed to get config: ${error.message}`);
    }
    return data;
  } catch (error) {
    console.error('Error in getUserConfig:', error);
    throw error;
  }
};

// Function to update user configuration
export const updateUserConfig = async (uid: string, id: number, updates: any) => {
  try {
    // First update the main configuration
    const { error } = await supabase
      .from(uid)
      .update(updates)
      .eq('id', id);
    
    if (error) throw new Error(`Failed to update config: ${error.message}`);

    // Delete existing embeddings
    const { error: deleteError } = await supabase
      .from(`${uid}_embeddings`)
      .delete()
      .neq('id', 0); // This will delete all rows

    if (deleteError) throw new Error(`Failed to delete old embeddings: ${deleteError.message}`);

    // Generate and save new embeddings
    await saveEmbeddings(uid, updates);
  } catch (error) {
    console.error('Error in updateUserConfig:', error);
    throw error;
  }
}; 