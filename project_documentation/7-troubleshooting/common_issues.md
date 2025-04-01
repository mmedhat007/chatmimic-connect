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