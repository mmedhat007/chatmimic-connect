import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getAuth } from 'firebase/auth';

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
    console.log('Checking embeddings availability...');
    
    // Get the current Firebase user
    const auth = getAuth();
    
    // Try multiple times to get the current user with a small delay
    let currentUser = auth.currentUser;
    let attempts = 0;
    const maxAttempts = 5;
    
    while (!currentUser && attempts < maxAttempts) {
      console.log(`No user found yet, waiting... (attempt ${attempts + 1}/${maxAttempts})`);
      // Wait for a short time
      await new Promise(resolve => setTimeout(resolve, 1000));
      currentUser = auth.currentUser;
      attempts++;
    }
    
    if (!currentUser) {
      console.warn('No authenticated user found for embeddings check after multiple attempts');
      
      // Fallback: Try to get user ID from localStorage as a last resort
      const userUID = localStorage.getItem('userUID');
      if (userUID) {
        console.log('Found userUID in localStorage, continuing with fallback authentication');
        
        // For embeddings test, use a fallback method
        const response = await fetch('/api/proxy/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token-dev', // Use a development token that server recognizes
          },
          body: JSON.stringify({
            text: "test",
            model: "text-embedding-3-small"
          })
        });
        
        console.log('Embeddings API response status with fallback auth:', response.status);
        
        if (!response.ok) {
          console.warn('Embeddings test failed with fallback auth, status:', response.status);
          return false;
        }
        
        const result = await response.json();
        console.log('Embeddings available with fallback auth:', !!result.data.embedding);
        return !!result.data.embedding;
      }
      
      return false;
    }
    
    console.log('Found authenticated user, getting ID token...');
    
    // Get fresh ID token for authentication
    const token = await currentUser.getIdToken(true);
    
    console.log('Firebase ID token retrieved, calling embeddings API...');
    
    // Try to generate a simple embedding using the proxy endpoint
    const response = await fetch('/api/proxy/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        text: "test",
        model: "text-embedding-3-small"
      })
    });
    
    console.log('Embeddings API response status:', response.status);
    
    if (!response.ok) {
      console.warn('Embeddings test failed with status:', response.status);
      try {
        const errorData = await response.text();
        console.warn('Error response:', errorData);
      } catch (e) {
        console.warn('Could not extract error details');
      }
      return false;
    }
    
    const result = await response.json();
    console.log('Embeddings available:', !!result.data.embedding);
    return !!result.data.embedding;
  } catch (error) {
    console.warn('Embeddings test failed with exception:', error);
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
      
      // If behavior_rules exist as a separate column, use that value
      // This overrides any behavior_rules in full_config
      if (data.behavior_rules) {
        console.log('[getUserConfig] Found behavior_rules object in dedicated column:', data.behavior_rules);
        
        // The behavior_rules in the dedicated column is now a simplified structure
        // with a single description. We'll need to transform this back into an array
        // structure that's compatible with the frontend.
        
        // Create default behavior rules array
        let compatibleBehaviorRules = [];
        
        if (data.behavior_rules.rules && Array.isArray(data.behavior_rules.rules) && 
            data.behavior_rules.rules.length > 0 && data.behavior_rules.rules[0].description) {
          
          const consolidatedDescription = data.behavior_rules.rules[0].description;
          console.log('[getUserConfig] Found consolidated description:', consolidatedDescription);
          
          // If we have a description, we'll recreate the individual rules
          // by splitting on period markers
          if (consolidatedDescription && consolidatedDescription.trim() !== '') {
            // Split the consolidated description into individual rule descriptions
            const ruleDescriptions = consolidatedDescription
              .split('.')
              .map(desc => desc.trim())
              .filter(desc => desc !== '');
              
            console.log('[getUserConfig] Extracted rule descriptions:', ruleDescriptions);
            
            // Create dummy rule objects from the descriptions
            compatibleBehaviorRules = ruleDescriptions.map((description, index) => ({
              id: `rule-${index + 1}`,
              rule: `Rule ${index + 1}`,
              description: description,
              enabled: true
            }));
          }
        }
        
        console.log('[getUserConfig] Created compatible behavior rules array:', compatibleBehaviorRules);
        
        // Set the behavior_rules property to the compatible array
        config.behavior_rules = compatibleBehaviorRules;
      } else {
        console.log('[getUserConfig] No behavior_rules found in dedicated column');
      }
      
      // Save to localStorage for future use
      localStorage.setItem(`user_${uid}_config`, JSON.stringify(config));
      console.log('[getUserConfig] Saved merged config to localStorage');
      
      return config;
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
      },
      behavior_rules: [] // Initialize with empty behavior_rules array
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
      // Get the current Firebase user
      const auth = getAuth();
      let currentUser = auth.currentUser;
      
      // Try multiple times to get the current user with a small delay
      let attempts = 0;
      const maxAttempts = 3;
      
      while (!currentUser && attempts < maxAttempts) {
        console.log(`No user found for creating embeddings, waiting... (attempt ${attempts + 1}/${maxAttempts})`);
        // Wait for a short time
        await new Promise(resolve => setTimeout(resolve, 1000));
        currentUser = auth.currentUser;
        attempts++;
      }
      
      let token = 'test-token-dev'; // Default fallback token for development
      
      if (currentUser) {
        // Get fresh ID token for authentication
        token = await currentUser.getIdToken(true);
        console.log('Using Firebase ID token for embeddings creation');
      } else {
        console.log('Using fallback token for embeddings creation');
      }
      
      // Use the server proxy endpoint instead of direct OpenAI API call
      const response = await fetch('/api/proxy/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: content,
          model: "text-embedding-3-small"
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      
      const result = await response.json();
      const embedding = result.data.embedding;

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
      console.error('Error generating embedding with proxy API:', embeddingError);
      // Store the content without embeddings as fallback
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
      }
      
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
    // Skip updating behavior_rules embeddings completely
    if (queryName === 'behavior_rules') {
      console.log('Skipping behavior_rules embeddings update as requested');
      return true;
    }
    
    // Create new embeddings without deleting existing ones
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

