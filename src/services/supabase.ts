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

// Function to ensure the user table exists in Supabase
export const ensureUserTable = async (uid: string): Promise<boolean> => {
  try {
    // First, check if the table already exists
    const { data: tableExists, error: checkError } = await supabase
      .from('user_configs')
      .select('id')
      .limit(1);
    
    // If there's no error, the table exists
    if (!checkError) {
      console.log('User config table already exists');
      
      // Check if we need to add the full_config column
      try {
        // Run a SQL query to check if full_config column exists
        const { error: columnCheckError } = await supabase.rpc('check_column_exists', {
          table_name: 'user_configs',
          column_name: 'full_config'
        });
        
        // If there's an error or the column doesn't exist, add it
        if (columnCheckError) {
          console.log('Adding full_config column to user_configs table');
          
          // Add the full_config column if it doesn't exist
          const { error: alterError } = await supabase.rpc('add_jsonb_column', {
            table_name: 'user_configs',
            column_name: 'full_config'
          });
          
          if (alterError) {
            console.error('Error adding full_config column:', alterError);
            // Continue anyway as the basic functionality will still work
          }
        }
      } catch (e) {
        console.error('Error checking/adding full_config column:', e);
        // Continue anyway
      }
      
      return true;
    }
    
    // Create the table if it doesn't exist
    const { error: createError } = await supabase.rpc('create_config_table');
    
    if (createError) {
      console.error('Error creating user config table:', createError);
      return false;
    }
    
    console.log('Created user config table successfully');
    return true;
  } catch (error) {
    console.error('Error in ensureUserTable:', error);
    return false;
  }
};

// Function to save user configuration
export const saveUserConfig = async (uid: string, config: any): Promise<boolean> => {
  try {
    // Ensure the user table exists first
    const tableCreated = await ensureUserTable(uid);
    if (!tableCreated) {
      console.error('Failed to create user table');
      return false;
    }

    // First, check if a record already exists
    const { data: existingConfig, error: fetchError } = await supabase
      .from('user_configs')
      .select('id')
      .eq('user_id', uid)
      .maybeSingle();

    if (fetchError) {
      console.error('Error checking existing config:', fetchError);
      return false;
    }

    // Convert config to appropriate format for database
    const configToSave = {
      user_id: uid,
      temperature: 0.7, // Default or extract from config if available
      max_tokens: 500,  // Default or extract from config if available
      full_config: config // Store the entire configuration object
    };

    // Update or insert based on whether a record exists
    let error;
    if (existingConfig) {
      const { error: updateError } = await supabase
        .from('user_configs')
        .update(configToSave)
        .eq('user_id', uid);
      
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('user_configs')
        .insert(configToSave);
      
      error = insertError;
    }

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
    // First try to get from localStorage for faster access
    const storedConfig = localStorage.getItem(`user_${uid}_config`);
    if (storedConfig) {
      try {
        const config = JSON.parse(storedConfig);
        console.log('Retrieved config from localStorage:', config);
        return config;
      } catch (e) {
        console.error('Error parsing stored config:', e);
        // Continue to get from Supabase if localStorage parsing fails
      }
    }

    // Get from Supabase if not in localStorage
    const { data, error } = await supabase
      .from('user_configs')
      .select('*')  // Select all columns to get full_config
      .eq('user_id', uid)
      .maybeSingle();

    if (error) {
      console.error('Error getting user config:', error);
      return null;
    }

    // If we have full_config, use it
    if (data && data.full_config) {
      console.log('Retrieved full config from Supabase:', data.full_config);
      
      // Save to localStorage for future use
      localStorage.setItem(`user_${uid}_config`, JSON.stringify(data.full_config));
      
      return data.full_config;
    }

    // If no full_config, return a default structure
    // This will only happen for older entries that don't have full_config
    const defaultConfig = {
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

    return defaultConfig;
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