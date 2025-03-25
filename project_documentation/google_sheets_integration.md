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
- **Duplicate rows**: The system checks for existing contacts before adding new rows
- **Missing data**: If the AI fails to extract certain information, try updating the column's AI prompt

## Environment Variables

The following environment variables are required:
- `VITE_GOOGLE_CLIENT_ID`: Your Google OAuth client ID
- `VITE_GOOGLE_CLIENT_SECRET`: Your Google OAuth client secret

The Groq API key is now directly configured in the code as a constant:
```javascript
const GROQ_API_KEY = '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';
```

This ensures the AI data extraction will work properly with the deepseek-r1-distill-llama-70b model without requiring environment variable setup.

These should be set in a `.env` file at the project root. 