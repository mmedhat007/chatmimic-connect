// AI service for data extraction
import { SheetColumn } from './googleSheets';

// Use the Groq API with DeepSeek r1 model for data extraction
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || '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';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

interface AIResponse {
  [key: string]: string;
}

/**
 * Extract data from a message using AI
 * @param message The message to extract data from
 * @param columns The columns to extract data for
 * @returns An object with keys matching the column IDs and values extracted by AI
 */
export const extractDataFromMessage = async (
  message: string, 
  columns: SheetColumn[]
): Promise<AIResponse> => {
  try {
    // Create system prompt with extraction instructions
    const systemPrompt = `
You are an advanced information extraction system that carefully analyzes WhatsApp messages to extract specific data points.
Your task is to extract the following information from customer messages:
${columns.map(col => `- ${col.name}: ${col.description}`).join('\n')}

For each data point:
1. Thoroughly analyze the entire message for relevant information
2. Provide only the extracted value without explanations
3. If you're unsure or the information is not present, respond with "N/A"
4. Keep extracted values concise and directly usable

Respond ONLY with a valid JSON object containing the requested information - no preamble, explanations, or other text.
`;

    // Construct the prompt for each extraction task
    const userPrompt = `Extract the following from this WhatsApp message:
${columns.map(col => `- ${col.name}`).join('\n')}

MESSAGE:
${message}

Return ONLY a JSON object with these keys: ${columns.map(col => col.id).join(', ')}`;

    // Make API request to Groq with DeepSeek r1 model
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-r1',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('AI extraction error:', error);
      throw new Error(`AI extraction failed: ${error.error?.message || 'Unknown error'}`);
    }

    const result = await response.json();
    let content = result.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in AI response');
    }

    // Parse the JSON response
    let extractedData: AIResponse;
    
    try {
      // Try to parse the JSON, handling cases where it might include markdown code blocks
      if (content.includes('```json')) {
        content = content.split('```json')[1].split('```')[0].trim();
      } else if (content.includes('```')) {
        content = content.split('```')[1].split('```')[0].trim();
      }
      
      extractedData = JSON.parse(content);
    } catch (error) {
      console.error('Error parsing AI response:', error, content);
      throw new Error('Failed to parse AI response');
    }

    // Ensure all requested columns are present in the response
    const extractedResult: AIResponse = {};
    columns.forEach(column => {
      extractedResult[column.id] = extractedData[column.id] || 'N/A';
    });

    // Add timestamp if it was requested
    if (columns.some(col => col.type === 'date')) {
      const timestampColumn = columns.find(col => col.type === 'date');
      if (timestampColumn) {
        extractedResult[timestampColumn.id] = new Date().toISOString();
      }
    }

    return extractedResult;
  } catch (error) {
    console.error('Error in AI data extraction:', error);
    
    // Return N/A for all columns on error
    const fallbackResult: AIResponse = {};
    columns.forEach(column => {
      fallbackResult[column.id] = 'N/A';
    });
    
    // Add timestamp if it was requested
    if (columns.some(col => col.type === 'date')) {
      const timestampColumn = columns.find(col => col.type === 'date');
      if (timestampColumn) {
        fallbackResult[timestampColumn.id] = new Date().toISOString();
      }
    }
    
    return fallbackResult;
  }
}; 