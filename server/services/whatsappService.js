const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Validates WhatsApp credentials by sending a test message via the Graph API.
 * @param {string} accessToken - The WhatsApp access token.
 * @param {string} phoneNumberId - The WhatsApp phone number ID.
 * @param {string} testRecipientNumber - The phone number to send the test message to (must be capable of receiving WhatsApp messages).
 * @returns {Promise<{isValid: boolean, error?: string, details?: any}>} Object indicating validity and potential error details.
 */
const validateWhatsAppCredentials = async (accessToken, phoneNumberId, testRecipientNumber = '201103343450') => {
    if (!accessToken || !phoneNumberId) {
        return { isValid: false, error: 'Access Token and Phone Number ID are required.' };
    }
    
    const apiUrl = `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`;
    const requestBody = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: testRecipientNumber, // Use the provided test number
        type: "text",
        text: {
            body: "WhatsApp credentials validation test from ChatMimic Connect"
        }
    };
    
    logger.info(`Validating WhatsApp credentials for phone ID ${phoneNumberId} by sending test to ${testRecipientNumber}`);
    
    try {
        const response = await axios.post(apiUrl, requestBody, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = response.data;
        logger.debug('WhatsApp validation API response:', data);
        
        // Success if we get a message ID back
        if (data.messages && data.messages[0]?.id) {
            logger.info(`WhatsApp credentials validation successful for ${phoneNumberId}`);
            return { isValid: true };
        }
        
        // Handle specific API errors if available
        if (data.error) {
            logger.warn(`WhatsApp credentials validation failed for ${phoneNumberId}. API Error:`, data.error);
            let userMessage = 'Could not verify WhatsApp credentials.';
            if (data.error.type === 'OAuthException' || data.error.code === 100 || data.error.code === 190) {
                userMessage = 'Invalid Access Token. Please check the token and ensure it has not expired.';
            } else if (data.error.code === 131031) { // Example: Invalid phone number ID format 
                 userMessage = 'Invalid Phone Number ID format.';
            } else if (data.error.message) {
                 userMessage += ` Error: ${data.error.message}`;
            }
            return { isValid: false, error: userMessage, details: data.error };
        }
        
        // Fallback error if structure is unexpected but no explicit error field
        logger.warn(`WhatsApp credentials validation failed for ${phoneNumberId}. Unexpected response structure.`);
        return { isValid: false, error: 'Could not verify WhatsApp credentials due to an unexpected response from Meta.', details: data };
        
    } catch (error) {
        logger.error(`Error calling WhatsApp validation API for ${phoneNumberId}:`, error);
        let userMessage = 'Failed to validate credentials due to a network or server error.';
        let details = null;
        if (axios.isAxiosError(error) && error.response) {
            logger.error('WhatsApp API Error Response:', { status: error.response.status, data: error.response.data });
            details = error.response.data?.error;
            // Refine user message based on status or specific error codes from the response data if needed
             if (error.response.status === 400 && details?.type === 'OAuthException') {
                 userMessage = 'Invalid credentials provided. Please check your Access Token and Phone Number ID.';
             } else if (error.response.status === 401 || error.response.status === 403) {
                 userMessage = 'Authentication failed. Check your Access Token.';
             }
        }
        return { isValid: false, error: userMessage, details: details || error.message };
    }
};

module.exports = {
    validateWhatsAppCredentials
}; 