/**
 * AI Service for embeddings and other AI-related functionality
 */

const { makeRequest } = require('./proxyService');
const logger = require('../utils/logger');

/**
 * Generate embeddings for the provided text using OpenAI
 * @param {string} text - The text to generate embeddings for
 * @param {string} model - The OpenAI model to use for embeddings (optional)
 * @returns {Promise<Array<number>>} The embedding vector
 */
const generateEmbeddings = async (text, model = 'text-embedding-3-small') => {
  try {
    if (!text || typeof text !== 'string') {
      throw new Error('Text must be a non-empty string');
    }
    
    logger.debug('Generating embeddings', { textLength: text.length, model });
    
    let apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      logger.error('OpenAI API key missing or empty', {
        keyFound: !!apiKey,
        keyLength: apiKey ? apiKey.length : 0
      });
      throw new Error('OpenAI API key is not configured in the environment. Please check the server/.env file.');
    }
    
    // Handle line breaks and whitespace in the API key
    apiKey = apiKey.replace(/[\r\n\s]+/g, '');
    
    if (apiKey.length < 20) {
      logger.error('OpenAI API key appears to be invalid (too short)', {
        keyLength: apiKey.length
      });
      throw new Error('OpenAI API key appears to be invalid (too short). Please check the server/.env file.');
    }
    
    // Debug log to help troubleshoot (mask most of the key for security)
    const maskedKey = apiKey.substring(0, 7) + '...' + apiKey.substring(apiKey.length - 4);
    logger.debug('Using OpenAI API key', { keyPattern: maskedKey, keyLength: apiKey.length });
    
    // Use direct API call to OpenAI to avoid proxy issues
    const response = await makeRequest({
      url: 'https://api.openai.com/v1/embeddings',
      method: 'POST',
      service: 'openai',
      data: {
        input: text,
        model: model || 'text-embedding-3-small',
      },
      cleanKey: apiKey // Pass the cleaned key to makeRequest
    });
    
    if (!response || !response.data || !response.data[0] || !response.data[0].embedding) {
      logger.error('Invalid embedding response format', { 
        response: typeof response === 'object' ? 'Response received but format is invalid' : 'No response received'
      });
      throw new Error('Invalid embedding response format');
    }
    
    logger.debug('Successfully generated embeddings', { 
      vectors: response.data[0].embedding.length,
      model
    });
    
    return response.data[0].embedding;
  } catch (error) {
    logger.error('Error generating embeddings', {
      error: error.message,
      stackTrace: error.stack,
      model,
      service: 'openai',
    });
    throw new Error(`Failed to generate embeddings: ${error.message}`);
  }
};

/**
 * Extract data from messages using Groq LLM
 * @param {string} message - Message content
 * @param {Array} fields - Fields to extract
 * @returns {Promise<Object>} Extracted data
 */
const extractDataWithGroq = async (message, fields) => {
  try {
    logger.debug('Extracting data with Groq', { 
      messageLength: message.length,
      fieldsCount: fields.length
    });
    
    // Prepare the system message
    const fieldPrompts = fields.map(field => {
      let instructions = '';
      
      switch (field.type) {
        case 'name':
          instructions = 'Extract the person\'s full name if mentioned. Look for proper names in the message.';
          break;
        case 'product':
          instructions = 'Extract any products or services mentioned or that the person is interested in.';
          break;
        case 'date':
          instructions = 'Extract any dates mentioned and format as YYYY-MM-DD if possible.';
          break;
        case 'custom':
          instructions = field.aiPrompt || 'Extract relevant information for this field.';
          break;
        default:
          instructions = 'Extract relevant information for this field.';
      }
      
      return `- "${field.name}": ${instructions}`;
    }).join('\n');
    
    const systemMessage = `You are a data extraction assistant. Extract the following fields from the customer message:
${fieldPrompts}

Respond with a valid JSON object where keys match exactly the field names provided above and values are the extracted data.
If a field can't be extracted, use an empty string. Be concise and only extract what's explicitly mentioned.`;

    // Make the API call to Groq
    const response = await makeRequest({
      url: 'https://api.groq.com/openai/v1/chat/completions',
      method: 'POST',
      service: 'groq',
      data: {
        model: 'deepseek-r1-distill-llama-70b',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: message }
        ],
        temperature: 0,
        max_tokens: 1024
      }
    });
    
    // Parse the result
    if (!response.choices || !response.choices[0] || !response.choices[0].message) {
      throw new Error('Invalid response format from Groq API');
    }
    
    const content = response.choices[0].message.content;
    
    try {
      // Extract JSON from the response content
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const extractedData = JSON.parse(jsonMatch[0]);
      logger.debug('Successfully extracted data', { extractedData });
      
      return extractedData;
    } catch (parseError) {
      logger.error('Error parsing AI response', {
        error: parseError.message,
        content
      });
      throw new Error(`Failed to parse AI response: ${parseError.message}`);
    }
  } catch (error) {
    logger.error('Error extracting data with Groq', {
      error: error.message
    });
    throw new Error(`Failed to extract data: ${error.message}`);
  }
};

module.exports = {
  generateEmbeddings,
  extractDataWithGroq
}; 