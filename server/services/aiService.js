/**
 * AI Service for embeddings and other AI-related functionality
 */

const { makeRequest } = require('./proxyService');
const logger = require('../utils/logger');

/**
 * Generate embeddings for the provided text using OpenAI
 * @param {string} text - The text to generate embeddings for
 * @returns {Promise<Array<number>>} The embedding vector
 */
const generateEmbeddings = async (text) => {
  try {
    logger.debug('Generating embeddings', { textLength: text.length });
    
    const response = await makeRequest({
      url: 'https://api.openai.com/v1/embeddings',
      method: 'POST',
      service: 'openai',
      data: {
        input: text,
        model: 'text-embedding-3-small',
      },
    });
    
    if (!response.data || !response.data[0] || !response.data[0].embedding) {
      throw new Error('Invalid embedding response format');
    }
    
    logger.debug('Successfully generated embeddings', { 
      vectors: response.data[0].embedding.length,
    });
    
    return response.data[0].embedding;
  } catch (error) {
    logger.error('Error generating embeddings', {
      error: error.message,
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