# ChatMimic Connect Server

This directory contains the backend server for the ChatMimic Connect application. The server provides API endpoints for the frontend application to interact with various services including OpenAI, Groq, Google Sheets, and more through secure proxying.

## API Standards

All API endpoints in the ChatMimic Connect application follow these standards:

### Endpoint Path Conventions

- Primary format: `/api/[category]/[endpoint]` (preferred for API calls)
- Alternative format: `/[category]/[endpoint]` (supported for backward compatibility)

### Authentication

Most endpoints require authentication using Firebase Authentication. Include a Firebase ID token in the Authorization header:

```
Authorization: Bearer [firebase_id_token]
```

### Standard Response Format

All API responses follow this standard format:

**Success Response**:
```json
{
  "status": "success",
  "data": { ... },
  "meta": {
    "responseTime": 123  // milliseconds
  }
}
```

**Error Response**:
```json
{
  "status": "error",
  "message": "Error message",
  "details": { ... },  // Optional additional error details
  "meta": {
    "responseTime": 123  // milliseconds
  }
}
```

### Documentation Format

All API route handlers should be documented using the following format:

```javascript
/**
 * Route description
 * METHOD /api/path/to/endpoint
 * 
 * @authentication Required/Optional/Not required
 * @request
 *   - paramName: Description (required/optional)
 *   - anotherParam: Description (required/optional)
 * 
 * @response
 *   Success:
 *     {
 *       "status": "success",
 *       "data": {
 *         // Example response data
 *       },
 *       "meta": {
 *         "responseTime": 123 // milliseconds
 *       }
 *     }
 *   
 *   Error:
 *     {
 *       "status": "error",
 *       "message": "Error message",
 *       "meta": {
 *         "responseTime": 123 // milliseconds
 *       }
 *     }
 */
```

## Project Structure

- `routes/`: API route handlers
- `services/`: Business logic and external service integrations
- `middleware/`: Express middleware (auth, validation, etc.)
- `utils/`: Utility functions and helpers
- `config/`: Configuration files
- `index.js`: Main server entry point

## Features

- **Secure Proxy API**: Handle external API calls without exposing credentials to the client
- **Firebase Authentication**: Protect sensitive endpoints with Firebase Auth
- **Google OAuth**: Integration with Google services, particularly Google Sheets
- **Input Validation**: Comprehensive validation and sanitization for all inputs
- **Logging**: Detailed logging with PII redaction
- **Error Handling**: Standardized error responses with appropriate status codes

## Comprehensive API Documentation

For a complete list of all available API endpoints, refer to the [API_ENDPOINTS.md](./API_ENDPOINTS.md) file.

## Error Handling

All API endpoints should include proper error handling and logging. Use the `logger` utility for consistent logging format:

```javascript
try {
  // API logic here
} catch (error) {
  const responseTime = Date.now() - startTime;
  logger.logError(error, req, 'Error description');
  
  res.status(500).json({
    status: 'error',
    message: error.message || 'Error description',
    meta: {
      responseTime
    }
  });
}
```

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
PORT=3000
NODE_ENV=development|production

# Firebase
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=your-firebase-client-email
FIREBASE_PRIVATE_KEY=your-firebase-private-key
FIREBASE_DATABASE_URL=your-firebase-database-url

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=your-google-redirect-uri
TOKEN_ENCRYPTION_KEY=your-token-encryption-key

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# Groq
GROQ_API_KEY=your-groq-api-key

# Supabase
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-supabase-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Security
CORS_ORIGIN=http://localhost:8080
```

## Development

```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Build for production
npm run build

# Start the production server
npm start

# Run tests
npm test
```

## Security

See [Backend Security](../docs/backend_security.md) for details on the security features implemented in this server.

## License

MIT 