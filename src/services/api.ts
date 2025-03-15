import { supabase, createUserTable } from './supabase';

// Update WhatsApp configuration
export const updateWhatsAppConfig = async (
  uid: string,
  config: {
    phone_number_id: string;
    whatsapp_business_account_id: string;
    access_token: string;
    verify_token: string;
  }
) => {
  try {
    // Check if the user table exists
    const tableExists = await createUserTable(uid);
    
    if (!tableExists) {
      return { 
        error: { 
          code: '42P01', 
          message: 'User table does not exist. Please complete the agent setup first.' 
        } 
      };
    }
    
    // Try to insert the WhatsApp configuration
    const { error } = await supabase
      .from(`${uid}_whatsapp_config`)
      .upsert([{
        phone_number_id: config.phone_number_id,
        whatsapp_business_account_id: config.whatsapp_business_account_id,
        access_token: config.access_token,
        verify_token: config.verify_token,
        updated_at: new Date().toISOString()
      }], { onConflict: 'id' });
    
    if (error) {
      console.error('Error updating WhatsApp config:', error);
      return { error };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error in updateWhatsAppConfig:', error);
    return { 
      error: { 
        code: 'UNKNOWN', 
        message: 'An unexpected error occurred.' 
      } 
    };
  }
};

// Get WhatsApp configuration
export const getWhatsAppConfig = async (uid: string) => {
  try {
    // Check if the user table exists
    const tableExists = await createUserTable(uid);
    
    if (!tableExists) {
      return { 
        error: { 
          code: '42P01', 
          message: 'User table does not exist. Please complete the agent setup first.' 
        } 
      };
    }
    
    // Try to get the WhatsApp configuration
    const { data, error } = await supabase
      .from(`${uid}_whatsapp_config`)
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1);
    
    if (error) {
      console.error('Error getting WhatsApp config:', error);
      return { error };
    }
    
    return { data: data && data.length > 0 ? data[0] : null };
  } catch (error) {
    console.error('Error in getWhatsAppConfig:', error);
    return { 
      error: { 
        code: 'UNKNOWN', 
        message: 'An unexpected error occurred.' 
      } 
    };
  }
}; 