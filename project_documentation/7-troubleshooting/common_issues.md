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

**Issue**: Embeddings API returns 404 (POST /api/proxy/embeddings) 
**Solution**:
- **Vite Proxy Configuration**: Ensure `vite.config.ts` correctly proxies requests starting with `/api` to the backend server, especially when running in development mode. Verify the `proxy` settings under `server`. Example:
  ```ts
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // Your backend server address
        changeOrigin: true,
      },
    },
  },
  ```
- **Server-Side Route**: Confirm the backend server (e.g., `server/index.js`) has a route defined to handle `/api/proxy/embeddings` (or more generally `/api/proxy/*`) and correctly forwards the request to the intended embeddings service (e.g., Groq, OpenAI).
- **Server Logging**: Enhance server-side logging around the proxy routes and the embeddings service call to capture more details about incoming requests and potential errors during forwarding or from the external API.
- **Production vs. Development**: Check if the issue occurs only in development (likely Vite proxy) or also production (could be Nginx config, server route, or external service issue).

## Google Sheets Integration

### Authentication Problems

**Issue**: "Google Sheets API access denied"  
**Solution**: 
- Verify that OAuth2 is correctly set up for Google Sheets
- Check if the required scopes are included in your OAuth request
- Ensure refresh tokens are properly stored and used

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

### Server Startup Crash Loop (Systemd Deactivating/Activating)

**Issue**: The Node.js backend service (e.g., run via systemd) immediately crashes upon starting and enters a restart loop (logs show repeated "Deactivated successfully" followed by "Started" messages) without logging specific application errors.

**Debugging Steps**:
1.  **Check Systemd Logs**: `sudo journalctl -u <your-service-name>.service -f`. If only activation/deactivation messages appear, the crash is happening before application-level logging is fully initialized or flushed.
2.  **Manual Execution**: Try running the application manually *as the service user* and *in the service working directory*, mimicking the systemd environment:
    ```bash
    sudo -iu <service_user>
    cd <service_working_directory>
    # If using systemd EnvironmentFile, manually export for testing:
    export $(grep -v '^#' <path_to_env_file> | xargs)
    # Run the app directly:
    node <entry_point_file.js> # e.g., node index.js
    ```
    Observe the terminal for the *exact* error message printed upon crashing.
3.  **Granular Logging**: If manual execution doesn't immediately reveal the error, add `console.log('[DEBUG] Step X...')` statements incrementally:
    *   Start at the very top of the main entry point file (`index.js`).
    *   Place logs before and after each `require(...)` statement.
    *   If a specific `require` seems to cause the crash, add logs *inside* the required file (at the top and around its own internal requires or top-level code).
    *   Deploy and repeat manual execution or check systemd logs (if logging works early enough) to pinpoint the exact line causing the failure.

**Common Causes & Solutions**:
*   **Missing Production Dependency**: A module required by the application (e.g., `googleapis`) might be missing from `node_modules` on the server because it wasn't listed in `dependencies` (only `devDependencies`) in `package.json`. 
    *   **Solution**: Install the missing package and save it to production dependencies: `npm install <package_name> --save`. Ensure `npm install --production` was run successfully during deployment.
*   **Incorrect File Paths**: Paths to essential files (like `.env`, `firebase-credentials.json`) might be incorrect relative to the execution context (`__dirname`) or `WorkingDirectory` when run as a service.
    *   **Solution**: Use `path.resolve(__dirname, '../relative/path/to/file')` or absolute paths. Verify file locations and permissions on the server.
*   **Environment Variable Loading Order/Failure**: Environment variables might not be available when a module requiring them is loaded.
    *   **Solution**: Ensure environment variables are loaded *before* any other modules. If using `systemd EnvironmentFile` seems problematic, explicitly use `require('dotenv').config({ path: '...' })` at the *very top* of the entry point script (`index.js`), providing the correct absolute path to the `.env` file.
*   **Error During Module Initialization**: Code that runs immediately when a module is required (e.g., `new google.auth.OAuth2(...)`) might fail due to missing environment variables or other runtime issues.
    *   **Solution**: Identify the failing module using granular logging. Check required environment variables and dependencies for that module. Wrap problematic initialization code in `try...catch` blocks for better error reporting during startup.
*   **Syntax Errors**: Simple typos or syntax errors introduced during edits.
    *   **Solution**: Review recent code changes carefully. Use a linter locally.

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

### Production vs Development

**Issue**: "Works locally but fails in production"  
**Solution**: 
- Compare environment variables between environments
- Check for hardcoded values that might be environment-specific
- Verify that all dependencies are correctly installed in production

### Browser Compatibility

**Issue**: "Application doesn't work in specific browsers"  
**Solution**: 
- Check browser console for specific errors
- Ensure polyfills are included for older browsers
- Test with different browser versions

## Getting Further Help

If you're still experiencing issues after trying the solutions above:

1. Check the logs for more detailed error information
2. Search for the specific error message in our GitHub repository issues
3. Contact support at support@chatmimic.ai with:
   - A detailed description of the issue
   - Steps to reproduce
   - Error messages or screenshots
   - Your environment details (browser, OS, etc.) 

## Server Startup Failures (Systemd Restart Loops)

