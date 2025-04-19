# Google Sheets Integration

This document provides both the functional overview and technical implementation details of the Google Sheets integration in ChatMimic Connect.

## Functional Description

### Purpose

Automate the extraction of specific information from incoming user WhatsApp messages and save it directly into designated Google Sheets columns, enabling seamless data collection and analysis.

### Connecting Your Google Account

* Uses Google OAuth for secure, user-granted permission for the application to access and modify Google Sheets on your behalf.
* The connection process is initiated from the frontend UI.
* The backend securely stores the necessary OAuth tokens (access/refresh, with encryption) in Firebase Firestore (`users/{uid}/credentials/googleSheetsOAuth`). This allows the backend automation service to interact with the Google Sheets API without requiring you to be logged in.

### Configuration - Defining What to Extract

* Configure the integration via the ChatMimic Connect dashboard.
* This configuration tells the backend automation service *which* sheet to use and *what* data to extract.
* Configuration is stored in Firebase Firestore (`users/{uid}/workflows/whatsapp_agent/sheetConfigs`).
* For each desired Sheet integration, you create a configuration object including:
  * `name`: A label for this configuration (e.g., "Lead Capture Sheet").
  * `sheetId`: The unique ID of the target Google Sheet.
  * `active`: A toggle to enable or disable this specific automation.
  * **`columns`:** An array defining each piece of data (field) to extract and its corresponding sheet column. Each column object specifies:
    * `id`: Internal identifier.
    * `name`: The header name of the column in your Google Sheet.
    * `description`: Explanation of the field.
    * `type`: Data type hint for the AI (e.g., "name", "phone", "inquiry").
    * `aiPrompt`: Specific instructions for the AI on how to extract this field from the message (e.g., "Extract the customer's primary question").

### The Automated Extraction & Saving Process

* **Trigger:** When a new message from a *user* arrives via WhatsApp, it's saved to Firestore.
* **Backend Listener:** A persistent service (`messageProcessorService.js`) running on the ChatMimic Connect server continuously monitors Firestore for these new, unprocessed user messages.
* **Automatic Processing:** When the listener detects a relevant message:
  1. It retrieves the corresponding user's active Google Sheets configuration(s) from Firestore.
  2. It calls the backend AI service (`aiService.js`), providing the message content and the configured `columns` (including `aiPrompt` instructions).
  3. The AI extracts the requested information based on the prompts.
  4. The backend service (`googleService.js`) securely uses the stored Google credentials to:
     * Check if the contact (based on phone number) already exists in the target sheet.
     * Either **append** a new row with the extracted data or **update** the existing row.
  5. The original message in Firestore is marked as processed.
* **Key Benefit:** This entire process runs **automatically on the backend server**, even if you don't have the ChatMimic Connect dashboard open. As long as the server is running and the configuration is active, messages will be processed and saved to your Google Sheet.

### Manual Testing

* A "Test Integration" button is available in the configuration UI.
* This button creates a special test message in Firestore and simulates the processing flow by calling the backend APIs directly (AI extraction, sheet interaction). This allows you to verify your configuration without waiting for a real customer message.

## Technical Implementation

### Core Principle

Separate concerns clearly. Frontend handles user interaction (OAuth initiation, config UI). Backend handles persistent listening, secure credential management, business logic, and interactions with external APIs (Google, Groq).

### Frontend Implementation (React/Vite - e.g., `GoogleSheetsConfig.tsx`)

* **Responsibilities:**
  * Displaying connection status (via `/api/google-sheets/status`).
  * Initiating Google OAuth flow (via `/api/google-sheets/auth-url`).
  * Handling UI for Google Sheets configuration (listing sheets via `/api/google-sheets/list`, displaying/editing `sheetId`, columns, active status).
  * Saving configuration changes (via `/api/config` or `/api/google-sheets/config`).
  * Disconnecting Google Account (via `/api/google-sheets/disconnect`).
  * Providing a "Test Integration" button which:
    * Creates a test message document in Firestore (`isTestMessage: true`).
    * Calls `processWhatsAppMessage` (`whatsappGoogleIntegration.ts`) which simulates the flow using backend API calls (`/api/ai/extract-data`, `/api/google-sheets/...`).
* **Does NOT:**
  * Start or manage any persistent listeners.
  * Contain logic for automatic message processing or sheet updates.

### Backend Implementation (Node/Express)

#### Routes for Frontend Support (`googleSheetsRoutes.js`, `googleOAuthRoutes.js`, `configRoutes.js`)

* Provide authenticated endpoints for the frontend UI actions listed above (status check, auth URL generation, OAuth callback handling, listing sheets, saving config, disconnecting).
* These routes operate within the context of the authenticated user making the request (`req.user.uid`).

#### Google Service (`services/googleService.js`)

* **Core Functions:**
  * `getCredentialsForUser(uid)`: Fetches encrypted tokens from Firestore and decrypts them.
  * `getValidCredentials(uid)`: Gets credentials and handles refresh token logic if access token is expired, updating Firestore.
  * `updateCredentialsInDb(uid, ...)`: Updates stored tokens (used during refresh).
  * `exchangeCodeForTokens(code, ...)`: Handles OAuth callback code exchange.
  * `createOAuth2ClientWithCredentials(credentials)`: Creates an OAuth client instance.
  * `getAuthenticatedSheetsClient(uid)`: Gets valid credentials and returns an authenticated `google.sheets` client instance (**Used by sheet manipulation functions**).
