import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = 'https://kutdbashpuuysxywvzgs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1dGRiYXNocHV1eXN4eXd2emdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwMDEyNjQsImV4cCI6MjA1NzU3NzI2NH0.sPX_kiCkssIG9v1AIoRbdlmnEL-7GCmm_MIxudJyVO8';
export const supabase = createClient(supabaseUrl, supabaseKey);

// Create a table for a user if it doesn't exist
export const createUserTable = async (uid: string) => {
  try {
    const { error } = await supabase.rpc('create_user_table', {
      uid
    });
    
    if (error) {
      console.error('Error creating user table:', error);
      return false;
    }
    
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
    // First ensure the table exists
    await createUserTable(uid);
    
    // Insert the data
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
    const { data, error } = await supabase
      .from(uid)
      .select('*')
      .order('id', { ascending: false })
      .limit(1);
    
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
    const { error } = await supabase.rpc('create_embeddings', {
      uid,
      content
    });
    
    if (error) {
      console.error('Error creating embeddings:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in createEmbeddings:', error);
    return false;
  }
};

// Match documents using embeddings
export const matchDocuments = async (uid: string, query: string) => {
  try {
    const { data, error } = await supabase.rpc('match_documents', {
      uid,
      query_text: query
    });
    
    if (error) {
      console.error('Error matching documents:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error in matchDocuments:', error);
    return null;
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
    const { error } = await supabase
      .from(uid)
      .update(updates)
      .eq('id', id);
    
    if (error) {
      console.error('Error updating agent config:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in updateAgentConfig:', error);
    return false;
  }
}; 