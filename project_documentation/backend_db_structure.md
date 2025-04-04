# ChatMimic Connect Backend and Database Structure

This document provides a comprehensive overview of the ChatMimic Connect backend architecture, API endpoints, database schemas, services, and integrations. It serves as the central reference for understanding the backend structure and implementation.

## Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Authentication**: Firebase Admin SDK
- **Databases**:
  - **Vector Database**: Supabase (PostgreSQL with pgvector)
  - **NoSQL Database**: Firebase Firestore
- **External APIs**:
  - OpenAI API (embeddings)
  - Groq API (LLM)
  - Google APIs (OAuth, Sheets)

## Server Architecture

The backend follows a modular architecture organized into the following components:

1. **Routes**: API endpoint definitions and handlers
2. **Middleware**: Request processing, validation, and auth
3. **Services**: Business logic and external API interactions
4. **Utils**: Helper functions and utilities
5. **Tests**: Automated test suites

## API Endpoints

### Authentication

- **POST /api/google-oauth/init**
  - Initiates Google OAuth flow
  - No request body required
  - Returns OAuth URL

- **POST /api/google-oauth/exchange-token**
  - Exchanges OAuth code for tokens
  - Request: `{ code: string, state: string }`
  - Returns: `{ access_token, refresh_token, expires_in }`

### Proxy API

- **POST /api/proxy/proxy**
  - Generic proxy for external API calls
  - Request: `{ endpoint, service, method, data, headers, params }`
  - Returns: Response from external API

- **POST /api/proxy/embeddings**
  - Generates embeddings for text
  - Request: `{ text, model, save, type, metadata }`
  - Returns: `{ embedding, model, dimensions }`

- **POST /api/proxy/extract-data**
  - Extracts structured data from text
  - Request: `{ message, fields, model }`
  - Returns: Extracted data object

- **POST /api/proxy/match-documents**
  - Performs vector similarity search
  - Request: `{ text, embedding, threshold, limit }`
  - Returns: `{ matches, count }`

### Configuration

- **GET /api/config**
  - Gets user configuration
  - No request body
  - Returns user config object

- **POST /api/config**
  - Updates user configuration
  - Request: Configuration object
  - Returns: Success status

### Health Check

- **GET /api/health**
  - Service health check
  - No request body
  - Returns: `{ status, message, version, timestamp, env }`

## Middleware

1. **Authentication (auth.js)**
   - `requireAuth`: Enforces authenticated requests
   - `optionalAuth`: Allows unauthenticated but enhances with auth info

2. **Validation (validator.js)**
   - Input validation using express-validator
   - Sanitization to prevent XSS attacks
   - Standardized error handling

3. **CORS**
   - Configured to allow frontend domain
   - Handles preflight requests
   - Sets appropriate headers

4. **Helmet**
   - Security headers
   - Content Security Policy
   - XSS protection

5. **Logging**
   - Request/response logging
   - Error tracking
   - Performance metrics

## Services

1. **AI Service (aiService.js)**
   - `generateEmbeddings`: Creates vector embeddings
   - `extractDataWithGroq`: Extracts structured data using LLMs

2. **Proxy Service (proxyService.js)**
   - Secure communication with external APIs
   - Authentication handling
   - Error normalization

3. **Supabase Service (supabaseService.js)**
   - `saveUserConfig`: Store user configuration
   - `fetchUserConfig`: Retrieve user configuration
   - `saveEmbedding`: Store text embeddings
   - `getEmbedding`: Retrieve embeddings
   - `matchDocuments`: Vector similarity search

4. **Google OAuth (googleOAuth.js)**
   - Google authentication flow
   - Token management
   - API access for Google services

## Database Schemas

### Supabase (PostgreSQL)

1. **user_configs**
   - `id`: UUID primary key
   - `user_id`: Firebase user ID
   - `temperature`: Float
   - `max_tokens`: Integer
   - `full_config`: JSONB
   - `behavior_rules`: JSONB
   - `created_at`: Timestamp
   - `updated_at`: Timestamp

