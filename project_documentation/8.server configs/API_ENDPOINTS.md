# ChatMimic Connect API Documentation

This document provides a comprehensive list of all API endpoints in the ChatMimic Connect application.
Use this as a reference when making changes to ensure endpoint consistency.

## Base URL

In production: `https://api.chat.denoteai.tech`
In development: `http://localhost:3000`

## Endpoint Path Conventions

All API endpoints should follow one of these formats:
- Primary format: `/api/[category]/[endpoint]` (preferred for API calls)
- Alternative format for direct access: `/[category]/[endpoint]` (supported for backward compatibility)

## Authentication

Most endpoints require authentication. Include a Firebase ID token in the Authorization header:
```
Authorization: Bearer [firebase_id_token]
```

## Standard Response Format

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

---

## API Endpoints

### Proxy API

#### Generic Proxy

- **URL**: `/api/proxy/proxy`
- **Method**: `POST`
- **Auth Required**: Yes
- **Description**: Proxies requests to approved external services with proper authentication
- **Request Body**:
  ```json
  {
    "endpoint": "https://api.example.com/resource",
    "service": "openai|groq|supabase|google|sheets",
    "method": "GET|POST|PUT|DELETE",
    "data": {},          // Optional request body
    "headers": {},       // Optional additional headers
    "params": {}         // Optional URL parameters
  }
  ```

#### Generate Embeddings

- **URL**: `/api/proxy/embeddings`
- **Method**: `POST`
- **Auth Required**: Yes
- **Description**: Generates text embeddings using OpenAI's API
- **Request Body**:
  ```json
  {
    "text": "Text to generate embeddings for",
    "model": "text-embedding-3-small",  // Optional
    "save": false,                     // Optional
    "type": "document",                // Optional
    "metadata": {}                     // Optional
  }
  ```

#### Extract Data

- **URL**: `/api/proxy/extract-data`
- **Method**: `POST`
- **Auth Required**: Yes
- **Description**: Extracts structured data from text using Groq LLM
- **Request Body**:
  ```json
  {
    "message": "Text to extract data from",
    "fields": [
      {
        "name": "fieldName",
        "type": "string|date|name|product|custom"
      }
    ],
    "model": "deepseek-r1-distill-llama-70b"  // Optional
  }
  ```

#### Match Documents

- **URL**: `/api/proxy/match-documents`
- **Method**: `POST`
- **Auth Required**: Yes
- **Description**: Finds similar documents using vector similarity search
- **Request Body**:
  ```json
  {
    "text": "Query text",                // Either text or embedding is required
    "embedding": [0.1, 0.2, ...],        // Vector to match against
    "threshold": 0.7,                    // Optional
    "limit": 5                           // Optional
  }
  ```

#### Dynamic Proxy Routes

- **URL**: `/api/proxy/:service/*`
- **Method**: `POST`
- **Auth Required**: Yes
- **Description**: Dynamic endpoint that handles all other proxy requests to supported services
- **URL Parameters**:
  - `:service`: Service identifier (openai, groq, supabase, google, sheets)
- **Request Body**:
  ```json
  {
    "method": "GET|POST|PUT|DELETE",
    "data": {},          // Optional
    "headers": {},       // Optional
    "params": {}         // Optional
  }
  ```

### Configuration API

#### Save Configuration

- **URL**: `/api/config`
- **Method**: `POST`
- **Auth Required**: Yes
- **Description**: Creates or updates a user's configuration including behavior rules and settings
- **Request Body**:
  ```json
  {
    "name": "Configuration Name",
    "behaviorRules": [
      {
        "rule": "Rule text",
        "description": "Rule description"
      }
    ],
    "isActive": true,
    "settings": {
      "temperature": 0.7,
      "maxTokens": 2000,
      "customSettings": {}
    }
  }
  ```

#### Get Configuration

- **URL**: `/api/config`
- **Method**: `GET`
- **Auth Required**: Yes
- **Description**: Retrieves the current user's configuration

### Google OAuth API

#### Exchange Token

- **URL**: `/api/google-oauth/exchange-token`
- **Method**: `POST`
- **Auth Required**: No
- **Description**: Exchanges an authorization code for access and refresh tokens
- **Request Body**:
  ```json
  {
    "code": "authorization_code"
  }
  ```

#### Refresh Token

- **URL**: `/api/google-oauth/refresh-token`
- **Method**: `POST`
- **Auth Required**: Yes
- **Description**: Refreshes an expired access token using the stored refresh token

### Google Sheets API

#### Get Status

- **URL**: `/api/google-sheets/status`
- **Method**: `GET`
- **Auth Required**: Yes
- **Description**: Verifies if the user has a valid Google Sheets connection

#### Disconnect

- **URL**: `/api/google-sheets/disconnect`
- **Method**: `POST`
- **Auth Required**: Yes
- **Description**: Revokes access to Google Sheets and removes stored credentials

#### Test Connection

- **URL**: `/api/google-sheets/test-connection`
- **Method**: `GET`
- **Auth Required**: Yes
- **Description**: Makes a test request to the Google Sheets API to verify connectivity

### Health Check

#### Server Health

- **URL**: `/api/health` or `/health`
- **Method**: `GET`
- **Auth Required**: No
- **Description**: Checks if the server is running 