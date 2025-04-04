# API Routes Documentation

This document outlines all backend API routes available in the ChatMimic Connect application.

## Route Prefixes

All API endpoints can be accessed using two different prefixes:

- `/api/*` - Main prefix used in production environments
- `/*` - Direct access (also supported in production)

For example, the health check endpoint is available at both:
- `/api/health`
- `/health`

When using the API in client code, always use the `/api/` prefix for consistency.

## API Endpoints

### Health Check

| Method | Path | Description | Auth Required |
|--------|------|-------------|--------------|
| GET | `/api/health` | Check API server status | No |

### Authentication

| Method | Path | Description | Auth Required |
|--------|------|-------------|--------------|
| POST | `/api/auth/login` | User login | No |
| POST | `/api/auth/register` | User registration | No |
| GET | `/api/auth/me` | Get current user | Yes |

### Proxy Service

The proxy endpoints allow secure communication with external services through the backend.

| Method | Path | Description | Auth Required |
|--------|------|-------------|--------------|
| POST | `/api/proxy` | Generic proxy endpoint | Yes |
| POST | `/api/proxy/:service/*` | Service-specific proxy endpoint | Yes |
| POST | `/api/proxy/embeddings` | Generate embeddings | Yes |
| POST | `/api/proxy/extract-data` | Extract structured data | Yes |
| POST | `/api/proxy/match-documents` | Find similar documents | Yes |

Valid services for the proxy endpoint include:
- `groq`
- `openai`
- `supabase`
- `google`
- `sheets`

### Google OAuth

| Method | Path | Description | Auth Required |
|--------|------|-------------|--------------|
| POST | `/api/google-oauth/exchange-token` | Exchange OAuth code for tokens | Optional |
| POST | `/api/google-oauth/refresh-token` | Refresh expired access token | Yes |

### Google Sheets Integration

| Method | Path | Description | Auth Required |
|--------|------|-------------|--------------|
| GET | `/api/google-sheets/status` | Check connection status | Yes |
| POST | `/api/google-sheets/disconnect` | Revoke access and remove credentials | Yes |
| GET | `/api/google-sheets/test-connection` | Test API access | Yes |

### Configuration

| Method | Path | Description | Auth Required |
|--------|------|-------------|--------------|
| GET | `/api/config` | Get user configuration | Yes |
| POST | `/api/config` | Save user configuration | Yes |
| GET | `/api/configs` | Get all configurations | Yes |

## Using API Routes in Client Code

### Direct API Calls

For direct API calls, use the `apiRequest` utility function:

```typescript
import { apiRequest } from '../utils/api';

// Example GET request
const config = await apiRequest('/api/config');

// Example POST request
await apiRequest('/api/config', {
  method: 'POST',
  body: JSON.stringify(configData)
});
```

### Proxy API Calls

For external service requests (Google, OpenAI, etc.), use the `proxyRequest` utility:

```typescript
import { proxyRequest } from '../utils/api';

// Example Google API request
const sheets = await proxyRequest(
  'google',
  'https://www.googleapis.com/drive/v3/files',
  {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  }
);
```

## Path Naming Conventions

To maintain consistency and avoid errors:

1. **Backend Routes:**
   - Use kebab-case for route paths (e.g., `/api/google-sheets/test-connection`)
   - Group related functionality (e.g., `/api/google-sheets/*`)

2. **Frontend Route Handling:**
   - Always use the `/api/` prefix when making requests
   - Use direct paths for Google API endpoints (e.g., `https://sheets.googleapis.com/v4/...`)

3. **Authentication:**
   - Add Firebase authentication headers automatically via utility functions

## Service-Specific Notes

### Google Sheets Integration

The Google Sheets integration uses two different route structures:

1. For OAuth flows and credential management:
   - Use the direct `/api/google-sheets/*` and `/api/google-oauth/*` endpoints

2. For API calls to Google's services:
   - Use the proxy endpoint: `/api/proxy/google/*`

Always check the Authentication header when making Google API requests - the token should be passed with the "Bearer " prefix.

### Important: Keep This Documentation Updated

**When adding new routes or changing existing ones:**

1. Update this documentation file
2. Ensure both client and server code use matching paths
3. Test the routes to verify they work as expected 