* **Sheet Manipulation Functions:**
  * `findContactRow(uid, config, phoneNumber)`: Finds row index based on phone number in the configured column.
  * `appendSheetRow(uid, config, rowDataMap)`: Appends a new row with data mapped according to `config.columns`.
  * `updateSheetRow(uid, config, rowIndex, rowDataMap)`: Updates an existing row.
  * **Crucially**, these manipulation functions all accept `uid` and the specific sheet `config`, and internally use `getAuthenticatedSheetsClient(uid)` to perform actions on behalf of the user *without* needing an HTTP request context.

#### AI Service (`services/aiService.js`)

* `extractDataFromMessage(messageText, columnsConfig)`:
  * Accepts message text and the `columns` array from the user's sheet configuration.
  * Constructs a prompt for Groq based on the `columnsConfig` (using `aiPrompt` from each column).
  * Calls Groq API, parses the response, and returns structured data (mapping column `id` to extracted value).
  * Operates independently of request context.

#### Message Processor Service (`services/messageProcessorService.js`)

* **Initialization:** The `startListening()` function is called once from `server/index.js` after Firebase Admin is initialized.
* **Listener:**
  * Uses `admin.firestore().collectionGroup('messages').where('isProcessedByAutomation', '==', false).orderBy('createdAt', 'asc').onSnapshot(...)`.
  * Listens across all users for new messages that haven't been processed by automation.
* **Snapshot Handling (`handleMessagesSnapshot`):**
  * Iterates through added documents (`change.type === 'added'`).
  * Calls `processSingleMessage(change.doc)` sequentially for each new message.
* **Core Processing (`processSingleMessage(messageDoc)`):**
  * Extracts `uid` and `contactPhoneNumber` from `messageDoc.ref.path`.
  * **Skips** if `messageData.isTestMessage === true` or `messageData.sender !== 'user'`.
  * Fetches `userDoc` from Firestore using `uid`.
  * Retrieves `sheetConfigs = userDoc.data()?.workflows?.whatsapp_agent?.sheetConfigs || []`.
  * Filters for `activeConfigs` that have a `sheetId` and `columns`.
  * Checks for Google credentials (`refreshToken`) in `userDoc.data()?.credentials?.googleSheetsOAuth`.
  * If no active configs or no refresh token, calls `markMessageProcessed` with `skipped` status and returns.
  * **Loops through `activeConfigs`:**
    * **AI Call:** `extractedData = await aiService.extractDataFromMessage(messageData.message, config.columns)`.
    * **Prepare Row:** Creates `rowDataMap` by mapping `config.columns.name` to `extractedData[column.id]`, adding fallbacks for phone/timestamp.
    * **Find Row:** `rowIndex = await googleService.findContactRow(uid, config, contactPhoneNumber)`.
    * **Write to Sheet:** Calls either `googleService.updateSheetRow(uid, config, rowIndex, rowDataMap)` or `googleService.appendSheetRow(uid, config, rowDataMap)`.
    * Handles errors per-config.
  * **Mark Processed:** Calls `markMessageProcessed(messageRef, uid, statusData)` with overall success or error status, including details.
  * Handles critical errors gracefully within a `try...catch`.
* **Marking Processed (`markMessageProcessed(messageRef, uid, statusData)`):**
  * Updates the original message document in Firestore setting `isProcessedByAutomation: true`, `automationStatus: statusData`, and `processedAt` timestamp.

### Error Handling & Security

* **Backend Focus:** Robust logging (Winston) in all backend services (`messageProcessorService`, `googleService`, `aiService`) is crucial for diagnosing issues in the automated flow.
* **Credential Security:** Google refresh tokens are encrypted at rest in Firestore using `TOKEN_ENCRYPTION_KEY` from `server/.env`.
* **API Security:** Frontend-facing API endpoints are protected by Firebase Auth middleware. Backend services operate using secure credentials or service accounts.
* **Google API Errors:** `googleService` sheet manipulation functions include basic error handling for common Google API errors (403 Permissions, 404 Not Found) and re-throw more user-friendly errors.
* **Listener Errors:** `messageProcessorService` includes `handleListenerError` to log critical listener failures and stop the listener (potential for adding retry logic or monitoring). `processSingleMessage` catches errors to prevent one message failure from crashing the entire listener.
* **Idempotency:** The `isProcessedByAutomation` flag prevents reprocessing messages. The `findContactRow` logic helps decide between appending and updating.

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

## Authentication Resilience

The Google OAuth flow now includes mechanisms to maintain session state:

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
- **Data extraction issues**: Review the column configuration to ensure proper data mapping
- **Duplicate rows**: The system checks for existing contacts before adding new rows
- **Missing data**: If the AI fails to extract certain information, try updating the column's AI prompt
- **Firebase authentication issues**: The callback page now includes a retry mechanism and manual retry button

## Environment Variables

The following environment variables are required:

### Frontend (.env file)
- `VITE_GOOGLE_CLIENT_ID`: Your Google OAuth client ID

### Backend (.env file)
- `GOOGLE_CLIENT_ID`: Your Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Your Google OAuth client secret
- `TOKEN_ENCRYPTION_KEY`: A 32-byte random hex string for token encryption

### AI Service
The AI service now uses the Groq API key which should be set as an environment variable:
- `VITE_GROQ_API_KEY`: Your Groq API key 