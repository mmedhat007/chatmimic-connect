# Google Sheets Integration

This document outlines how the Google Sheets integration works within ChatMimic Connect, specifically for WhatsApp message data collection.

## Overview

The Google Sheets integration allows users to:
- Connect their Google account to ChatMimic Connect
- Define custom column mappings to collect specific data from WhatsApp messages
- Automatically populate Google Sheets with data extracted from incoming WhatsApp messages
- Customize which data points are extracted using AI-based data extraction

## Authentication Flow

1. User clicks "Connect Google Sheets" in the Google Sheets configuration panel
2. User is redirected to Google's OAuth consent screen
3. After authorization, Google redirects back to `/google-callback`
4. The application exchanges the authorization code for access and refresh tokens
5. Tokens are stored in the user's Firestore document under `credentials.googleSheetsOAuth`

## Data Structure

Google Sheets credentials are stored in Firebase under:
```
users/{userId}/credentials/googleSheetsOAuth
```

The structure includes:
- `accessToken`: The OAuth access token
- `refreshToken`: Used to refresh the access token when it expires
- `expiresAt`: Timestamp when the current access token expires

## Sheet Configuration

Users can configure:
1. Which spreadsheet to use
2. Which sheet tab to populate
3. Custom column mappings defining what data to extract from WhatsApp messages

Configuration is stored in Firebase under:
```
users/{userId}/googleSheetsConfig
```

## Data Flow

1. When a new WhatsApp message arrives, the system checks if Google Sheets integration is enabled
2. If enabled, the system extracts data from the message based on configured column mappings
3. For custom fields, AI processing extracts the requested information
4. The extracted data is appended as a new row to the configured Google Sheet
5. A reference to the processed message is stored to prevent duplicate processing

## AI Data Extraction

The system uses the Groq API with the DeepSeek r1 model to:
1. Analyze the content of WhatsApp messages
2. Extract specific data points based on column definitions
3. Format the data appropriately for Google Sheets

## Components

The integration consists of several key components:

- `GoogleSheetsConfig.tsx`: UI for configuring Google Sheets settings
- `GoogleSheetsButton.tsx`: Button for connecting/disconnecting Google Sheets
- `GoogleCallback.tsx`: Handles OAuth callback from Google
- `googleSheets.ts`: Service for Google Sheets API operations
- `ai.ts`: Service for AI-based data extraction
- `whatsappGoogleIntegration.ts`: Service for processing WhatsApp messages and updating Google Sheets

## Troubleshooting

Common issues:
- **Authentication errors**: Check that the Google client ID is properly set in environment variables
- **Token expiration**: The system automatically refreshes tokens that expire
- **Data extraction issues**: Review the column configuration to ensure proper data mapping

## Environment Variables

The following environment variables are required:
- `VITE_GOOGLE_CLIENT_ID`: Your Google OAuth client ID
- `VITE_GOOGLE_CLIENT_SECRET`: Your Google OAuth client secret
- `VITE_GROQ_API_KEY`: API key for Groq (for AI data extraction)

These should be set in a `.env` file at the project root. 