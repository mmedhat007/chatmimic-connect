import { createClient, SupabaseClient } from '@supabase/supabase-js';
// Import the central apiRequest function
import { apiRequest } from '../utils/api'; 

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

// Initialize Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);

// Check if required environment variables are set
if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or key is not properly configured');
}

// Function to check if embeddings are available
export const checkEmbeddingsAvailable = async (): Promise<boolean> => {
  try {
    // Use the central apiRequest which handles authentication
    const result = await apiRequest('/proxy/embeddings', { 
      method: 'POST',
      body: JSON.stringify({
        text: "test",
        model: "text-embedding-3-small", // Use a valid model if needed by backend
        // No need to specify save:false, type: or metadata: for a simple check
      })
    });
    
    // apiRequest throws on non-ok status, so we just check the data
    // Ensure result and result.data exist before accessing embedding
    return !!(result && result.data && result.data.embedding);
  } catch (error: any) {
    console.warn('Embeddings availability check failed:', error.message || error);
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
      
      // Check if we need to add columns
      try {
        // Check for full_config column
        const { error: fullConfigCheckError } = await supabase.rpc('check_column_exists', {
          table_name: 'user_configs',
          column_name: 'full_config'
        });
        
        // If there's an error or the column doesn't exist, add it
        if (fullConfigCheckError) {
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
        
        // Check for behavior_rules column
        const { error: behaviorRulesCheckError } = await supabase.rpc('check_column_exists', {
          table_name: 'user_configs',
          column_name: 'behavior_rules'
        });
        
        // If there's an error or the column doesn't exist, add it
        if (behaviorRulesCheckError) {
          console.log('Adding behavior_rules column to user_configs table');
          
          // Call the function to add the behavior_rules column
          const { error: behaviorRulesError } = await supabase.rpc('add_behavior_rules_column');
          
          if (behaviorRulesError) {
            console.error('Error adding behavior_rules column:', behaviorRulesError);
            // Continue anyway as the basic functionality will still work
          }
        }
      } catch (e) {
        console.error('Error checking/adding columns:', e);
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

    // Extract behavior_rules using the correct format
    const behaviorRulesArray = config.behavior_rules || [];
    console.log('[saveUserConfig] Extracting behavior_rules:', behaviorRulesArray);
    console.log('[saveUserConfig] Number of behavior rules:', behaviorRulesArray.length);
    
    // Get only enabled rules
    const enabledRules = behaviorRulesArray.filter(rule => rule.enabled);
    console.log('[saveUserConfig] Number of enabled rules:', enabledRules.length);
    
    // Format each rule correctly - USING THE RULE TITLE, NOT JUST DESCRIPTION
    const formattedRules = enabledRules.map(rule => {
      // Include rule title and description if available
      return rule.description 
        ? `${rule.rule}: ${rule.description}` 
        : rule.rule;
    });
    
    // Create the simplified behavior rules format with RULES not description
    const simplifiedBehaviorRules = {
      rules: [
        {
          rules: formattedRules.join(' | ')
        }
      ],
      last_updated: new Date().toISOString(),
      version: "1.0"
    };

    console.log('[saveUserConfig] Created simplified behavior rules object:', simplifiedBehaviorRules);

    // Convert config to appropriate format for database
    const configToSave = {
      user_id: uid,
      temperature: 0.7, // Default or extract from config if available
      max_tokens: 500,  // Default or extract from config if available
      full_config: config, // Store the entire configuration object
      behavior_rules: simplifiedBehaviorRules // Store simplified behavior rules using the correct format
    };

    // Update or insert based on whether a record exists
    let error;
    if (existingConfig) {
      console.log('[saveUserConfig] Updating existing config with simplified behavior_rules');
      const { error: updateError } = await supabase
        .from('user_configs')
        .update(configToSave)
        .eq('user_id', uid);
      
      error = updateError;
    } else {
      console.log('[saveUserConfig] Inserting new config with simplified behavior_rules');
      const { error: insertError } = await supabase
        .from('user_configs')
        .insert(configToSave);
      
      error = insertError;
    }

    if (error) {
      console.error('Error saving user config:', error);
      return false;
    }

    console.log('[saveUserConfig] Successfully saved config with simplified behavior_rules');
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
    console.log('[getUserConfig] Fetching config from Supabase for user:', uid);
    const { data, error } = await supabase
      .from('user_configs')
      .select('*')  // Select all columns to get full_config and behavior_rules
      .eq('user_id', uid)
      .maybeSingle();

    if (error) {
      console.error('Error getting user config:', error);
      return null;
    }

    // If we have full_config, use it
    if (data && data.full_config) {
      console.log('[getUserConfig] Retrieved full_config from Supabase');
      
      // Create a config object with the full_config data
      let config = data.full_config;
      // Ensure behavior_rules array exists
      if (!config.behavior_rules) {
        config.behavior_rules = [];
      }
      
      // Store in localStorage for next time
      localStorage.setItem(`user_${uid}_config`, JSON.stringify(config));
      console.log('[getUserConfig] Returning full_config object');
      return config;
    } 
    // Fallback to old structure if full_config doesn't exist
    else if (data) {
      console.log('[getUserConfig] Retrieved data from Supabase (likely old format)');
      
      // Construct config object from individual fields + behavior_rules
      const behaviorRules = data.behavior_rules && data.behavior_rules.rules && data.behavior_rules.rules[0]
        ? data.behavior_rules.rules[0].rules.split(' | ').map((ruleText: string) => {
            const [rule, ...descriptionParts] = ruleText.split(': ');
            return { rule: rule.trim(), description: descriptionParts.join(': ').trim(), enabled: true };
          }) 
        : [];
        
      const config = {
        user_id: data.user_id,
        temperature: data.temperature,
        max_tokens: data.max_tokens,
        behavior_rules: behaviorRules,
        name: "User Configuration", // Add a default name if needed
        isActive: true // Add a default status if needed
        // Add other fields if they existed previously
      };
      
      // Store in localStorage
      localStorage.setItem(`user_${uid}_config`, JSON.stringify(config));
      console.log('[getUserConfig] Returning constructed config from old data');
      return config;
    } 
    // If no data found at all
    else {
      console.log('[getUserConfig] No config found for user:', uid);
      return null;
    }
  } catch (error) {
    console.error('Error in getUserConfig:', error);
    return null;
  }
};

// Function to create embeddings
export const createEmbeddings = async (uid: string, content: string, queryName: string | null = null, additionalMetadata = {}): Promise<boolean> => {
  try {
    // Prepare metadata - include queryName and user_id in metadata
    const metadata: Record<string, any> = {
      ...additionalMetadata,
      user_id: uid // Store user_id in metadata for filtering with @> operator
    };
    
    // Add queryName to metadata if provided
    if (queryName) {
      metadata.query_name = queryName;
    }
    
    try {
      // Use the server proxy endpoint via apiRequest (handles auth)
      const result = await apiRequest('/proxy/embeddings', { 
        method: 'POST',
        body: JSON.stringify({
          text: content,
          model: "text-embedding-3-small", // Or your preferred model
          save: true, // Tell backend to save this
          type: queryName ? 'query' : 'document', // Example type
          metadata: metadata // Pass metadata to backend
        })
      });
      
      // Check if embedding was generated and potentially saved by the backend
      // Ensure result and result.data exist before accessing properties
      if (result && result.status === 'success' && result.data && result.data.embedding) {
         console.log('Embedding generated (and potentially saved) via backend proxy.');
         // Backend handles saving now, so client doesn't need to insert directly
         return true;
      } else {
         // Log the actual result if it wasn't successful as expected
         console.error('Backend proxy did not return successful embedding:', result);
         // Use the message from the result if available, otherwise provide a default
         throw new Error(result?.message || 'Backend proxy failed to generate/save embedding');
      }

    } catch (embeddingError: any) {
      // Handle errors from apiRequest (includes auth errors, network errors, server errors)
      console.error('Error generating/saving embedding via proxy API:', embeddingError.message || embeddingError);
      
      // Decide on fallback behavior - Do we still try to save content without embedding?
      // For now, let's NOT save if embedding fails, to avoid incomplete data.
      /* 
      console.warn('Attempting to save content without embedding as fallback...');
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
      } else {
         console.log('Saved record without embedding.');
      }
      */
      
      // Return false as the primary operation (embedding) failed
      return false; 
    }
  } catch (error) {
    // Catch any unexpected errors in the outer try block
    console.error('Unexpected error in createEmbeddings:', error);
    return false;
  }
};

// Function to delete embeddings
export const deleteEmbeddings = async (uid: string, queryName: string | null = null): Promise<boolean> => {
  try {
    const queryBuilder = supabase
      .from('user_embeddings')
      .delete()
      .eq('user_id', uid);
      
    // If queryName is provided, filter by it in metadata
    if (queryName) {
      queryBuilder.eq('metadata->>query_name', queryName);
    }
      
    const { error } = await queryBuilder;

    if (error) {
      console.error('Error deleting embeddings:', error);
      return false;
    }

    console.log(`Successfully deleted embeddings for user ${uid}` + (queryName ? ` with queryName ${queryName}` : ''));
    return true;
  } catch (error) {
    console.error('Error in deleteEmbeddings:', error);
    return false;
  }
};

// Function to update embeddings (potentially replacing content and re-generating embedding)
export const updateEmbeddings = async (uid: string, content: string, queryName: string): Promise<boolean> => {
  try {
    // This likely involves deleting old and creating new, or a more complex update.
    // For simplicity, let's use createEmbeddings which should handle the save/update via backend.
    console.log(`Attempting to update embeddings for queryName: ${queryName}`);
    // Assuming createEmbeddings via proxy can handle updates if `save: true` is smart enough on backend
    // or if we first delete then create.
    // Let's try just calling createEmbeddings again.
    const success = await createEmbeddings(uid, content, queryName);
    if (success) {
       console.log(`Successfully triggered update/creation for embeddings with queryName: ${queryName}`);
    } else {
       console.error(`Failed to trigger update/creation for embeddings with queryName: ${queryName}`);
    }
    return success;

  } catch (error) {
    console.error('Error in updateEmbeddings:', error);
    return false;
  }
};

/**
 * Update behavior rules in Supabase
 */
export const updateBehaviorRules = async (userId: string, rules: any[]) => {
  console.log('[updateBehaviorRules] Received rules:', rules);
  try {
    // Format rules correctly
    const enabledRules = rules.filter(rule => rule.enabled);
    console.log('[updateBehaviorRules] Enabled rules:', enabledRules);
    
    const formattedRules = enabledRules.map(rule => {
      return rule.description ? `${rule.rule}: ${rule.description}` : rule.rule;
    });
    console.log('[updateBehaviorRules] Formatted rules strings:', formattedRules);
    
    const simplifiedBehaviorRules = {
      rules: [
        {
          rules: formattedRules.join(' | ')
        }
      ],
      last_updated: new Date().toISOString(),
      version: "1.0"
    };
    console.log('[updateBehaviorRules] Simplified rules object:', simplifiedBehaviorRules);

    const { error } = await supabase
      .from('user_configs')
      .update({ 
        behavior_rules: simplifiedBehaviorRules,
        updated_at: new Date().toISOString() // Also update the main timestamp if available
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating behavior rules:', error);
      throw error;
    }
    console.log('Behavior rules updated successfully in Supabase for user:', userId);
    return { success: true };
  } catch (error) {
    console.error('Failed to update behavior rules:', error);
    return { success: false, error: error };
  }
};

// Function to fetch embeddings for a user (consider security/privacy)
export const getEmbeddingsForUser = async (uid: string): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from('user_embeddings')
      .select('id, content, metadata, created_at') // Select specific fields, avoid fetching embedding vector itself unless needed
      .eq('user_id', uid)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching embeddings:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getEmbeddingsForUser:', error);
    return [];
  }
};

// Function to save Google credentials
export const saveGoogleCredentials = async (uid: string, credentials: any): Promise<boolean> => {
  try {
    // Ensure encryption key is available
    const encryptionKey = import.meta.env.VITE_TOKEN_ENCRYPTION_KEY;
    if (!encryptionKey) {
      console.error('Encryption key is not configured!');
      return false;
    }

    // Encrypt the refresh token if it exists
    let encryptedRefreshToken = credentials.refresh_token;
    if (credentials.refresh_token) {
      // NOTE: Requires a proper encryption library (e.g., crypto-js) on the client
      // For now, this is a placeholder. DO NOT use simple base64.
      // Replace with actual encryption:
      // encryptedRefreshToken = encrypt(credentials.refresh_token, encryptionKey); 
      // Placeholder: just storing it as is (INSECURE, for demo only)
      console.warn('Storing refresh token without client-side encryption (placeholder).');
      encryptedRefreshToken = credentials.refresh_token; 
    }

    const credsToSave = {
      user_id: uid,
      access_token: credentials.access_token,
      refresh_token: encryptedRefreshToken, // Store encrypted version
      expiry_date: credentials.expiry_date, // Store expiry timestamp (number)
      scope: credentials.scope,
      token_type: credentials.token_type,
      updated_at: new Date().toISOString(),
    };

    // Upsert the credentials
    const { error } = await supabase
      .from('google_credentials')
      .upsert(credsToSave, { onConflict: 'user_id' });

    if (error) {
      console.error('Error saving Google credentials:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error in saveGoogleCredentials:', error);
    return false;
  }
};

// Function to get Google credentials (requires backend for decryption)
// Getting encrypted credentials on the client is not useful.
// We need a backend endpoint to securely retrieve and use/refresh them.

// Function to delete Google credentials
export const deleteGoogleCredentials = async (uid: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('google_credentials')
      .delete()
      .eq('user_id', uid);

    if (error) {
      console.error('Error deleting Google credentials:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error in deleteGoogleCredentials:', error);
    return false;
  }
}; 