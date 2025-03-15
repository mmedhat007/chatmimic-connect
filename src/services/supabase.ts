import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Initialize Supabase client
const supabaseUrl = 'https://kutdbashpuuysxywvzgs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1dGRiYXNocHV1eXN4eXd2emdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwMDEyNjQsImV4cCI6MjA1NzU3NzI2NH0.sPX_kiCkssIG9v1AIoRbdlmnEL-7GCmm_MIxudJyVO8';
export const supabase = createClient(supabaseUrl, supabaseKey);

// OpenAI API configuration
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';
const OPENAI_API_URL = 'https://api.openai.com/v1/embeddings';

// Create a table for a user if it doesn't exist
export const createUserTable = async (uid: string) => {
  try {
    // Try to query the table to see if it exists
    const { error: queryError } = await supabase
      .from(uid)
      .select('id')
      .limit(1);
    
    // If we get a specific error about the relation not existing, we need to create it
    if (queryError && queryError.code === '42P01') {
      console.log(`Table ${uid} doesn't exist. Creating it...`);
      
      try {
        // Try to call the Edge Function to create the table
        console.log("Calling Edge Function to create tables for user:", uid);
        const { error } = await supabase.functions.invoke('create-tables', {
          body: { uid }
        });
        
        if (error) {
          console.error('Error calling Edge Function to create tables:', error);
          
          // Fallback: Try to create the table directly with SQL
          console.log("Fallback: Creating tables directly with SQL");
          const { error: sqlError } = await supabase.rpc('exec_sql', {
            sql: `
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
              
              CREATE TABLE IF NOT EXISTS "${uid}_embeddings" (
                id SERIAL PRIMARY KEY,
                content TEXT,
                embedding VECTOR(1536),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
              );
              
              CREATE TABLE IF NOT EXISTS "${uid}_whatsapp_config" (
                id SERIAL PRIMARY KEY,
                phone_number_id TEXT,
                whatsapp_business_account_id TEXT,
                access_token TEXT,
                verify_token TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
              );
            `
          });
          
          if (sqlError) {
            console.error('Error creating tables with SQL:', sqlError);
            return false;
          }
        }
      } catch (edgeFunctionError) {
        console.error('Exception calling Edge Function:', edgeFunctionError);
        return false;
      }
      
      // Wait a moment for the tables to be created
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return true;
    }
    
    // If we get here, either the table exists or we got a different error
    // In either case, we'll assume the table exists and proceed
    return true;
  } catch (error) {
    console.error('Error in createUserTable:', error);
    return false;
  }
};

// Save agent configuration to Supabase
export const saveAgentConfig = async (
  uid: string, 
  config: {
    company_info: any;
    roles: any;
    communication_style: any;
    scenarios: any;
    knowledge_base: any;
    compliance_rules: any;
  }
) => {
  try {
    // Try to insert the data
    const { error } = await supabase
      .from(uid)
      .insert([{
        company_info: config.company_info,
        roles: config.roles,
        communication_style: config.communication_style,
        scenarios: config.scenarios,
        knowledge_base: config.knowledge_base,
        compliance_rules: config.compliance_rules
      }]);
    
    // If we get a specific error about the relation not existing, return false
    if (error && error.code === '42P01') {
      console.log(`Table ${uid} doesn't exist. Please contact support.`);
      return false;
    }
    
    // If we get a different error, log it and return false
    if (error) {
      console.error('Error saving agent config:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in saveAgentConfig:', error);
    return false;
  }
};

// Get agent configuration from Supabase
export const getAgentConfig = async (uid: string) => {
  try {
    // Try to query the table
    const { data, error } = await supabase
      .from(uid)
      .select('*')
      .order('id', { ascending: false })
      .limit(1);
    
    // If we get a specific error about the relation not existing, return null
    if (error && error.code === '42P01') {
      console.log(`Table ${uid} doesn't exist.`);
      return null;
    }
    
    // If we get a different error, log it and return null
    if (error) {
      console.error('Error getting agent config:', error);
      return null;
    }
    
    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error('Error in getAgentConfig:', error);
    return null;
  }
};

// Create embeddings for the knowledge base
export const createEmbeddings = async (uid: string, content: string) => {
  try {
    // Call OpenAI API to generate embeddings
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: "text-embedding-3-small",
        input: content,
        encoding_format: "float"
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        }
      }
    );

    const embedding = response.data.data[0].embedding;
    
    // Store the embedding in Supabase
    const { error } = await supabase
      .from(`${uid}_embeddings`)
      .insert([
        {
          content: content,
          embedding: embedding
        }
      ]);
    
    if (error) {
      console.error('Error storing embedding:', error);
      return false;
    }
    
    console.log(`Created embeddings for ${uid} with content: ${content.substring(0, 50)}...`);
    return true;
  } catch (error) {
    console.error('Error in createEmbeddings:', error);
    return false;
  }
};

// Match documents using embeddings
export const matchDocuments = async (uid: string, query: string) => {
  try {
    // Generate embedding for the query
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: "text-embedding-3-small",
        input: query,
        encoding_format: "float"
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        }
      }
    );

    const queryEmbedding = response.data.data[0].embedding;
    
    // Search for similar embeddings in Supabase
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: 5,
      table_name: `${uid}_embeddings`
    });
    
    if (error) {
      console.error('Error matching documents:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in matchDocuments:', error);
    return [];
  }
};

// Update agent configuration
export const updateAgentConfig = async (
  uid: string,
  id: number,
  updates: Partial<{
    company_info: any;
    roles: any;
    communication_style: any;
    scenarios: any;
    knowledge_base: any;
    compliance_rules: any;
  }>
) => {
  try {
    // Try to insert a new record regardless of whether the table exists
    // If the table doesn't exist, this will fail with a specific error
    const { error: insertError } = await supabase
      .from(uid)
      .insert([updates]);
    
    if (insertError) {
      // If we get a specific error about the relation not existing, we need to handle it
      if (insertError.code === '42P01') {
        console.error(`Table ${uid} doesn't exist. Please contact support.`);
        return false;
      }
      
      console.error('Error inserting new agent config:', insertError);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in updateAgentConfig:', error);
    return false;
  }
}; 