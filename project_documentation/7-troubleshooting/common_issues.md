# Common Issues and Solutions

This document covers the most common issues encountered with ChatMimic Connect and their solutions.

## Authentication Issues

### Firebase Authentication Errors

**Issue**: "FirebaseError: Firebase: Error (auth/...)"  
**Solution**: 
- Check if the Firebase project is properly configured
- Ensure Firebase Authentication is enabled in the Firebase console
- Verify that the correct Firebase config is being used in the application

**Issue**: "FirebaseError: Firebase: Error (auth/unauthorized-domain)"  
**Solution**: Add your domain to the authorized domains list in the Firebase console

**Issue**: "Firebase database URL not provided in environment variables"  
**Solution**:
- Ensure the `FIREBASE_DATABASE_URL` environment variable is set in your `.env` file
- Verify that the URL is correct (e.g., `https://denoteai-default-rtdb.firebaseio.com`)
- If the issue persists, add a fallback in the server code:
  ```javascript
  const databaseURL = process.env.FIREBASE_DATABASE_URL || "https://denoteai-default-rtdb.firebaseio.com";
  ```
- Make sure the URL is not accidentally duplicated at the end of another line in the `.env` file

### Token Expiration

**Issue**: "Token expired" or "Invalid token"  
**Solution**: 
- Implement token refresh logic in your application
- Ensure that the user is redirected to login when their session expires

## API Connection Issues

### CORS Errors

**Issue**: "Access to fetch at '...' from origin '...' has been blocked by CORS policy"  
**Solution**: 
- Ensure CORS is properly configured on the server
- Verify that your domain is in the allowed origins list
- If using localhost for development, specifically allow it in CORS configuration

### API Key Problems

**Issue**: "Invalid API key" or "Authentication failed"  
**Solution**: 
- Check that your API keys are correctly set in environment variables
- Verify that your API keys have not expired
- Ensure that the API keys have the correct permissions

## WhatsApp Integration

### Connection Issues

**Issue**: "Failed to connect to WhatsApp Business API"  
**Solution**: 
- Verify your WhatsApp Business API credentials
- Check that your WhatsApp phone number ID is correct
- Ensure your verification token matches what's configured in the Meta dashboard

### Message Delivery Problems

**Issue**: "Message not delivered" or "WhatsApp message failed"  
**Solution**: 
- Check if the recipient's phone number is in the correct format (with country code)
- Verify that the message complies with WhatsApp's policies
- Check the WhatsApp API logs for specific error messages

## Database Issues

### Supabase Connection

**Issue**: "Error connecting to Supabase"  
**Solution**: 
- Verify your Supabase URL and API key
- Check if your Supabase project is active
- Ensure your IP address is not blocked by Supabase

### Embeddings Authentication Issues

**Issue**: "No authenticated user found for embeddings check" when using `checkEmbeddingsAvailable()`  
**Solution**: 
- This occurs when Firebase authentication hasn't fully initialized before making embeddings requests
- Modify the `checkEmbeddingsAvailable()` function to include retry logic:
  ```typescript
  let currentUser = auth.currentUser;
  let attempts = 0;
  const maxAttempts = 5;
  
  while (!currentUser && attempts < maxAttempts) {
    console.log(`No user found yet, waiting... (attempt ${attempts + 1}/${maxAttempts})`);
    // Wait for a short time
    await new Promise(resolve => setTimeout(resolve, 1000));
    currentUser = auth.currentUser;
    attempts++;
  }
  ```
- For development environments, implement a fallback using `test-token-dev` token:
  ```typescript
  if (!currentUser) {
    // Try fallback with development token
    const response = await fetch('/api/proxy/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token-dev',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: "test" })
    });
  }
  ```
- Update the server's auth middleware to accept this development token when needed

**Issue**: "Authentication failed" or "Invalid token" when requesting embeddings  
**Solution**: 
- Ensure Firebase is properly initialized on the server side
- Check that your server environment has the `FIREBASE_DATABASE_URL` environment variable set
- Verify that the authorization header includes a valid Firebase ID token
- In development mode, ensure test tokens are properly recognized by updating auth middleware

### Vector Search Problems

