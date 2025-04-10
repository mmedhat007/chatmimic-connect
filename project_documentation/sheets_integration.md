
You are absolutely right! Thank you for pointing that out and providing the specific field details. I apologize for overlooking the critical role of Firebase Firestore in storing the Google Sheets configuration. That's a crucial piece of the puzzle.

Let me revise the description, incorporating Firebase and the detailed field structure:

**Revised Google Sheets Integration Feature Description:**

1.  **Purpose:** Automate the extraction of specific information from WhatsApp messages and save it directly into designated Google Sheets columns.

2.  **Connecting Your Google Account:**
    *   Uses Google OAuth to securely grant the application permission to access and modify your Google Sheets.
    *   The backend stores the necessary OAuth tokens (access/refresh) securely, likely within the `users/{uid}/credentials/googleSheetsOAuth` map in Firestore, to interact with the Google Sheets API on your behalf.

3.  **Configuration - Defining What to Extract (Stored in Firestore):**
    *   This is where you define *what* data to extract and *where* it goes. This configuration is **stored in Firebase Firestore** within the user's document, specifically under `users/{uid}/workflows/whatsapp_agent/sheetConfigs`.
    *   For each Google Sheet integration you set up, you create a configuration object within the `sheetConfigs` array. This object typically includes:
        *   `name`: A user-friendly name for this specific configuration.
        *   `sheetId`: The ID of the target Google Sheet.
        *   `active`: A boolean indicating if this integration is currently enabled.
        *   **`columns`:** This is an **array** where you define each piece of data (field) to extract. Each element in this array is an object specifying:
            *   `id` (string): A unique internal identifier for the field (e.g., "customer\_name").
            *   `name` (string): The human-readable label for the field, often matching the Google Sheet column header (e.g., "Customer Name").
            *   `description` (string): A brief explanation of the field's purpose (e.g., "The name of the person sending the message").
            *   `type` (string): The expected data type (e.g., "name", "email", "phone", "text", "number"). This helps guide the AI.
            *   `aiPrompt` (string): **Crucially**, this provides specific instructions to the AI on how to identify and extract this particular piece of information from the message (e.g., "Extract any person's names mentioned in the message").
            *   `isAutoPopulated` (boolean): Indicates if the field might be filled automatically by the system rather than purely AI extraction (the exact mechanism needs verification).

4.  **The Extraction Process (When a Message Arrives):**
    *   When a WhatsApp message needs processing, the system triggers the extraction flow.
    *   The message text is sent to the backend `/api/proxy/extract-data` endpoint.
    *   The backend **retrieves the active Google Sheets configuration, including the detailed `columns` array (with all its fields like `id`, `name`, `type`, `aiPrompt`) from Firebase Firestore** for the relevant user.
    *   This configuration (specifically the `columns` array, which contains the `aiPrompt` for each field) and the message text are passed to the `aiService.js` -> `extractDataWithGroq` function.
    *   The AI model (Groq) uses the message content *and* the specific `aiPrompt` for each defined column/field to identify and extract the relevant data points.
    *   The AI returns the extracted information structured according to the defined fields (e.g., mapping the field `id` or `name` to the extracted value).

5.  **Saving to Google Sheets:**
    *   The backend service takes the structured data returned by the AI.
    *   Using the Google Sheets API credentials (retrieved from Firestore or managed server-side), it connects to the specified Google Sheet (`sheetId` from the config).
    *   It appends a new row, placing the extracted values into the columns corresponding to the `name` or `id` defined in the Firestore configuration.

Thank you again for the correction. This detailed view, including Firebase storage and the specific structure of the `columns` array with its `aiPrompt`, is essential for understanding how the feature is designed and where the current breakdown (`fields.map` error) is occurring – the backend isn't receiving that `columns` array in the expected format from the frontend request.