/**
 * Update behavior rules in Supabase
 */
export const updateBehaviorRules = async (userId: string, rules: any[]) => {
  try {
    console.log('Updating behavior rules for user:', userId);
    
    // Get only enabled rules
    const enabledRules = rules.filter(rule => rule.enabled);
    console.log('Enabled rules count:', enabledRules.length);
    
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

    console.log('Created simplified behavior rules:', JSON.stringify(simplifiedBehaviorRules, null, 2));
    
    // Check if a record already exists
    const { data: existingConfig, error: fetchError } = await supabase
      .from('user_configs')
      .select('id, full_config')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) {
      console.error('Error checking existing config:', fetchError);
      throw fetchError;
    }

    let updateResult;
    
    if (existingConfig) {
      // Update existing record - ONLY IN USER_CONFIGS TABLE
      console.log('Updating user_configs table only with behavior_rules and full_config');
      
      // First, prepare the updated full_config
      const updatedFullConfig = existingConfig.full_config ? { ...existingConfig.full_config } : {};
      updatedFullConfig.behavior_rules = rules; // Complete rule objects
      
      // Update both columns in a single operation
      const { data, error } = await supabase
        .from('user_configs')
        .update({
          behavior_rules: simplifiedBehaviorRules, // With rule titles
          full_config: updatedFullConfig,         // Complete objects
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) {
        throw error;
      }
      
      updateResult = data;
      console.log('Successfully updated user_configs table');
    } else {
      // Create a new record
      console.log('No existing config found, creating new record');
      
      const { data, error } = await supabase
        .from('user_configs')
        .insert({
          user_id: userId,
          behavior_rules: simplifiedBehaviorRules,
          full_config: { behavior_rules: rules },
          updated_at: new Date().toISOString(),
          temperature: 0.7,
          max_tokens: 500
        });

      if (error) throw error;
      updateResult = data;
    }
    
    // Update localStorage cache
    try {
      const storedConfig = localStorage.getItem(`user_${userId}_config`);
      if (storedConfig) {
        const config = JSON.parse(storedConfig);
        config.behavior_rules = rules;
        localStorage.setItem(`user_${userId}_config`, JSON.stringify(config));
        console.log('Updated behavior rules in localStorage cache');
      }
    } catch (e) {
      console.error('Error updating localStorage cache:', e);
    }
    
    console.log('Successfully updated behavior rules in user_configs only');
    return updateResult;
  } catch (error) {
    console.error('Error updating behavior rules:', error);
    throw error;
  }
}; 