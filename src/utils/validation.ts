/**
 * Utility functions for input validation and sanitization
 */

// Email regex pattern
const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Phone number regex pattern (international format)
const PHONE_PATTERN = /^\+?[1-9]\d{1,14}$/;

// URL regex pattern
const URL_PATTERN = /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/;

/**
 * Validates an email address
 * @param email The email address to validate
 * @returns Boolean indicating if the email is valid
 */
export const isValidEmail = (email: string): boolean => {
  return EMAIL_PATTERN.test(email.trim());
};

/**
 * Validates a phone number (basic validation)
 * @param phone The phone number to validate
 * @returns Boolean indicating if the phone number is valid
 */
export const isValidPhone = (phone: string): boolean => {
  return PHONE_PATTERN.test(phone.trim());
};

/**
 * Validates a URL
 * @param url The URL to validate
 * @returns Boolean indicating if the URL is valid
 */
export const isValidUrl = (url: string): boolean => {
  return URL_PATTERN.test(url.trim());
};

/**
 * Validates that a string is not empty after trimming
 * @param value The string to validate
 * @returns Boolean indicating if the string is not empty
 */
export const isNotEmpty = (value: string): boolean => {
  return value.trim().length > 0;
};

/**
 * Validates string length
 * @param value The string to validate
 * @param min The minimum length
 * @param max The maximum length
 * @returns Boolean indicating if the string length is within the specified range
 */
export const isValidLength = (value: string, min: number, max: number): boolean => {
  const length = value.trim().length;
  return length >= min && length <= max;
};

/**
 * Sanitizes a string to prevent XSS
 * Basic implementation - for production, use a dedicated library like DOMPurify
 * @param value The string to sanitize
 * @returns The sanitized string
 */
export const sanitizeString = (value: string): string => {
  // Replace HTML special characters with their entity equivalents
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Validates and sanitizes an input object against a schema
 * @param input The input object to validate
 * @param schema The validation schema defining the rules for each field
 * @returns An object containing validation results and sanitized data
 */
export const validateAndSanitize = <T extends Record<string, any>>(
  input: Record<string, any>,
  schema: Record<keyof T, {
    type: 'string' | 'number' | 'boolean' | 'email' | 'phone' | 'url';
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: RegExp;
  }>
): { 
  valid: boolean; 
  errors: Record<string, string>;
  sanitized: Partial<T>;
} => {
  const result = {
    valid: true,
    errors: {} as Record<string, string>,
    sanitized: {} as Partial<T>
  };

  for (const [field, rules] of Object.entries(schema)) {
    const value = input[field];
    
    // Check if required
    if (rules.required && (value === undefined || value === null || value === '')) {
      result.errors[field] = `${field} is required`;
      result.valid = false;
      continue;
    }
    
    // Skip validation for optional empty fields
    if (!rules.required && (value === undefined || value === null || value === '')) {
      continue;
    }
    
    // Type-specific validation
    switch (rules.type) {
      case 'string':
        if (typeof value !== 'string') {
          result.errors[field] = `${field} must be a string`;
          result.valid = false;
        } else {
          // Check string length if specified
          if (rules.minLength !== undefined && value.length < rules.minLength) {
            result.errors[field] = `${field} must be at least ${rules.minLength} characters`;
            result.valid = false;
          }
          if (rules.maxLength !== undefined && value.length > rules.maxLength) {
            result.errors[field] = `${field} must be at most ${rules.maxLength} characters`;
            result.valid = false;
          }
          // Check pattern if specified
          if (rules.pattern && !rules.pattern.test(value)) {
            result.errors[field] = `${field} has an invalid format`;
            result.valid = false;
          }
          // Sanitize string
          result.sanitized[field as keyof T] = sanitizeString(value) as any;
        }
        break;
        
      case 'email':
        if (!isValidEmail(value)) {
          result.errors[field] = `${field} must be a valid email address`;
          result.valid = false;
        } else {
          result.sanitized[field as keyof T] = value.trim() as any;
        }
        break;
        
      case 'phone':
        if (!isValidPhone(value)) {
          result.errors[field] = `${field} must be a valid phone number`;
          result.valid = false;
        } else {
          result.sanitized[field as keyof T] = value.trim() as any;
        }
        break;
        
      case 'url':
        if (!isValidUrl(value)) {
          result.errors[field] = `${field} must be a valid URL`;
          result.valid = false;
        } else {
          result.sanitized[field as keyof T] = value.trim() as any;
        }
        break;
        
      case 'number':
        const num = Number(value);
        if (isNaN(num)) {
          result.errors[field] = `${field} must be a number`;
          result.valid = false;
        } else {
          // Check range if specified
          if (rules.min !== undefined && num < rules.min) {
            result.errors[field] = `${field} must be at least ${rules.min}`;
            result.valid = false;
          }
          if (rules.max !== undefined && num > rules.max) {
            result.errors[field] = `${field} must be at most ${rules.max}`;
            result.valid = false;
          }
          result.sanitized[field as keyof T] = num as any;
        }
        break;
        
      case 'boolean':
        if (typeof value !== 'boolean') {
          result.errors[field] = `${field} must be a boolean`;
          result.valid = false;
        } else {
          result.sanitized[field as keyof T] = value as any;
        }
        break;
    }
  }
  
  return result;
}; 