# ChatMimic Connect API Reference

This document provides detailed information about the API endpoints available in the ChatMimic Connect backend.

## Authentication

All API endpoints require authentication using Firebase Authentication. Include the Firebase ID token in the Authorization header:

```
Authorization: Bearer <firebase_id_token>
```

## Response Format

All API responses follow a standard format:

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

## API Endpoints

### Proxy API

#### Generic Proxy

Proxies requests to approved external services with proper authentication.

- **URL**: `/api/proxy/proxy`
- **Method**: `POST`
- **Auth Required**: Yes
- **Request Body**:
  ```json
  {
    "endpoint": "https://api.example.com/resource",
    "service": "openai|groq|supabase",
    "method": "GET|POST|PUT|DELETE",
    "data": {},          // Optional request body
    "headers": {},       // Optional additional headers
    "params": {}         // Optional URL parameters
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      // Response from the external service
    },
    "meta": {
      "responseTime": 123
    }
  }
  ```
- **Error Codes**:
  - `400` - Invalid request parameters
  - `401` - Unauthorized
  - `403` - Forbidden service or endpoint
  - `500` - Server error or error from external service

#### Generate Embeddings

Generates text embeddings using OpenAI's API.

- **URL**: `/api/proxy/embeddings`
- **Method**: `POST`
- **Auth Required**: Yes
- **Request Body**:
  ```json
  {
    "text": "Text to generate embeddings for",
    "model": "text-embedding-3-small",  // Optional, defaults to text-embedding-3-small
    "save": false,                     // Optional, whether to save embedding to database
    "type": "document",                // Required if save=true, type of embedding
    "metadata": {}                     // Optional metadata to store with embedding
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "embedding": [0.1, 0.2, ...],     // Vector of floating point numbers
      "model": "text-embedding-3-small",
      "dimensions": 1536
    },
    "meta": {
      "responseTime": 123
    }
  }
  ```
- **Error Codes**:
  - `400` - Invalid request parameters
  - `401` - Unauthorized
  - `500` - Server error or OpenAI API error

#### Extract Data

Extracts structured data from text using Groq LLM.

- **URL**: `/api/proxy/extract-data`
- **Method**: `POST`
- **Auth Required**: Yes
- **Request Body**:
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
      },
      {
        "name": "items",
        "type": "array"
      }
    ],
    "model": "deepseek-r1-distill-llama-70b"  // Optional, defaults to deepseek model
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "customerName": "John Doe",
      "orderDate": "2023-05-15",
      "items": ["Product 1", "Product 2"]
    },
    "meta": {
      "responseTime": 456,
      "model": "deepseek-r1-distill-llama-70b"
    }
  }
  ```
- **Error Codes**:
  - `400` - Invalid request parameters
  - `401` - Unauthorized
  - `500` - Server error or Groq API error

#### Match Documents

Finds similar documents using vector similarity search.

- **URL**: `/api/proxy/match-documents`
- **Method**: `POST`
- **Auth Required**: Yes
- **Request Body**:
  ```json
  {
    "text": "Query text",                // Either text or embedding is required
    "embedding": [0.1, 0.2, ...],        // Vector to match against
    "threshold": 0.7,                    // Optional similarity threshold (0-1)
    "limit": 5                           // Optional maximum number of results
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "matches": [
        {
          "id": "doc-123",
          "content": "Document content",
          "metadata": { "type": "document", "created": "2023-05-15" },
          "similarity": 0.92
        },
        // ...more matches
      ],
      "count": 3
    },
    "meta": {
      "responseTime": 78,
      "threshold": 0.7,
      "limit": 5
    }
  }
  ```
- **Error Codes**:
  - `400` - Invalid request parameters
  - `401` - Unauthorized
  - `500` - Server error or database error

### Configuration API

#### Save Configuration

Saves user configuration to the database.

- **URL**: `/api/config`
- **Method**: `POST`
- **Auth Required**: Yes
- **Request Body**:
  ```json
  {
    "name": "Default Configuration",
    "behaviorRules": [
      {
        "rule": "Be helpful and concise",
        "description": "Provide helpful answers without unnecessary text"
      },
      {
        "rule": "Use technical language when appropriate",
        "description": "Adjust language for technical contexts"
      }
    ],
    "isActive": true,
    "settings": {
      "temperature": 0.7,
      "maxTokens": 2000,
      "customSettings": {
        "key1": "value1"
      }
    }
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "id": "config-123",
      "userId": "user-456",
      "name": "Default Configuration",
      "behaviorRules": [...],
      "isActive": true,
      "settings": {...},
      "createdAt": "2023-05-15T12:34:56Z",
      "updatedAt": "2023-05-15T12:34:56Z"
    },
    "meta": {
      "responseTime": 45
    }
  }
  ```
- **Error Codes**:
  - `400` - Invalid request parameters
  - `401` - Unauthorized
  - `500` - Server error or database error

#### Get Configuration

Retrieves user configuration from the database.

- **URL**: `/api/config`
- **Method**: `GET`
- **Auth Required**: Yes
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "id": "config-123",
      "userId": "user-456",
      "name": "Default Configuration",
      "behaviorRules": [
        {
          "rule": "Be helpful and concise",
          "description": "Provide helpful answers without unnecessary text"
        },
        {
          "rule": "Use technical language when appropriate",
          "description": "Adjust language for technical contexts"
        }
      ],
      "isActive": true,
      "settings": {
        "temperature": 0.7,
        "maxTokens": 2000,
        "customSettings": {
          "key1": "value1"
        }
      },
      "createdAt": "2023-05-15T12:34:56Z",
      "updatedAt": "2023-05-15T12:34:56Z"
    },
    "meta": {
      "responseTime": 38
    }
  }
  ```
- **Error Codes**:
  - `401` - Unauthorized
  - `404` - Configuration not found
  - `500` - Server error or database error

## Rate Limits

- Default rate limit: 100 requests per minute per user
- Embedding generation: 50 requests per minute per user
- Data extraction: 20 requests per minute per user

Exceeding rate limits will result in a `429 Too Many Requests` response.

## Error Codes

- `400` - Bad Request: Invalid parameters or validation failed
- `401` - Unauthorized: Missing or invalid authentication
- `403` - Forbidden: Not allowed to access this resource
- `404` - Not Found: Resource not found
- `429` - Too Many Requests: Rate limit exceeded
- `500` - Internal Server Error: Unexpected server error
- `502` - Bad Gateway: Error from external service

## Versioning

The current API version is v1. All endpoints are prefixed with `/api`.

Future versions may be accessed using `/api/v2/`, etc. 