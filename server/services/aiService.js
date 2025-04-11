const axios = require('axios');
const logger = require('../utils/logger');

// Load API Key from server environment variables
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Define models
const MODEL_NAME = 'deepseek-r1-distill-llama-70b';
const FALLBACK_MODEL_NAME = 'llama-3.1-70b-versatile';

/**
 * Generates default AI prompts based on field types.
 * Copied from frontend ai.ts for consistency.
 * @param {object} field - The field configuration object.
 * @returns {string} The generated AI prompt.
 */
const generateDefaultPrompt = (field) => {
  switch (field.type) {
    case 'name':
      return 'Extract the customer\\\'s name from the message. If no name is found, return "N/A".';
    case 'phone':
      return 'Extract the phone number from the message. Format it as international format if possible. If no phone number is found, return "N/A".';
    case 'product':
      return 'Identify any product or service the customer is interested in. If nothing specific is mentioned, return "N/A".';
    case 'inquiry':
      return 'Summarize the customer\\\'s main inquiry or question in a concise manner. If there\\\'s no clear inquiry, return "N/A".';
    case 'date':
      return 'Extract any date mentioned in the message. Format as YYYY-MM-DD. If no date is found, return "N/A".';
    default:
      return `Extract ${field.name} from the message. If not found, return "N/A".`;
  }
};

/**
 * Extract data from a message using the Groq API via the backend.
 * @param {string} message The message text.
 * @param {Array<object>} fields The fields to extract (expecting objects with id, name, type, aiPrompt?).
 * @returns {Promise<Record<string, string>>} An object with extracted data.
 */
const extractDataFromMessage = async (message, fields) => {
  if (!GROQ_API_KEY) {
    logger.error('GROQ_API_KEY is not configured in server environment variables.');
    throw new Error('AI Service Error: Groq API key not configured on server.');
  }

  // Prepare the prompts for each field
  const fieldPrompts = fields.map(field => ({
    id: field.id,
    prompt: field.aiPrompt || generateDefaultPrompt(field)
  }));

  // Create the system prompt
  const systemMessage = `You are an AI assistant specialized in extracting structured data from customer messages.
Extract ONLY the information requested for each field.
Be precise and return just the extracted information, not complete sentences.
If the information is not found in the message, return "N/A".
Format your response as valid JSON with each field ID as a key.`;

  // Create the user message
  const userMessage = `Extract the following information from this message:\n${fieldPrompts.map(fp => `${fp.id}: ${fp.prompt}`).join('\\n')}\n\nMessage:\n\"\"\"\n${message}\n\"\"\"\n\nReturn results as JSON.`;

  let responseData;
  let modelUsed = MODEL_NAME;
  let attempt = 1;

  while (attempt <= 2) {
    try {
      logger.debug(`[AI Service] Attempt ${attempt}: Calling Groq API with model: ${modelUsed}`);
      const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: modelUsed,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage }
        ],
        temperature: 0,
        max_tokens: 1024
      }, {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      responseData = response.data;
      logger.debug(`[AI Service] Groq API call successful with model ${modelUsed}`);
      break; // Success, exit loop

    } catch (error) {
      logger.error(`[AI Service] Groq API error on attempt ${attempt} with model ${modelUsed}: ${error.message}`);
      if (error.response) {
        logger.error(`[AI Service] Groq Error Status: ${error.response.status}`);
        logger.error(`[AI Service] Groq Error Data: ${JSON.stringify(error.response.data)}`);
      }

      if (attempt === 1 && (!error.response || error.response.status >= 500)) {
        // First attempt failed with server error or network error, try fallback
        logger.warn(`[AI Service] Retrying Groq API call with fallback model: ${FALLBACK_MODEL_NAME}`);
        modelUsed = FALLBACK_MODEL_NAME;
        attempt++;
      } else {
        // Second attempt failed, or it was a non-retriable error (e.g., 4xx)
        throw new Error(`AI Service Error: Failed to extract data after ${attempt} attempt(s). Last model tried: ${modelUsed}. Error: ${error.message}`);
      }
    }
  }

  if (!responseData || !responseData.choices || responseData.choices.length === 0) {
     logger.error('[AI Service] Invalid or empty response structure from Groq API:', responseData);
     throw new Error('AI Service Error: Received invalid response structure from Groq API.');
  }

  // Parse the AI response
  try {
    const aiContent = responseData.choices[0].message.content;
    logger.debug(`[AI Service] Raw AI response content: ${aiContent}`);

    let extractedData = {};
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/); // Simple JSON block match

    if (jsonMatch && jsonMatch[0]) {
      try {
         extractedData = JSON.parse(jsonMatch[0]);
         logger.debug('[AI Service] Parsed JSON from AI response:', extractedData);
      } catch (jsonParseError) {
         logger.error(`[AI Service] Failed to parse JSON from AI response: ${jsonParseError}. Raw content: ${aiContent}`);
         // Fallback or error handling if JSON parsing fails needed? For now, continue to line parsing.
      }
    } else {
        logger.warn('[AI Service] No JSON block found in AI response, attempting line parsing.');
        // Fallback line parsing logic (consider enhancing)
        const lines = aiContent.split('\\n');
        for (const line of lines) {
          const parts = line.split(':');
          if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join(':').trim();
            const field = fields.find(f => f.id === key || f.name.toLowerCase() === key.toLowerCase());
            if (field) {
              extractedData[field.id] = value;
            }
          }
        }
        logger.debug('[AI Service] Result after line parsing:', extractedData);
    }

    // Ensure all requested fields have at least N/A
     fields.forEach(field => {
        if (!(field.id in extractedData) || extractedData[field.id] === null || extractedData[field.id] === undefined) {
          // Add specific handling for known field types if needed, otherwise default N/A
           if (field.type === 'name' && message) {
              // Basic name extraction attempt if AI failed
               const nameMatch = message.match(/Hi,?\\s+I(?:\\')?m\\s+([A-Z][a-z]+)/i) ||
                                message.match(/Hello,?\\s+(?:this\\s+is\\s+)?([A-Z][a-z]+)/i) ||
                                message.match(/(?:my|the)\\s+name\\s+is\\s+([A-Z][a-z]+)/i);
               if (nameMatch && nameMatch[1]) {
                   extractedData[field.id] = nameMatch[1];
                   logger.debug(`[AI Service] Added fallback name: ${nameMatch[1]}`);
               } else {
                   extractedData[field.id] = 'N/A';
               }
           } else {
             extractedData[field.id] = 'N/A';
           }
        }
     });


    logger.info(`[AI Service] Successfully extracted data for ${fields.length} fields.`);
    return extractedData;

  } catch (parseError) {
    logger.error('[AI Service] Error processing AI response content:', parseError);
    logger.error('[AI Service] Raw Groq Response Data:', JSON.stringify(responseData));
    // Return N/A for all fields on parsing error
    return fields.reduce((acc, field) => {
      acc[field.id] = 'N/A';
      return acc;
    }, {});
  }
};

// Restore original export
module.exports = {
  extractDataFromMessage
};
