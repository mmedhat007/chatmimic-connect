# ChatMimic Connect - Server

Secure backend for the ChatMimic Connect application, providing proxy endpoints for external services, user configuration management, and secure embedding generation.

## Features

- **Secure Proxy API**: Handle external API calls without exposing credentials to the client
- **Firebase Authentication**: Protect sensitive endpoints with Firebase Auth
- **Input Validation**: Comprehensive validation and sanitization for all inputs
- **Logging**: Detailed logging with PII redaction
- **Error Handling**: Standardized error responses with appropriate status codes

## API Endpoints

### Proxy API

#### Generic Proxy
- **POST** `/api/proxy/proxy`
- Proxies requests to approved external services
- Requires authentication
- Request Body:
  ```json
  {
    "endpoint": "https://api.example.com/resource",
    "service": "openai|groq|supabase",
    "method": "GET|POST|PUT|DELETE",
    "data": {},
    "headers": {},
    "params": {}
  }
  ```

#### Generate Embeddings
- **POST** `/api/proxy/embeddings`
- Generates text embeddings using OpenAI's API
- Requires authentication
- Request Body:
  ```json
  {
    "text": "Text to generate embeddings for",
    "model": "text-embedding-3-small",
    "save": false,
    "type": "document",
    "metadata": {}
  }
  ```

#### Extract Data
- **POST** `/api/proxy/extract-data`
- Extracts structured data from text using Groq LLM
- Requires authentication
- Request Body:
  ```json
  {
    "message": "Text to extract data from",
    "fields": [
      {
        "name": "customerName",
        "type": "string"
      },
      {
        "name": "orderDate",
        "type": "date"
      }
    ],
    "model": "deepseek-r1-distill-llama-70b"
  }
  ```

#### Match Documents
- **POST** `/api/proxy/match-documents`
- Finds similar documents using vector similarity
- Requires authentication
- Request Body:
  ```json
  {
    "text": "Query text",
    "embedding": [0.1, 0.2, ...],  // Alternative to text
    "threshold": 0.7,
    "limit": 5
  }
  ```

### Configuration API

#### Save Configuration
- **POST** `/api/config`
- Saves user configuration to Supabase
- Requires authentication
- Request Body:
  ```json
  {
    "name": "Default Configuration",
    "behaviorRules": [
      {
        "rule": "Be helpful and concise",
        "description": "Provide helpful answers without unnecessary text"
      }
    ],
    "isActive": true,
    "settings": {
      "temperature": 0.7,
      "maxTokens": 2000
    }
  }
  ```

#### Get Configuration
- **GET** `/api/config`
- Retrieves user configuration from Supabase
- Requires authentication

## Environment Variables

Create a `.env` file with the following variables:

```
PORT=3000
NODE_ENV=development|production

# Firebase
FIREBASE_DATABASE_URL=

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
TOKEN_ENCRYPTION_KEY=

# OpenAI
OPENAI_API_KEY=

# Groq
GROQ_API_KEY=

# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Security
CORS_ORIGIN=http://localhost:8080
```

## Development

1. Install dependencies:
   ```
   npm install
   ```

2. Copy the example environment file:
   ```
   cp .env.example .env
   ```

3. Update the `.env` file with your API keys and other configuration.

4. Start the development server:
   ```
   npm run dev
   ```

### Testing the API

We've added an API testing script to help verify the functionality of the endpoints. This is especially useful after making changes to ensure everything is working correctly.

To run the tests:

```
cd tests
node api-test.js
```

By default, it will test all endpoints on localhost:3000. You can customize the behavior with these options:

```
Options:
  -u, --url URL              Base URL for API (default: http://localhost:3000)
  -t, --token TOKEN          Auth token for authenticated requests
  --no-embeddings            Skip embeddings tests
  --no-google-sheets         Skip Google Sheets tests
  --no-proxy                 Skip general proxy endpoint tests
  -v, --verbose              Show detailed error information
```

Example of testing against production with an auth token:

```
node api-test.js -u https://api.chatmimic.com -t "your-firebase-auth-token" -v
```

### Recent API Fixes

We've recently fixed several issues in the API:

1. **Embeddings Endpoint**: Fixed response format and error handling.
2. **Google Sheets Integration**: Improved authentication, fixed disconnect endpoint.
3. **Proxy Service**: Enhanced error handling and request validation.
4. **CORS Configuration**: Updated to allow proper cross-origin requests in development.
5. **Authentication**: Improved token handling and error reporting.

If you encounter any issues, please run the test script with verbose output and check the logs for detailed error information.

## Security

See [Backend Security](../docs/backend_security.md) for details on the security features implemented in this server.

## API Documentation

For more detailed API documentation, see [API Reference](../docs/api_reference.md).

## License

MIT 