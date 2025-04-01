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

2. Start development server:
   ```
   npm run dev
   ```

3. Run tests:
   ```
   npm test
   ```

## Security

See [Backend Security](../docs/backend_security.md) for details on the security features implemented in this server.

## API Documentation

For more detailed API documentation, see [API Reference](../docs/api_reference.md).

## License

MIT 