**Issue**: "Function match_documents does not exist"  
**Solution**: 
- Check if the pgvector extension is installed in your Supabase project
- Verify that the match_documents function is correctly defined
- Ensure your embedding vectors have the correct dimension (1536)

**Issue**: "Vector dimensions mismatch"  
**Solution**: 
- Ensure all your embeddings use the same model (e.g., text-embedding-3-small)
- Check that your database schema matches the vector dimensions

## Google Sheets Integration

### Authentication Problems

**Issue**: "Google Sheets API access denied"  
**Solution**: 
- Verify that OAuth2 is correctly set up for Google Sheets
- Check if the required scopes are included in your OAuth request
- Ensure refresh tokens are properly stored and used

**Issue**: "POST http://localhost:3000/api/google-oauth/exchange-token 500 (Internal Server Error)"  
**Solution**:
- Ensure your `.env` file contains all required variables:
  - `GOOGLE_CLIENT_ID`: Your Google OAuth client ID
  - `GOOGLE_CLIENT_SECRET`: Your Google OAuth client secret
  - `TOKEN_ENCRYPTION_KEY`: 32-byte encryption key for token storage
  - `GOOGLE_APPLICATION_CREDENTIALS`: Path to your Firebase service account JSON file
  - `FIREBASE_DATABASE_URL`: Your Firebase database URL
- In development mode, use absolute URLs with `http://localhost:3000` in frontend code when making OAuth requests
- Verify CORS is properly configured in `server/index.js` to handle preflight OPTIONS requests
- Ensure Firebase is properly initialized with valid credentials

