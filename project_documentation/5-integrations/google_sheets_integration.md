# Google Sheets Integration

This document outlines how the Google Sheets integration works within ChatMimic Connect, specifically for WhatsApp message data collection.

## Overview

The Google Sheets integration allows users to:
- Connect their Google account to ChatMimic Connect
- Define custom column mappings to collect specific data from WhatsApp messages
- Automatically populate Google Sheets with data extracted from incoming WhatsApp messages
- Customize which data points are extracted using AI-based data extraction
- Control when contacts are added to sheets (first message, showing interest, or manually)
- Automatically update contact information as new details are discovered

## Authentication Flow

1. User clicks "Connect Google Sheets" in the Google Sheets configuration panel
2. The application creates a state parameter containing the user's Firebase UID to maintain authentication context
3. User is redirected to Google's OAuth consent screen with this state parameter
4. After authorization, Google redirects back to `/google-callback` with the authorization code and state parameter
5. The callback component:
   - Extracts the state parameter to restore the user's authentication context
   - Implements a retry mechanism to ensure Firebase auth is properly initialized
   - Exchanges the authorization code for access and refresh tokens via secure backend endpoint
   - Handles any authentication errors with appropriate UI feedback
6. Tokens are securely stored on the server using encryption

### Development Environment Authentication

The development environment (`NODE_ENV=development`) uses the same exact authentication flow as production:

1. Real Firebase authentication is required
2. Real Google OAuth credentials must be configured in the environment
3. The frontend communicates with the backend using real Firebase ID tokens
4. CORS is properly configured to handle cross-origin requests between port 8080 (frontend) and 3000 (backend)
5. No mock tokens or fake authentication is used - all credentials must be real and valid

#### Setting Up Development Environment

To properly set up your development environment:

1. Create a Firebase project and download service account credentials
2. Set up Google OAuth 2.0 Client ID and Client Secret in Google Cloud Console
3. Configure your `.env` file with:
   ```
   GOOGLE_CLIENT_ID=<your-google-client-id>
   GOOGLE_CLIENT_SECRET=<your-google-client-secret>
   TOKEN_ENCRYPTION_KEY=<32-byte-random-hex>
   GOOGLE_APPLICATION_CREDENTIALS=<path-to-firebase-credentials>
   FIREBASE_DATABASE_URL=<your-firebase-database-url>
   ```
4. Run the `start-dev.sh` script which will verify all required credentials are present

## Authentication Resilience

The Google OAuth flow includes mechanisms to maintain session state:

- A state parameter containing the encrypted user ID is passed to Google and returned to the callback URL
- The callback component implements a retry mechanism that waits for Firebase auth to initialize
- If authentication errors occur, users can manually retry the process
- All sensitive token exchanges happen on the secure backend

## Data Structure

Google Sheets credentials are stored securely in Firebase under:
```
users/{userId}/credentials/googleSheetsOAuth
```

The structure includes:
- `accessToken`: The encrypted OAuth access token
- `refreshToken`: Encrypted refresh token used to obtain new access tokens
- `expiresAt`: Timestamp when the current access token expires
- `updatedAt`: Timestamp when the credentials were last updated

## Sheet Configuration

Users can configure:
1. Which spreadsheet to use
2. Which sheet tab to populate
3. Custom column mappings defining what data to extract from WhatsApp messages
4. When to add contacts to the sheet:
   - On first message (default)
   - When customer shows interest
   - Manual only (via test or API)
5. Whether to automatically update fields when new information is detected

Configuration is stored in Firebase under:
```
users/{userId}/workflows/whatsapp_agent/sheetConfigs
```

## Data Flow

### Adding Contacts to Sheets

The system monitors all incoming WhatsApp messages. Based on the selected trigger:

1. **First Message Trigger**: When a new conversation starts with a customer, their information is immediately added to the sheet.

2. **Show Interest Trigger**: Messages are analyzed by AI to detect if they show interest in products or services. When interest is detected, the contact is added to the sheet.

3. **Manual Trigger**: Contacts are only added when manually triggered through the testing function or API calls.

### Updating Contact Information

If auto-update is enabled (default setting), the system will:

1. Extract information from all incoming messages
2. Check if the contact already exists in the sheet
3. Update any new or improved information found (e.g., customer name, product interest)
4. Also update the contact information in the WhatsApp contact record

### Column Types and Behaviors

The system handles different column types distinctly:

- **Name** columns: Filled with contact name or extracted from message. Updated when better information is found.
- **Phone** columns: Automatically populated with the contact's phone number.
- **Inquiry** columns: Filled with the message content that triggered the sheet entry.
- **Product** columns: Analyzed to extract products or services mentioned. Also updates contact tags.
- **Date** columns: Extracts and formats dates mentioned in messages.
- **Custom** columns: Extracted based on AI prompts defined in the configuration.

## AI Data Extraction

The system uses the Groq API with the `deepseek-r1-distill-llama-70b` model to:
1. Analyze the content of WhatsApp messages
2. Extract specific data points based on column definitions
3. Format the data appropriately for Google Sheets
4. Detect customer interest in products/services

