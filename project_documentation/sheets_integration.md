# Google Sheets Integration - Functional Description (Updated for Backend Automation)

**1. Purpose:**

Automate the extraction of specific information from incoming user WhatsApp messages and save it directly into designated Google Sheets columns, enabling seamless data collection and analysis.

**2. Connecting Your Google Account:**

*   Uses Google OAuth for secure, user-granted permission for the application to access and modify Google Sheets on your behalf.
*   The connection process is initiated from the frontend UI.
*   The backend securely stores the necessary OAuth tokens (access/refresh, with encryption) in Firebase Firestore (`users/{uid}/credentials/googleSheetsOAuth`). This allows the backend automation service to interact with the Google Sheets API without requiring you to be logged in.

**3. Configuration - Defining What to Extract (Stored in Firestore):**

*   Configure the integration via the ChatMimic Connect dashboard.
*   This configuration tells the backend automation service *which* sheet to use and *what* data to extract.
*   Configuration is stored in Firebase Firestore (`users/{uid}/workflows/whatsapp_agent/sheetConfigs`).
*   For each desired Sheet integration, you create a configuration object including:
    *   `name`: A label for this configuration (e.g., "Lead Capture Sheet").
    *   `sheetId`: The unique ID of the target Google Sheet.
    *   `active`: A toggle to enable or disable this specific automation.
    *   **`columns`:** An array defining each piece of data (field) to extract and its corresponding sheet column. Each column object specifies:
        *   `id`: Internal identifier.
        *   `name`: The header name of the column in your Google Sheet.
        *   `description`: Explanation of the field.
        *   `type`: Data type hint for the AI (e.g., "name", "phone", "inquiry").
        *   `aiPrompt`: Specific instructions for the AI on how to extract this field from the message (e.g., "Extract the customer's primary question").

**4. The Automated Extraction & Saving Process (Backend Driven):**

*   **Trigger:** When a new message from a *user* arrives via WhatsApp, it's saved to Firestore.
*   **Backend Listener:** A persistent service (`messageProcessorService.js`) running on the ChatMimic Connect server continuously monitors Firestore for these new, unprocessed user messages.
*   **Automatic Processing:** When the listener detects a relevant message:
    1.  It retrieves the corresponding user's active Google Sheets configuration(s) from Firestore.
    2.  It calls the backend AI service (`aiService.js`), providing the message content and the configured `columns` (including `aiPrompt` instructions).
    3.  The AI extracts the requested information based on the prompts.
    4.  The backend service (`googleService.js`) securely uses the stored Google credentials to:
        *   Check if the contact (based on phone number) already exists in the target sheet.
        *   Either **append** a new row with the extracted data or **update** the existing row.
    5.  The original message in Firestore is marked as processed.
*   **Key Benefit:** This entire process runs **automatically on the backend server**, even if you don't have the ChatMimic Connect dashboard open. As long as the server is running and the configuration is active, messages will be processed and saved to your Google Sheet.

**5. Manual Testing:**

*   A "Test Integration" button is available in the configuration UI.
*   This button creates a special test message in Firestore and simulates the processing flow by calling the backend APIs directly (AI extraction, sheet interaction). This allows you to verify your configuration without waiting for a real customer message.

This backend-driven approach ensures that your Google Sheets are reliably updated with information from WhatsApp conversations in near real-time, without requiring manual intervention or the frontend application to be active.