*   **Symptom:** Server fails to start, `systemd` status shows constant restarting.
*   **Debugging Steps:**
    1.  Check systemd logs: `sudo journalctl -u chatmimic-server.service -f`.
    2.  If logs unclear, try manual execution: `sudo -u <service_user> -s /bin/bash` then `export $(cat /path/to/.env | xargs)` then `node index.js` (within the project dir).
    3.  Add granular `console.log` statements around `require` calls and initialization code in `index.js` and related modules (`utils/logger.js`, service initializations) to pinpoint the crashing line.
    4.  Check file paths (use `path.resolve` or `path.join(__dirname, ...)`).
    5.  Ensure `dotenv` is loaded *first* in `index.js`.
    6.  Check for missing dependencies (`npm install`).
*   **Common Causes:** Missing dependencies, incorrect file paths (esp. for credentials), environment variable loading order, errors in module initialization logic.

## Google API Token Errors (401/403)

*   **Symptom:** Requests to Google APIs (Sheets, etc.) fail with 401 or 403 errors.
*   **Debugging Steps:**
    1.  Verify OAuth credentials (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) are correct in `.env`.
    2.  Check if user has granted necessary permissions during OAuth flow.
    3.  Examine `googleService.js` (`getValidCredentials`) logic for potential issues in token storage, retrieval, or refresh.
    4.  Check server logs for errors during the token refresh attempt.
*   **Common Causes:** Expired/invalid refresh token, incorrect scopes requested, revoked user consent, clock skew between server and Google.

## SSL Certificate Validation Errors

*   **Symptom:** Direct API calls (e.g., via `curl` without `-k`) fail with SSL errors, but browser access works.
*   **Debugging Steps:**
    1.  Verify Nginx configuration includes correct paths to Let's Encrypt fullchain and private key.
    2.  Ensure certificate files have correct permissions.
    3.  Check certificate validity and chain: `openssl s_client -connect your.domain.com:443`.
    4.  Confirm firewall allows port 443.
*   **Common Causes:** Misconfigured Nginx `ssl_certificate` / `ssl_certificate_key` directives, expired certificate, incomplete certificate chain.

## Embeddings API Errors (500 Internal Server Error / 404 Not Found)

*   **Symptom:** Requests to `/api/proxy/embeddings` from the frontend fail with a 500 error. Server logs show the underlying error is often a 404 when trying to reach the external OpenAI API.
*   **Debugging Steps:**
    1.  **Check Server Logs:** `sudo journalctl -u chatmimic-server.service -f`. Look for errors originating from `aiService.js` or `proxyService.js` when the `/api/proxy/embeddings` endpoint is hit.
    2.  **Verify API Key:** Ensure `OPENAI_API_KEY` in the server environment is correct, valid, and has billing enabled/sufficient credits on OpenAI.
    3.  **Check External URL:** Examine the error details in the logs. A common past issue was a duplicated base URL being sent to OpenAI (e.g., `https://api.openai.com/v1/https://api.openai.com/v1/embeddings`), causing an immediate 404 from OpenAI's side. This indicated an error in URL construction or request processing.
    4.  **Isolate the Failure Point:** Add temporary `logger.debug` statements strategically:
        *   In `aiService.js` before calling `makeRequest` to log the options being passed.
        *   In `proxyService.js` at the start of `makeRequest` and immediately before/after the `await apiClient(...)` call.
        *   Wrap the `await makeRequest(...)` call in `aiService.js` in its own `try...catch` block to inspect the error object precisely where it's thrown.
    5.  **Check Response Parsing:** Ensure the code correctly parses the response structure returned by the external API *after* it comes back through `proxyService.makeRequest`. The `makeRequest` function returns the `data` portion of the Axios response, so access should be adjusted accordingly (e.g., `response.data[0].embedding` for OpenAI embeddings).
    6.  **(Related Check)** Ensure Express `trust proxy` setting is configured correctly in `server/index.js` (`app.set('trust proxy', 1);` and `trustProxy: true` in rate limiters) if behind a reverse proxy like Nginx, to avoid unrelated middleware issues.
*   **Common Causes:**
    *   Invalid/missing OpenAI API key.
    *   Incorrect parsing of the response structure from the external API within `aiService.js` (e.g., accessing `response[0].embedding` instead of `response.data[0].embedding` after the call to `makeRequest`).
    *   Network connectivity issues between the server and the external API.
    *   (Previously observed) Errors in request processing logic leading to malformed URLs being sent externally.

*   **Fix (Specific Instance):** The issue was resolved by correcting the response handling logic in `server/services/aiService.js` to properly access the nested embedding data returned by `makeRequest` (using `response.data[0].embedding`).

## CORS Errors

*   **Symptom:** Frontend fails to make API requests, browser console shows CORS errors.
*   **Debugging Steps:**
    1.  Verify `CORS_ORIGIN` environment variable on the server matches the frontend URL exactly (including protocol and port if necessary).
    2.  Check the `cors` middleware configuration in `server/index.js` to ensure allowed methods and headers are sufficient.
    3.  Inspect network requests in the browser developer tools to see the `OPTIONS` preflight request and its response headers.
*   **Common Causes:** Mismatched origin URL, missing allowed headers (like `Authorization`), incorrect `credentials: true` setting if cookies/auth headers are needed. 