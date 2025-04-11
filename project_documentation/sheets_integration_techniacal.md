# Google Sheets Integration - Technical Details (Updated for Backend Automation)

This document outlines the technical implementation of the Google Sheets integration, focusing on the backend-driven automation process.

**Core Principle:** Separate concerns clearly. Frontend handles user interaction (OAuth initiation, config UI). Backend handles persistent listening, secure credential management, business logic, and interactions with external APIs (Google, Groq).

**I. Frontend Implementation (React/Vite - e.g., `GoogleSheetsConfig.tsx`)**

*   **Responsibilities:**
    *   Displaying connection status (via `/api/google-sheets/status`).
    *   Initiating Google OAuth flow (via `/api/google-sheets/auth-url`).
    *   Handling UI for Google Sheets configuration (listing sheets via `/api/google-sheets/list`, displaying/editing `sheetId`, columns, active status).
    *   Saving configuration changes (via `/api/config` or `/api/google-sheets/config`).
    *   Disconnecting Google Account (via `/api/google-sheets/disconnect`).
    *   Providing a "Test Integration" button which:
        *   Creates a test message document in Firestore (`isTestMessage: true`).
        *   Calls `processWhatsAppMessage` (`whatsappGoogleIntegration.ts`) which simulates the flow using backend API calls (`/api/ai/extract-data`, `/api/google-sheets/...`).
*   **Does NOT:**
    *   Start or manage any persistent listeners.
    *   Contain logic for automatic message processing or sheet updates.

**II. Backend Implementation (Node/Express)**

1.  **Routes for Frontend Support (`googleSheetsRoutes.js`, `googleOAuthRoutes.js`, `configRoutes.js`):**
    *   Provide authenticated endpoints for the frontend UI actions listed above (status check, auth URL generation, OAuth callback handling, listing sheets, saving config, disconnecting).
    *   These routes operate within the context of the authenticated user making the request (`req.user.uid`).

2.  **Google Service (`services/googleService.js`):**
    *   **Core Functions:**
        *   `getCredentialsForUser(uid)`: Fetches encrypted tokens from Firestore and decrypts them.
        *   `getValidCredentials(uid)`: Gets credentials and handles refresh token logic if access token is expired, updating Firestore.
        *   `updateCredentialsInDb(uid, ...)`: Updates stored tokens (used during refresh).
        *   `exchangeCodeForTokens(code, ...)`: Handles OAuth callback code exchange.
        *   `createOAuth2ClientWithCredentials(credentials)`: Creates an OAuth client instance.
        *   `getAuthenticatedSheetsClient(uid)`: Gets valid credentials and returns an authenticated `google.sheets` client instance (**Used by sheet manipulation functions**).
    *   **Sheet Manipulation Functions (NEW/MODIFIED):**
        *   `findContactRow(uid, config, phoneNumber)`: Finds row index based on phone number in the configured column.
        *   `appendSheetRow(uid, config, rowDataMap)`: Appends a new row with data mapped according to `config.columns`.
        *   `updateSheetRow(uid, config, rowIndex, rowDataMap)`: Updates an existing row.
        *   **Crucially**, these manipulation functions all accept `uid` and the specific sheet `config`, and internally use `getAuthenticatedSheetsClient(uid)` to perform actions on behalf of the user *without* needing an HTTP request context.

3.  **AI Service (`services/aiService.js`):**
    *   `extractDataFromMessage(messageText, columnsConfig)`:
        *   Accepts message text and the `columns` array from the user's sheet configuration.
        *   Constructs a prompt for Groq based on the `columnsConfig` (using `aiPrompt` from each column).
        *   Calls Groq API, parses the response, and returns structured data (mapping column `id` to extracted value).
        *   Operates independently of request context.

4.  **Message Processor Service (`services/messageProcessorService.js`): (NEW - Core Automation Engine)**
    *   **Initialization:** The `startListening()` function is called once from `server/index.js` after Firebase Admin is initialized.
    *   **Listener:**
        *   Uses `admin.firestore().collectionGroup('messages').where('isProcessedByAutomation', '==', false).orderBy('createdAt', 'asc').onSnapshot(...)`.
        *   Listens across all users for new messages that haven't been processed by automation.
    *   **Snapshot Handling (`handleMessagesSnapshot`):**
        *   Iterates through added documents (`change.type === 'added'`).
        *   Calls `processSingleMessage(change.doc)` sequentially for each new message.
    *   **Core Processing (`processSingleMessage(messageDoc)`):**
        *   Extracts `uid` and `contactPhoneNumber` from `messageDoc.ref.path`.
        *   **Skips** if `messageData.isTestMessage === true` or `messageData.sender !== 'user'`.
        *   Fetches `userDoc` from Firestore using `uid`.
        *   Retrieves `sheetConfigs = userDoc.data()?.workflows?.whatsapp_agent?.sheetConfigs || []`.
        *   Filters for `activeConfigs` that have a `sheetId` and `columns`.
        *   Checks for Google credentials (`refreshToken`) in `userDoc.data()?.credentials?.googleSheetsOAuth`.
        *   If no active configs or no refresh token, calls `markMessageProcessed` with `skipped` status and returns.
        *   **Loops through `activeConfigs`:**
            *   **AI Call:** `extractedData = await aiService.extractDataFromMessage(messageData.message, config.columns)`.
            *   **Prepare Row:** Creates `rowDataMap` by mapping `config.columns.name` to `extractedData[column.id]`, adding fallbacks for phone/timestamp.
            *   **Find Row:** `rowIndex = await googleService.findContactRow(uid, config, contactPhoneNumber)`.
            *   **Write to Sheet:** Calls either `googleService.updateSheetRow(uid, config, rowIndex, rowDataMap)` or `googleService.appendSheetRow(uid, config, rowDataMap)`.
            *   Handles errors per-config.
        *   **Mark Processed:** Calls `markMessageProcessed(messageRef, uid, statusData)` with overall success or error status, including details.
        *   Handles critical errors gracefully within a `try...catch`.
    *   **Marking Processed (`markMessageProcessed(messageRef, uid, statusData)`):**
        *   Updates the original message document in Firestore setting `isProcessedByAutomation: true`, `automationStatus: statusData`, and `processedAt` timestamp.

**III. Error Handling & Security**

*   **Backend Focus:** Robust logging (Winston) in all backend services (`messageProcessorService`, `googleService`, `aiService`) is crucial for diagnosing issues in the automated flow.
*   **Credential Security:** Google refresh tokens are encrypted at rest in Firestore using `TOKEN_ENCRYPTION_KEY` from `server/.env`.
*   **API Security:** Frontend-facing API endpoints are protected by Firebase Auth middleware. Backend services operate using secure credentials or service accounts.
*   **Google API Errors:** `googleService` sheet manipulation functions include basic error handling for common Google API errors (403 Permissions, 404 Not Found) and re-throw more user-friendly errors.
*   **Listener Errors:** `messageProcessorService` includes `handleListenerError` to log critical listener failures and stop the listener (potential for adding retry logic or monitoring). `processSingleMessage` catches errors to prevent one message failure from crashing the entire listener.
*   **Idempotency:** The `isProcessedByAutomation` flag prevents reprocessing messages. The `findContactRow` logic helps decide between appending and updating.

This refactored backend-driven approach ensures reliable, unattended automation for the Google Sheets integration, separating concerns effectively and improving maintainability.
