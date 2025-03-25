// AI service for data extraction
import axios from 'axios';
import { SheetColumn } from './googleSheets';

// Initialize the Groq API client with the correct API key
const GROQ_API_KEY = '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';
// Update to the correct model name
const MODEL_NAME = 'deepseek-r1-distill-llama-70b';

/**
 * Extract data from a WhatsApp message using AI
 * @param message The message text
 * @param fields The fields to extract
 * @returns An object with extracted data
 */
export const extractDataFromMessage = async (message: string, fields: any[]): Promise<Record<string, string>> => {
  try {
    // Use the constant API key directly instead of environment variables
    const apiKey = GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('Groq API key not configured properly');
    }

    // Prepare the prompts for each field
    const fieldPrompts = fields.map(field => {
      let prompt = field.aiPrompt || '';
      
      // If no custom prompt is provided, generate a default one based on field type
      if (!prompt) {
        switch (field.type) {
          case 'name':
            prompt = 'Extract the customer\'s name from the message. If no name is found, return "N/A".';
            break;
          case 'phone':
            prompt = 'Extract the phone number from the message. Format it as international format if possible. If no phone number is found, return "N/A".';
            break;
          case 'product':
            prompt = 'Identify any product or service the customer is interested in. If nothing specific is mentioned, return "N/A".';
            break;
          case 'inquiry':
            prompt = 'Summarize the customer\'s main inquiry or question in a concise manner. If there\'s no clear inquiry, return "N/A".';
            break;
          case 'date':
            prompt = 'Extract any date mentioned in the message. Format as YYYY-MM-DD. If no date is found, return "N/A".';
            break;
          default:
            prompt = `Extract ${field.name} from the message. If not found, return "N/A".`;
        }
      }
      
      return {
        id: field.id,
        prompt
      };
    });

    // Create the system prompt with extraction instructions
    const systemMessage = `You are an AI assistant specialized in extracting structured data from customer messages. 
Extract ONLY the information requested for each field. 
Be precise and return just the extracted information, not complete sentences.
If the information is not found in the message, return "N/A".
Format your response as valid JSON with each field ID as a key.
`;

    // Create the user message with extraction requests
    const userMessage = `Extract the following information from this message:
${fieldPrompts.map(fp => `${fp.id}: ${fp.prompt}`).join('\n')}

Message:
"""
${message}
"""

Return results as JSON.`;

    // Make the API call to Groq
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage }
        ],
        temperature: 0,
        max_tokens: 1024
      })
    });

    // Handle API response
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Groq API error: ${errorData.error?.message || JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    
    // Parse the AI response
    let extractedData: Record<string, string> = {};
    
    try {
      const aiContent = data.choices[0].message.content;
      
      // Try to find and parse JSON in the response
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback: try parsing line by line for field: value format
        const lines = aiContent.split('\n');
        for (const line of lines) {
          const parts = line.split(':');
          if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join(':').trim();
            
            // Get the field ID that matches this key
            const field = fields.find(f => 
              f.id === key || 
              f.name.toLowerCase() === key.toLowerCase()
            );
            
            if (field) {
              extractedData[field.id] = value;
            }
          }
        }
      }
      
      // Additional processing based on field types
      for (const field of fields) {
        // Special handling for name field - if we get N/A but there's name in the message, make extra effort
        if ((field.type === 'name' || field.name.toLowerCase().includes('name')) && 
            (!extractedData[field.id] || extractedData[field.id] === 'N/A')) {
          // Check for common greeting patterns
          const nameMatch = message.match(/Hi,?\s+I(?:')?m\s+([A-Z][a-z]+)/i) || 
                           message.match(/Hello,?\s+(?:this\s+is\s+)?([A-Z][a-z]+)/i) ||
                           message.match(/(?:my|the)\s+name\s+is\s+([A-Z][a-z]+)/i);
          
          if (nameMatch && nameMatch[1]) {
            extractedData[field.id] = nameMatch[1];
          }
        }
        
        // If still no value, set default
        if (!extractedData[field.id]) {
          extractedData[field.id] = 'N/A';
        }
      }
      
      // Handle common AI field names differently from their IDs
      if (extractedData.customerName && !extractedData.name) {
        extractedData.name = extractedData.customerName;
      }
      
      if (extractedData.productInterest && !extractedData.product) {
        extractedData.product = extractedData.productInterest;
      }
      
      if (extractedData.customerInquiry && !extractedData.inquiry) {
        extractedData.inquiry = extractedData.customerInquiry;
      }
      
      console.log('Extracted data:', extractedData);
      return extractedData;
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.error('Raw response:', data.choices[0].message.content);
      
      // Return N/A for all fields
      return fields.reduce((acc, field) => {
        acc[field.id] = 'N/A';
        return acc;
      }, {} as Record<string, string>);
    }
  } catch (error) {
    console.error('Error extracting data from message:', error);
    throw error;
  }
}; 