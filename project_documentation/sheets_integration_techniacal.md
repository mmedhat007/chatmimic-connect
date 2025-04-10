
Okay, let's dive into a detailed technical opinion on how the Google Sheets integration *should* be implemented within your project's architecture (React/Vite frontend, Node/Express backend, Firebase Auth/Firestore, Supabase, Groq). This assumes we want a robust, scalable, and maintainable solution, addressing the kind of issues we've seen (like the `fields.map` error).

**Core Principle:** Separate concerns clearly. Frontend handles user interaction and config presentation. Backend handles auth, business logic, secure credential management, and interactions with external APIs (Google, Groq).

**I. Frontend Implementation (React/Vite - e.g., `GoogleSheetsPage.tsx`, `GoogleSheetsConfig.tsx`)**

1.  **Connection Status Check:**
    *   On page load (`GoogleSheetsPage`), make an authenticated `GET` request to a backend endpoint like `/api/google-sheets/status`.
    *   **Backend (`/api/google-sheets/status`):** Verifies the Firebase auth token (middleware). Checks Firestore (`users/{uid}/credentials/googleSheetsOAuth`) for the presence and validity (check expiry, though refresh token makes this less critical) of Google OAuth tokens. Returns `{ isConnected: true/false }`.
    *   **Frontend:** Updates UI state to show "Connected" or "Disconnected" status, potentially displaying the connected Google account email if available.

2.  **Initiating Connection (OAuth Flow):**
    *   If disconnected, a "Connect Google Account" button is shown.
    *   **Frontend (onClick):** Makes an authenticated `GET` request to `/api/google-sheets/auth-url`.
    *   **Backend (`/api/google-sheets/auth-url`):** Verifies Firebase auth. Uses the `googleapis` library and configured Google Client ID/Secret (`server/.env`) to generate the Google OAuth consent screen URL with required scopes (e.g., `https://www.googleapis.com/auth/spreadsheets`). Returns `{ authUrl: '...' }`.
    *   **Frontend:** Receives the `authUrl` and redirects the user's browser (`window.location.href = authUrl;`).

3.  **Handling Google Callback:**
    *   **Google Redirects:** After user consent, Google redirects back to the `GOOGLE_REDIRECT_URI` specified in your Google Cloud Console and `server/.env` (e.g., `http://localhost:3000/google-callback` or a production equivalent). This redirect includes an authorization `code` and the `state` parameter (if used).
    *   **Backend (`/google-callback` Route):**
        *   This specific route *doesn't* need initial Firebase auth, as the user isn't logged into *our app* at this exact redirect moment. It validates the `state` parameter for security (CSRF prevention).
        *   Exchanges the received `code` for `accessToken`, `refreshToken`, and `expiresAt` using the `googleapis` library and Google Client ID/Secret.
        *   **Crucially:** It needs to associate these tokens with the correct Firebase user. This is often done using the `state` parameter passed in step 2, which should contain an encoded, temporary identifier linking back to the user's session or UID. Alternatively, if the user is guaranteed to be logged in *before* clicking connect, their UID could be stored server-side temporarily.
        *   Securely stores the `accessToken`, `refreshToken`, and `expiresAt` in Firestore under `users/{uid}/credentials/googleSheetsOAuth`. Encrypting the refresh token before storage is a good practice, using the `TOKEN_ENCRYPTION_KEY` from `server/.env`.
        *   Redirects the user back to the frontend Google Sheets configuration page (e.g., `/google-sheets-settings`).

4.  **Configuration UI (`GoogleSheetsConfig.tsx`):**
    *   **Fetch Existing Config:** On load (and after successful connection), make an authenticated `GET` request to `/api/config` (or a more specific `/api/google-sheets/config`).
    *   **Backend (`/api/config` or `/api/google-sheets/config`):** Verify auth. Fetch the `sheetConfigs` array from `users/{uid}/workflows/whatsapp_agent/sheetConfigs` in Firestore. Return it.
    *   **Frontend:**
        *   Uses state (`useState` or similar) to manage the fetched/edited configuration (`sheetId`, `active`, `columns` array).
        *   Provides UI elements:
            *   Input/Selector for the target Google Sheet ID/Name (Potentially use Google Picker API for a better UX, but requires extra setup).
            *   A dynamic list/table to manage the `columns` array.
                *   Each row allows editing `id`, `name`, `description`, `type` (dropdown), `aiPrompt` (textarea).
                *   Buttons to Add/Remove columns.
        *   "Save Configuration" button.

5.  **Saving Configuration:**
    *   **Frontend (onClick):** Bundles the current configuration state (the `sheetConfigs` array, likely containing just one config object initially) into a JSON payload. Makes an authenticated `POST` or `PUT` request to `/api/config` (or `/api/google-sheets/config`) with the payload.
    *   **Backend (`/api/config` or `/api/google-sheets/config`):** Verify auth. Validate the incoming payload structure. Update the `sheetConfigs` field in the user's Firestore document (`users/{uid}/workflows/whatsapp_agent/`). Return success/failure status.

