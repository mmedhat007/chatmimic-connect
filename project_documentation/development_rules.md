# ChatMimic Connect - Development Rules & Guidelines

This document records specific development rules and guidelines that must be followed when working on the ChatMimic Connect project. These rules ensure code quality, maintainability, and prevent potential issues.

## Database Operations

### 1. Targeted Field Updates

**RULE**: Never make changes to a database field which might remove other fields in the process. Always specify the exact field where changes should happen.

**CORRECT**:
```typescript
// Only update the specific nested field
await updateDoc(doc(db, 'Users', userUID), {
  'workflows.whatsapp_agent.sheetConfigs': sheetConfigs
});
```

**INCORRECT**:
```typescript
// This might overwrite the entire workflows object, removing other fields
await updateDoc(doc(db, 'Users', userUID), {
  workflows: { whatsapp_agent: { sheetConfigs } }
});
```

### 2. Data Structure Consistency

**RULE**: Follow the established data structure patterns consistently.

#### Workflow Structure

All workflows under the `workflows` map share a common structure:
- `executions_used`: Number - Count of executions used
- `limit`: Number - Usage limit
- `reset_date`: Timestamp - Date when limit resets
- `paid`: Boolean - Indicates if paid
- `setup_completed`: Boolean - Indicates if agent setup is completed

In addition to these common fields, each workflow type may have specific fields:

- **WhatsApp Agent Workflow**:
  - `sheetConfigs`: Array - Google Sheets configuration data
  - `lifecycleTagConfigs`: Array - Lifecycle tagging rule configurations

#### Credential Storage

- Store Google Sheets OAuth credentials under `credentials.googleSheetsOAuth`
- Store WhatsApp credentials under `credentials.whatsappCredentials`
- Store Google Analytics credentials under `credentials.googleAuthCredentials`

## Code Quality

### 1. Error Handling

**RULE**: Always include proper error handling and provide meaningful error messages.

```typescript
try {
  // Operation that might fail
} catch (error) {
  console.error('Specific context of what failed:', error);
  // Handle the error appropriately
}
```

### 2. Authentication Checks

**RULE**: Always check for user authentication before performing operations that require it.

```typescript
const userUID = getCurrentUser();
if (!userUID) {
  throw new Error('User not authenticated');
  // or return appropriate error response
}
```

### 3. Data Validation

**RULE**: Validate user inputs and data from external sources before processing.

### 4. Console Statements in Production

**RULE**: Never include console.log statements in production code.

All `console.log`, `console.info`, and similar debugging statements should be removed for production builds. Use the following approaches:

**For Frontend**:
- Use the `vite-plugin-remove-console` plugin configured in `vite.config.ts`
- For any necessary debugging in production, use `console.error` for critical errors only

**For Backend**:
- Always use the `logger` utility from `server/utils/logger.js` instead of direct console methods
- Logger will automatically suppress non-error output in production mode

**Example**:
```javascript
// Bad - direct console usage
console.log('Processing message:', message);

// Good - using logger utility
const logger = require('./utils/logger');
logger.log('Processing message:', message);
```

### 5. OAuth Implementation

**RULE**: Always implement OAuth flows with proper state preservation and authentication resilience.

**Requirements**:
- Include a state parameter with user context in OAuth requests
- Implement retry mechanisms for authentication state restoration
- Exchange tokens server-side rather than client-side
- Encrypt sensitive tokens before storage
- Never store client secrets in frontend code

**Example**:
```typescript
// Creating state parameter
const stateParam = btoa(JSON.stringify({
  uid: userUID,
  timestamp: Date.now()
}));

// Use in authorization URL
const authUrl = `https://service.com/oauth?client_id=${clientId}&state=${encodeURIComponent(stateParam)}`;
```

## Documentation

### 1. Update Documentation with Changes

**RULE**: Always update the project documentation when making significant changes to the codebase.

- Update `db_structure.md` when changing database structures
- Update `project_specs.md` when adding new features or making major changes
- Update `user_flow.md` when changing user interactions or flows
- Update `google_sheets_integration.md` when modifying the Google Sheets functionality
- Update any other relevant documentation

### 2. Code Comments

**RULE**: Provide clear comments for complex logic or important functions.

```typescript
/**
 * Processes incoming WhatsApp messages and updates Google Sheets
 * based on active configurations.
 * 
 * @param phoneNumber The sender's phone number
 * @param messageId The unique message ID
 * @returns Promise<boolean> Success status
 */
```

## Environment Setup

### 1. Environment Variables

**RULE**: Use environment variables for sensitive information and configuration values.

- Store API keys in `.env` file
- Access via `import.meta.env.VARIABLE_NAME` (for Vite projects)
- Never commit `.env` files to the repository
- Move sensitive token exchange operations to the backend

**Server-side credentials**:
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` must be in server-side environment
- `TOKEN_ENCRYPTION_KEY` should be a 32-byte random hex string generated specifically for the deployment

## UI/UX Guidelines

### 1. Responsive Design

**RULE**: Ensure all UI components work correctly on different screen sizes.

### 2. Loading States

**RULE**: Always provide loading indicators for asynchronous operations.

### 3. Authentication Error Handling

**RULE**: Implement robust error handling for authentication flows:

- Show clear error messages to users
- Provide retry options when authentication fails
- Implement appropriate timeouts and fallbacks
- Preserve authentication state across redirects when possible

## Version Control

### 1. Commit Messages

**RULE**: Write clear, descriptive commit messages that explain what changes were made and why.

## Security Guidelines

### 1. Backend Proxy for API Calls

**RULE**: Use backend proxy endpoints for any API calls requiring client secrets or API keys.

```javascript
// Bad - direct API call with secrets in frontend
const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
  client_id: GOOGLE_CLIENT_ID,
  client_secret: GOOGLE_CLIENT_SECRET, // Never expose this in frontend
  code,
  redirect_uri: redirectUri,
  grant_type: 'authorization_code'
});

// Good - using backend proxy
const response = await fetch('/api/google-oauth/exchange-token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}` // User's firebase token
  },
  body: JSON.stringify({
    code,
    redirectUri
  })
});
```

### 2. Authentication State Management

**RULE**: Always handle authentication state carefully during OAuth redirects.

- Use state parameters to maintain context
- Implement retry mechanisms when auth state might be lost
- Store session information securely

## Security Rules

### Authentication and Authorization

1. **No Security Bypasses in Development**:
   - Development environment must enforce the same authentication rules as production.
   - Absolutely no shortcuts, bypasses, or mock users are allowed.
   - Always use real Firebase authentication, even in development.
   - Test users must be properly created in Firebase for development purposes.

2. **Sensitive Data**:
   - Never hardcode credentials, API keys, or secrets in the codebase.
   - Use environment variables for all sensitive configuration.
   - For development, each developer should have their own Firebase service account.

3. **Firebase Service Account**:
   - The `GOOGLE_APPLICATION_CREDENTIALS` environment variable is mandatory in all environments.
   - Each developer must obtain and use their own Firebase service account file.
   - The server will refuse to start without valid Firebase credentials.

---

This document will be updated as new rules and guidelines are established. 