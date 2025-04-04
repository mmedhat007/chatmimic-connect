/**
 * Validators for proxy API endpoints
 */

const { body, oneOf } = require('express-validator');

/**
 * Validators for the generic proxy endpoint
 */
const proxyRequestValidators = [
  // Endpoint is required
  body('endpoint')
    .notEmpty().withMessage('Endpoint is required')
    .isString().withMessage('Endpoint must be a string')
    .isURL({ protocols: ['http', 'https'] }).withMessage('Endpoint must be a valid URL')
    .trim(),
  
  // Service is required
  body('service')
    .notEmpty().withMessage('Service is required')
    .isString().withMessage('Service must be a string')
    .isIn(['groq', 'supabase', 'openai', 'google']).withMessage('Service must be one of: groq, supabase, openai, google')
    .trim(),
  
  // Method is optional but should be a valid HTTP method if provided
  body('method')
    .optional()
    .isString().withMessage('Method must be a string')
    .isIn(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).withMessage('Method must be a valid HTTP method')
    .trim(),
  
  // Headers should be an object if provided
  body('headers')
    .optional()
    .isObject().withMessage('Headers must be an object')
    // Now allow Authorization header for Google API calls
    .custom((headers, { req }) => {
      if (headers && (headers.Authorization || headers.authorization) && req.body.service !== 'google') {
        throw new Error('Authorization header is not allowed except for Google API calls');
      }
      return true;
    }),
  
  // Data can be any valid JSON object or array
  body('data')
    .optional()
    .custom((data) => {
      try {
        // Ensure data can be stringified
        JSON.stringify(data);
        return true;
      } catch (error) {
        throw new Error('Data must be a valid JSON object or array');
      }
    }),
  
  // Params should be an object if provided
  body('params')
    .optional()
    .isObject().withMessage('Params must be an object')
];

/**
 * Validators for the embeddings endpoint
 */
const embeddingsValidators = [
  // Text to embed is required
  body('text')
    .notEmpty().withMessage('Text is required')
    .isString().withMessage('Text must be a string')
    .isLength({ min: 1, max: 8192 }).withMessage('Text must be between 1 and 8192 characters')
    .trim(),
  
  // Model is optional but must be valid if provided
  body('model')
    .optional()
    .isString().withMessage('Model must be a string')
    .isIn(['text-embedding-3-small', 'text-embedding-3-large']).withMessage('Model must be a valid OpenAI embedding model')
    .trim()
];

/**
 * Validators for the extract data endpoint
 */
const extractDataValidators = [
  // Message is required
  body('message')
    .notEmpty().withMessage('Message is required')
    .isString().withMessage('Message must be a string')
    .isLength({ min: 1, max: 4096 }).withMessage('Message must be between 1 and 4096 characters')
    .trim(),
  
  // Fields must be an array of objects
  body('fields')
    .isArray({ min: 1 }).withMessage('Fields must be a non-empty array')
    .custom((fields) => {
      if (!fields.every(field => 
        typeof field === 'object' && 
        field !== null && 
        typeof field.name === 'string' &&
        typeof field.type === 'string'
      )) {
        throw new Error('Each field must have a name and type property');
      }
      return true;
    }),
  
  // Model is optional but must be valid if provided
  body('model')
    .optional()
    .isString().withMessage('Model must be a string')
    .isIn(['deepseek-r1-distill-llama-70b']).withMessage('Model must be a valid Groq model')
    .trim()
];

/**
 * Validators for the document matching endpoint
 */
const matchDocumentsValidators = [
  // One of text or embedding is required
  oneOf([
    body('text').exists().notEmpty(),
    body('embedding').exists().isArray()
  ], 'Either text or embedding must be provided'),
  
  // Text validation if provided
  body('text')
    .if(body('text').exists())
    .isString().withMessage('Text must be a string')
    .isLength({ min: 1, max: 8192 }).withMessage('Text must be between 1 and 8192 characters')
    .trim(),
  
  // Embedding validation if provided
  body('embedding')
    .if(body('embedding').exists())
    .isArray().withMessage('Embedding must be an array')
    .custom((embedding) => {
      if (!embedding.every(value => typeof value === 'number')) {
        throw new Error('Embedding must be an array of numbers');
      }
      return true;
    }),
  
  // Threshold validation
  body('threshold')
    .optional()
    .isFloat({ min: 0, max: 1 }).withMessage('Threshold must be a number between 0 and 1'),
  
  // Limit validation
  body('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be an integer between 1 and 100')
];

module.exports = {
  proxyRequestValidators,
  embeddingsValidators,
  extractDataValidators,
  matchDocumentsValidators
}; 