The AI uses default extraction rules for standard column types but can be customized with specific prompts for more precise data extraction.

## Security Enhancements

Recent security enhancements:
1. OAuth token exchange now happens on the secure backend server
2. Tokens are encrypted before storage using AES-256-GCM encryption
3. Authentication state is preserved during OAuth flow with secure state parameter
4. Token refresh happens server-side to protect client secret
5. Authorization process includes multiple safety checks and retry mechanisms

## Components

The integration consists of several key components:

- `GoogleSheetsConfig.tsx`: UI for configuring Google Sheets settings
- `GoogleSheetsButton.tsx`: Button for connecting/disconnecting Google Sheets
- `GoogleCallback.tsx`: Handles OAuth callback from Google with robust authentication mechanisms
- `googleSheets.ts`: Service for Google Sheets API operations and OAuth authorization
- `googleOAuth.js`: Server-side OAuth token exchange and management
- `ai.ts`: Service for AI-based data extraction
- `whatsappGoogleIntegration.ts`: Service for processing WhatsApp messages and updating Google Sheets

## Production Readiness

For production deployment, the system:
1. Removes console statements using `vite-plugin-remove-console` for frontend code
2. Implements a custom logger utility for backend that suppresses non-error output
3. Includes ESLint rules to prevent adding new console statements
4. Properly handles authentication errors with user-friendly messages

## Troubleshooting

Common issues:
- **Authentication errors**: Check that the Google client ID and secret are properly set in environment variables
- **Token expiration**: The system automatically refreshes tokens that expire
- **Cross-origin (CORS) issues**: For development, make sure the server's CORS configuration allows requests from `http://localhost:8080`
- **Internal Server Error (500) during token exchange**: Verify all required environment variables are set in both frontend and backend
- **Missing Google credentials in backend**: Ensure your `.env` file includes both VITE_ variables for frontend and regular variables for backend
- **Data extraction issues**: Review the column configuration to ensure proper data mapping
- **Duplicate rows**: The system checks for existing contacts before adding new rows
- **Missing data**: If the AI fails to extract certain information, try updating the column's AI prompt
- **Firebase authentication issues**: The callback page now includes a retry mechanism and manual retry button
- **White screen on Google Sheets page refresh**: This is usually due to missing authentication state. Always navigate through the app rather than directly entering the URL

### Development Environment Issues

When running in development mode (`NODE_ENV=development`):
- If you receive CORS errors, check that the backend server's CORS configuration includes all necessary origins (typically `http://localhost:8080`)
- For token exchange errors, verify the frontend code is using the full backend URL (`http://localhost:3000/api/google-oauth/exchange-token`)
- Special OPTIONS route handlers are configured for Google OAuth endpoints to facilitate correct preflight requests
- The server requires proper Firebase initialization with valid credentials
- Use the provided `start-dev.sh` script in the project root to ensure all required environment variables are properly set
- Ensure your Firebase service account credentials file path is correctly set in `GOOGLE_APPLICATION_CREDENTIALS`

### Page Reloads and Route Handling

When developing a single-page application, refreshing routes like `/google-sheets` can cause issues:

1. The updated application includes route restoration that:
   - Detects direct requests to client routes when using the backend server directly
   - Redirects to the frontend with the path stored in localStorage
   - Automatically restores the correct route when the app loads
   
2. To avoid page reload issues:
   - Always use the `start-dev.sh` script which includes the route handling updates
   - The frontend includes a `RouteRestorer` component that checks for saved routes on load
   - In production, the server properly handles all routes by serving the SPA index.html

### Quick Fix for Common Problems

If you encounter Google OAuth issues:
1. Run `./start-dev.sh` from the project root to start both servers with proper environment settings
2. The script ensures both frontend and backend use consistent ports (8080 for frontend, 3000 for backend)
3. It loads environment variables from your `.env` file and verifies required credentials
4. It handles port conflicts by stopping any existing processes on the required ports
5. It properly handles paths with spaces (e.g., "DenoteAI Projects" instead of "DenoteAI_Projects")

### Path Issues in Development

If your project is in a directory path with spaces (e.g., `/Users/username/My Projects/chatmimic-connect`):
1. Always use the provided scripts (`start-dev.sh`) which handle spaces in paths correctly
2. When running npm commands manually, make sure to `cd` to the exact directory first
3. The updated scripts use absolute paths with proper quoting to avoid path-related issues
4. If you need to specify paths manually in commands, always enclose them in quotes

## Environment Variables

The following environment variables are required:

### Frontend (.env file)
- `VITE_GOOGLE_CLIENT_ID`: Your Google OAuth client ID

### Backend (.env file)
- `GOOGLE_CLIENT_ID`: Your Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Your Google OAuth client secret
- `TOKEN_ENCRYPTION_KEY`: A 32-byte random hex string for token encryption
- `GOOGLE_APPLICATION_CREDENTIALS`: Path to Firebase service account credentials file
- `FIREBASE_DATABASE_URL`: Your Firebase database URL

### AI Service
The AI service now uses the Groq API key which should be set as an environment variable:
- `VITE_GROQ_API_KEY`: Your Groq API key 