**Issue**: "Failed to exchange Google auth code"  
**Solution**:
- Check browser console for detailed error messages
- Verify that the redirect URI matches exactly between client and server
- In development mode, ensure the frontend uses the complete URL (http://localhost:3000) for token exchange
- Ensure you're using a valid Firebase ID token in the Authorization header
- Verify authorization code is properly passed from the callback URL
- Make sure your Google OAuth client ID and client secret are valid and match those registered in Google Cloud Console

**Issue**: "Cannot GET /google-sheets" or white screen when reloading page  
**Solution**:
- This is a common issue in single-page applications (SPAs) when you refresh a route directly
- The latest version of the app includes a redirect handler that properly saves and restores your route
- Always use the `start-dev.sh` script to start the app in development mode which includes this fix
- If you continue to experience issues, navigate to the root URL and then to your desired page
- In production, the server has proper route handlers for all client routes

### Data Synchronization Issues

**Issue**: "Failed to update Google Sheet" or "Data not synchronizing"  
**Solution**: 
- Check if the sheet ID is correct
- Verify that the user has edit permissions for the sheet
- Ensure column mappings match the sheet structure

## N8N Integration

### Workflow Execution Failures

**Issue**: "N8N workflow execution failed"  
**Solution**: 
- Check N8N logs for specific error messages
- Verify that webhook URLs are correctly configured
- Ensure all credentials in N8N are valid

### Connection Issues

**Issue**: "Failed to connect to N8N"  
**Solution**: 
- Verify N8N is running and accessible
- Check that authentication tokens are correct
- Ensure firewall rules allow connections to the N8N server

## Performance Issues

### Slow Response Times

**Issue**: "API responses are slow"  
**Solution**: 
- Check server resource utilization
- Consider implementing caching for frequently used data
- Optimize database queries and indexes

### Memory Leaks

**Issue**: "Application memory usage keeps increasing"  
**Solution**: 
- Check for unclosed database connections
- Verify that event listeners are properly removed
- Look for large objects that aren't being garbage collected

## Application Logic Issues

### AI Agent Not Responding

**Issue**: "AI agent is not sending responses"  
**Solution**: 
- Check if the AI agent status is set to "on"
- Verify that the message format is correct
- Check for errors in the AI response generation

### Incorrect Data Flow

**Issue**: "Data not appearing in expected location"  
**Solution**: 
- Trace the data flow through the application
- Check for configuration issues in data mapping
- Verify event handlers are correctly registered

## Environment Issues

### OpenAI API Key Issues

**Issue**: "OpenAI API key is not configured in the environment" or "Error generating embeddings"  
**Solution**: 
- Check that the `OPENAI_API_KEY` is correctly set in the `server/.env` file
- Ensure there are no line breaks or spaces in the API key string
- For long API keys, do not split them across multiple lines
- If the key is present but still not being recognized, try the following:
  1. Make sure the API key format matches the expected format (starts with `sk-...`)
  2. Remove any quotes around the API key in the .env file
  3. Restart the server after making changes to the .env file
  4. Use the exact API key without any modifications or restrictions
- If the issue persists, verify the OpenAI API key is valid by testing it with the OpenAI CLI or making a test request

### Production vs Development

**Issue**: "Works locally but fails in production"  
**Solution**: 
- Compare environment variables between environments
- Check for hardcoded values that might be environment-specific
- Verify that all dependencies are correctly installed in production
- Ensure all authentication credentials are properly configured in both environments

**Issue**: "Firebase initialization error in development"  
**Solution**:
- Ensure your `GOOGLE_APPLICATION_CREDENTIALS` environment variable is set to the correct path of your Firebase service account JSON file
- Verify that the Firebase project has Firestore enabled
- Check that your service account has the necessary permissions
- Ensure your Firebase database URL is correctly set in the environment variables

**Issue**: "npm error code ENOENT" or "Could not read package.json"  
**Solution**:
- This often happens with paths containing spaces (e.g., "DenoteAI Projects")
- Use the provided `start-dev.sh` script which properly handles paths with spaces
- When manually running commands, always use quotes around paths with spaces
- For npm commands, make sure you're in the correct directory with the package.json file

### Browser Compatibility

**Issue**: "Application doesn't work in specific browsers"  
**Solution**: 
- Check browser console for specific errors
- Ensure polyfills are included for older browsers
- Test with different browser versions

## Development Rules

### Authentication Requirements

- **Always Use Real Firebase Authentication**: No bypasses or shortcuts in any environment.
  - All API endpoints require real Firebase tokens for authentication.
  - Development shortcuts that bypass security are strictly prohibited.
  - Test accounts should be created in Firebase for development purposes.

- **Environment Variables**: 
  - The project uses a Firebase service account for server-side authentication.
  - Firebase credentials should be placed in `server/firebase-credentials.json`.
  - This credentials file must never be committed to version control.

### Testing Authentication

To test authentication during development:
1. Create test users in the Firebase Authentication console for your project.
2. Generate valid Firebase ID tokens for these test users.
3. Use these tokens in your API requests with the Authorization header:
   ```
   Authorization: Bearer your-real-firebase-token
   ```
4. Remember that all authentication in development uses the same standards as production.

## Getting Further Help

If you're still experiencing issues after trying the solutions above:

1. Check the logs for more detailed error information
2. Search for the specific error message in our GitHub repository issues
3. Contact support at support@chatmimic.ai with:
   - A detailed description of the issue
   - Steps to reproduce
   - Error messages or screenshots
   - Your environment details (browser, OS, etc.)

## Firebase Token Verification Issues

### Problem: "Firebase token verification failed" error when making API requests

This error occurs when the server is unable to verify the Firebase authentication token provided in the request.

Possible causes:
1. **Expired Token**: Firebase ID tokens expire after one hour. The client should automatically refresh expired tokens.
2. **Invalid Token Format**: The token may be malformed or corrupted.
3. **Firebase Configuration Mismatch**: The Firebase project configuration between client and server may not match.
4. **Server Time Synchronization**: If the server's clock is significantly off, token verification can fail.

### Solutions:

1. **Check Client-Side Token Generation**:
   - Ensure that `getIdToken(true)` is called to force token refresh when needed
   - Verify that the `Authorization` header is correctly formatted as `Bearer <token>`

2. **Verify Server Firebase Configuration**:
   - Make sure `FIREBASE_DATABASE_URL` in `server/.env` points to the correct Firebase project
   - Confirm that `server/firebase-credentials.json` contains valid service account credentials
   - Check that the client-side Firebase configuration matches the server project

3. **Common Error Codes**:
   - `auth/id-token-expired`: Token has expired - client should refresh the token
   - `auth/argument-error`: Malformed token - check token generation and transmission
   - `auth/invalid-credential`: Invalid Firebase project credentials

4. **For Developers**:
   - Enable detailed logging by setting `DEBUG=true` in the environment
   - Check server logs for specific error messages
   - Verify that the Firebase Admin SDK is correctly initialized 