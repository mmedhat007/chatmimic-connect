// Placeholder API service without Supabase
// This file contains mock implementations of the API functions

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
    console.log('Mock: Updating WhatsApp config for user', uid, config);
    // In a real implementation, this would save to a database
    
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
    console.log('Mock: Getting WhatsApp config for user', uid);
    // In a real implementation, this would fetch from a database
    
    // Return mock data
    return { 
      data: {
        id: 1,
        phone_number_id: 'mock_phone_number_id',
        whatsapp_business_account_id: 'mock_whatsapp_business_account_id',
        access_token: 'mock_access_token',
        verify_token: 'mock_verify_token',
        updated_at: new Date().toISOString()
      } 
    };
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