6.  **Disconnecting:**
    *   **Frontend (onClick):** Shows a confirmation modal. If confirmed, makes an authenticated `POST` request to `/api/google-sheets/disconnect`.
    *   **Backend (`/api/google-sheets/disconnect`):** Verify auth. Remove the `googleSheetsOAuth` credentials from the user's Firestore document (or revoke the token via Google API if necessary). Return success/failure.
    *   **Frontend:** Updates UI state back to "Disconnected".

**II. Backend Implementation (Node/Express)**

1.  **Routes (`googleSheetsRoutes.js`, `configRoutes.js`, `proxyRoutes.js`):** Define the endpoints mentioned above (`/status`, `/auth-url`, `/google-callback`, `/disconnect`, `/config`, `/proxy/extract-data`). Apply `authMiddleware` (using Firebase Admin SDK `verifyIdToken`) to all except `/google-callback`. Use body-parsing middleware (`express.json()`).

2.  **Google OAuth Service (`googleOAuth.js`):**
    *   Contains helper functions to interact with the `googleapis` library.
    *   `getGoogleAuthClient(userId)`: Fetches tokens for a user from Firestore, creates an authenticated OAuth2 client instance. Handles token refresh automatically using the stored refresh token if the access token is expired. This client is then used for API calls.
    *   Functions to generate auth URL, exchange code for tokens.

3.  **Firestore Service (e.g., `services/firestoreService.js`):**
    *   Abstracts Firestore interactions (getting/setting user credentials, getting/setting sheet configs).

4.  **AI Service (`services/aiService.js`):**
    *   `extractDataWithGroq(messageText, fieldsConfig)`:
        *   **Input:** Receives the raw message text and the *exact* `columns` array (which we're calling `fieldsConfig` here) as fetched from Firestore. **Crucially, this service should *not* be responsible for fetching the config itself.**
        *   **Logic:** Constructs the prompt for Groq. This likely involves combining the `messageText` with instructions based on the `fieldsConfig` array. It should iterate through the `fieldsConfig` array (`fieldsConfig.map(...)` or `forEach`) to build the part of the prompt telling Groq *what* to extract based on each field's `name`, `type`, and `aiPrompt`.
        *   Calls the Groq API using the `GROQ_API_KEY`.
        *   Parses the JSON response from Groq, attempting to structure it according to the requested fields.
        *   Returns the structured extracted data (e.g., `{ "name": "John", "email": "john@example.com", ... }`) or throws an error.

5.  **Core Extraction & Writing Workflow (Triggered by New Message):**
    *   **(Assumption):** Some service/function listens for or receives new WhatsApp messages associated with a user.
    *   **Step 1: Get Config:** Fetch the user's *active* Google Sheets configuration from Firestore (`users/{uid}/workflows/whatsapp_agent/sheetConfigs`). If no active config, stop. Let's say this returns `activeConfig = { sheetId: '...', columns: [...] }`.
    *   **Step 2: Call AI Extraction:** Call `aiService.extractDataWithGroq(message.text, activeConfig.columns)`.
    *   **Step 3: Handle AI Response:** If successful, receive `extractedData`. If fails, log the error and stop.
    *   **Step 4: Prepare Sheet Data:** Format `extractedData` into the array format required by the Google Sheets API `append` method (usually an array of values corresponding to the column order). Determine the correct column order based on `activeConfig.columns`.
    *   **Step 5: Write to Sheet:**
        *   Get an authenticated Google Sheets API client: `const sheets = google.sheets({ version: 'v4', auth: await googleOAuthService.getGoogleAuthClient(userId) });`
        *   Call the Sheets API:
            ```javascript
            await sheets.spreadsheets.values.append({
              spreadsheetId: activeConfig.sheetId,
              range: 'Sheet1!A1', // Or determine the sheet name dynamically
              valueInputOption: 'USER_ENTERED',
              requestBody: {
                values: [formattedRowDataArray], // e.g., [ ['John', 'john@example.com'] ]
              },
            });
            ```
    *   **Step 6: Log:** Log success or failure of the Sheets write operation.

**III. Error Handling & Security**

*   **Consistent Errors:** Use standardized JSON error responses from the API (e.g., `{ success: false, error: 'Detailed message', code: 'ERROR_CODE' }`).
*   **Logging:** Implement robust logging (e.g., using Winston) at each step: API requests, Firestore access, AI calls, Google API calls, errors.
*   **Input Validation:** Validate all incoming request bodies (e.g., using `express-validator` or Zod).
*   **Token Security:** Store Google refresh tokens securely (encrypted in Firestore). Never expose client secrets or API keys on the frontend. Use environment variables (`server/.env`).
*   **Google API Quotas:** Be mindful of Google API rate limits and implement retry logic or queuing if necessary.

This detailed technical plan provides a solid foundation. It clearly separates concerns, uses secure practices for credentials, and ensures the data (`fieldsConfig` / `columns`) is fetched and passed correctly to the AI service, preventing the `fields.map is not a function` error by design.