2. **user_embeddings**
   - `id`: UUID primary key
   - `user_id`: Firebase user ID
   - `content`: Text
   - `content_hash`: String
   - `embedding`: Vector (1536)
   - `metadata`: JSONB
   - `created_at`: Timestamp
   - `updated_at`: Timestamp

### Firebase (Firestore)

1. **users**
   - User profile information
   - Authentication metadata
   - Preferences

2. **sessions**
   - Active user sessions
   - Authentication tokens
   - Session metadata

## Security Measures

1. **Authentication**
   - Firebase token verification
   - Role-based access control
   - Token refresh handling

2. **Data Validation**
   - Input validation for all requests
   - Schema validation
   - Type checking

3. **Data Sanitization**
   - XSS prevention
   - SQL injection prevention
   - Metadata cleansing

4. **API Security**
   - Rate limiting
   - IP filtering
   - Request logging

5. **Environment Security**
   - Secure credential storage
   - Environment-specific configurations
   - Production hardening

## Error Handling

1. **Standardized Error Responses**
   - Consistent format: `{ status, message, details, meta }`
   - Appropriate HTTP status codes
   - Detailed error information in development

2. **Centralized Error Logging**
   - Winston logger
   - Error categorization
   - Stack trace preservation

3. **Error Recovery**
   - Graceful degradation
   - Default values
   - Retry mechanisms

## Logging System

1. **Log Levels**
   - ERROR: Critical failures
   - WARN: Issues that don't break functionality
   - INFO: Significant operations
   - DEBUG: Development information
   - TRACE: Detailed execution flow

2. **Log Formats**
   - Development: Human-readable, colorized
   - Production: JSON formatted for parsing

3. **Log Storage**
   - Console output
   - File rotation
   - External logging services (optional)

## Environment Configuration

Configuration is managed through environment variables:

1. **Server**
   - PORT: Server listening port
   - NODE_ENV: Environment (development/production)

2. **Security**
   - TOKEN_ENCRYPTION_KEY: Encryption key
   - CORS_ORIGIN: Allowed origins

3. **External Services**
   - FIREBASE_DATABASE_URL
   - GOOGLE_CLIENT_ID
   - GOOGLE_CLIENT_SECRET
   - OPENAI_API_KEY
   - GROQ_API_KEY
   - SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY

## Production Deployment

1. **Server**
   - Node.js application running as a systemd service
   - Process management with systemd
   - Automatic restarts

2. **Proxy**
   - NGINX as reverse proxy
   - SSL termination
   - Static file serving

3. **SSL**
   - SSL certificates for domains
   - Auto-renewal configuration
   - Secure cipher configuration

## Data Flow

1. **Authentication Flow**
   - Client obtains Firebase token
   - Token included in Authorization header
   - Server verifies token with Firebase Admin SDK
   - User identity attached to request

2. **Embedding Generation Flow**
   - Text received from client
   - Text sent to OpenAI API
   - Embedding vector returned
   - Vector stored in Supabase
   - Vector ID returned to client

3. **Vector Search Flow**
   - Query text or vector received
   - If text, embedding generated
   - Vector similarity search in Supabase
   - Matched documents returned

4. **Google OAuth Flow**
   - OAuth URL generated and returned
   - User authenticates with Google
   - Code returned to callback endpoint
   - Code exchanged for tokens
   - Tokens stored for user

## Performance Considerations

1. **Caching Strategy**
   - Response caching
   - Database query optimization
   - Embedding caching

2. **Request Optimization**
   - Payload size limits
   - Batch processing
   - Asynchronous operations

3. **Database Optimization**
   - Index optimization
   - Query tuning
   - Connection pooling

## Monitoring

1. **Health Checks**
   - Endpoint for system status
   - Component level checks
   - Dependency monitoring

2. **Performance Metrics**
   - Request response times
   - Database query performance
   - External API latency

3. **Resource Utilization**
   - Memory usage
   - CPU utilization
   - Network traffic

## Backup and Recovery

1. **Database Backups**
   - Scheduled Supabase backups
   - Firebase Firestore backups
   - Point-in-time recovery options

2. **Configuration Backups**
   - Environment files
   - NGINX configuration
   - SSL certificates

3. **Recovery Procedures**
   - Database restoration process
   - Server redeployment steps
   - Configuration recovery 