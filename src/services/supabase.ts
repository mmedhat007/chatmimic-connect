import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://kutdbashpuuysxywvzgs.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1dGRiYXNocHV1eXN4eXd2emdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MjAwMTI2NCwiZXhwIjoyMDU3NTc3MjY0fQ.nU4SxBAAIZdXOihfS0Uo_uFd_QYVtRj9I0VYx00fIOU';

// OpenAI configuration
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';

// Initialize Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize OpenAI client with dangerouslyAllowBrowser set to true
// Note: In a production environment, embedding generation should be done server-side
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Adding this to fix the browser environment error
});

// Utility to check if OpenAI embeddings are working
export const checkEmbeddingsAvailable = async (): Promise<boolean> => {
  if (!OPENAI_API_KEY) {
    console.warn('OpenAI API key is not set');
    return false;
  }
  
  try {
    // Try to generate a simple embedding to see if it works
    const testResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: "test",
    });
    
    return !!testResponse.data[0].embedding;
  } catch (error) {
    console.warn('OpenAI embeddings test failed:', error);
    return false;
  }
};

// Function to create or get user table
export const ensureUserTable = async (uid: string): Promise<boolean> => {
  try {
    // Check if user's table exists
    const { data, error } = await supabase
      .from('user_configs')
      .select('id')
      .eq('user_id', uid)
      .maybeSingle();

    if (error) {
      console.error('Error checking user table:', error);
      return false;
    }

    // If user doesn't exist in the table, create a new record
    if (!data) {
      const { error: insertError } = await supabase
        .from('user_configs')
        .insert({ 
          user_id: uid,
          temperature: 0.7,
          max_tokens: 500
        });

      if (insertError) {
        console.error('Error creating user record:', insertError);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error in ensureUserTable:', error);
    return false;
  }
};

// Function to save user configuration
export const saveUserConfig = async (uid: string, config: any): Promise<boolean> => {
  try {
    // Ensure user table exists
    const tableExists = await ensureUserTable(uid);
    if (!tableExists) return false;

    // Extract temperature and max_tokens from the config, or use defaults
    const temperature = config.communication_style?.tone === 'enthusiastic' ? 0.8 : 0.7;
    const max_tokens = config.communication_style?.response_length === 'long' ? 800 : 
                       (config.communication_style?.response_length === 'short' ? 300 : 500);

    // Update the user's configuration with the values we have in the table
    const { error } = await supabase
      .from('user_configs')
      .update({ 
        temperature: temperature,
        max_tokens: max_tokens
      })
      .eq('user_id', uid);

    if (error) {
      console.error('Error saving user config:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in saveUserConfig:', error);
    return false;
  }
};

// Function to get user configuration
export const getUserConfig = async (uid: string): Promise<any> => {
  try {
    const { data, error } = await supabase
      .from('user_configs')
      .select('temperature, max_tokens')
      .eq('user_id', uid)
      .maybeSingle();

    if (error) {
      console.error('Error getting user config:', error);
      return null;
    }

    // Return the config in the format the app expects
    // For now, we'll create a default structure and just set the temperature and max_tokens
    const config = {
      company_info: {
        name: 'Your Business',
        industry: '',
        locations: [],
        contact_info: '',
        differentiators: ''
      },
      services: {
        main_offerings: [],
        pricing_info: '',
        delivery_areas: [],
        special_features: []
      },
      communication_style: {
        tone: data?.temperature > 0.75 ? 'enthusiastic' : 'friendly',
        languages: ['English'],
        emoji_usage: true,
        response_length: data?.max_tokens > 600 ? 'long' : 
                        (data?.max_tokens < 400 ? 'short' : 'medium')
      },
      business_processes: {
        booking_process: '',
        refund_policy: '',
        common_questions: [],
        special_requirements: []
      },
      integrations: {
        current_tools: [],
        required_integrations: [],
        automation_preferences: '',
        lead_process: ''
      }
    };

    return config;
  } catch (error) {
    console.error('Error in getUserConfig:', error);
    return null;
  }
};

// Function to create embeddings
export const createEmbeddings = async (uid: string, content: string, queryName: string = null, additionalMetadata = {}): Promise<boolean> => {
  try {
    // Check if the OpenAI API key is set
    const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;
    
    // Prepare metadata - include queryName and user_id in metadata
    const metadata: Record<string, any> = {
      ...additionalMetadata,
      user_id: uid // Store user_id in metadata for filtering with @> operator
    };
    
    // Add queryName to metadata if provided
    if (queryName) {
      metadata.query_name = queryName;
    }
    
    if (!openaiApiKey) {
      console.warn('OpenAI API key not set, skipping embedding generation');
      
      // Still insert the record, but without embeddings
      const { error } = await supabase
        .from('user_embeddings')
        .insert({
          user_id: uid,
          content: content,
          metadata: metadata,
          embedding: null
        });
        
      if (error) {
        console.error('Error saving record without embedding:', error);
        return false;
      }
      
      return true;
    }

    try {
      // Generate embeddings using OpenAI
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: content,
      });

      const embedding = embeddingResponse.data[0].embedding;

      // Store the embedding in Supabase
      const { error } = await supabase
        .from('user_embeddings')
        .insert({
          user_id: uid,
          content: content,
          metadata: metadata, // Store user_id and other metadata
          embedding: embedding
        });

      if (error) {
        console.error('Error saving embedding:', error);
        return true; // Still return true to not block the user flow
      }

      return true;
    } catch (embeddingError) {
      console.error('Error generating embedding with OpenAI:', embeddingError);
      // Return true anyway to not block the user's flow when embeddings fail
      return true;
    }
  } catch (error) {
    console.error('Error creating embeddings:', error);
    // Return true anyway to not block the user's flow when embeddings fail
    return true;
  }
};

// Function to delete embeddings
export const deleteEmbeddings = async (uid: string, queryName: string = null): Promise<boolean> => {
  try {
    // Build filter JSON object
    const filterJson: Record<string, any> = {
      user_id: uid
    };
    
    // Add query_name to filter if provided
    if (queryName) {
      filterJson.query_name = queryName;
    }
    
    // Use the @> operator with filter JSON
    const { error } = await supabase
      .from('user_embeddings')
      .delete()
      .filter('metadata', '@>', JSON.stringify(filterJson));

    if (error) {
      console.error('Error deleting embeddings:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteEmbeddings:', error);
    return false;
  }
};

// Function to update embeddings for the AutomationsPage
export const updateEmbeddings = async (uid: string, content: string, queryName: string): Promise<boolean> => {
  try {
    // Try to delete existing embeddings, but continue even if it fails
    try {
      await deleteEmbeddings(uid, queryName);
    } catch (deleteError) {
      console.error('Error deleting embeddings, continuing anyway:', deleteError);
    }
    
    // Create new embeddings
    // For predefined sections in AutomationsPage, add a section type to metadata
    return await createEmbeddings(uid, content, queryName, {
      section_type: queryName,
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating embeddings:', error);
    return false;
  }
}; 