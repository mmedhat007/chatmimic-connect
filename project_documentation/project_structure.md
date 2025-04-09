# Frontend Project Structure (`src`)

This document details the structure and purpose of key directories within the `src` folder of the frontend application.

## `src/services`

This directory contains modules responsible for interacting with external APIs and backend services. Each file typically encapsulates logic related to a specific service or external system.

- **`api.ts`**: Defines the core API client instance (likely using `axios` or `fetch`) and potentially includes base configurations like setting base URLs, headers (e.g., `Authorization`), and interceptors for request/response handling (e.g., error handling, token refresh). It provides a foundation for other service files.
- **`ai.ts`**: Handles interactions with AI-related backend endpoints. This includes functions for:
    - Generating text embeddings (e.g., calling `/api/proxy/embeddings`).
    - Performing data extraction or other tasks using LLMs via backend proxies.
- **`firebase.ts`**: Contains functions for interacting with Firebase services, likely focused on:
    - Firestore database operations (CRUD - Create, Read, Update, Delete).
    - Firebase Authentication (though user state management might be handled elsewhere).
    *(Note: Interactions might occur directly from the frontend or via backend proxy endpoints depending on security requirements).*
- **`googleSheets.ts`**: Manages interactions related to the Google Sheets integration. This primarily involves calling backend endpoints (`/api/google-sheets/*`) to:
    - Check connection status.
    - Initiate or disconnect the integration.
    - List available spreadsheets/sheets.
    - Test the connection.
    *(Direct Google API calls are avoided for security; the backend handles credentials).*
- **`initializer.ts`**: Contains initialization logic that needs to run when the application starts. This could include:
    - Setting up API client configurations.
    - Initializing authentication state.
    - Fetching initial application data or configuration.
- **`lifecycleTagging.ts`**: Implements the logic for determining and potentially updating customer lifecycle stages based on interactions or data. It might involve calls to backend services to fetch rules or update customer records.
- **`supabase.ts`**: Provides functions for interacting with Supabase services. Similar to `firebase.ts`, this likely includes:
    - Supabase database operations (PostgreSQL).
    - Supabase Authentication.
    *(Direct frontend interaction vs. backend proxy depends on the specific setup).*
- **`whatsappGoogleIntegration.ts`**: Contains specific logic orchestrating the integration between WhatsApp events (likely received via webhooks proxied through the backend) and Google Sheets actions (also performed via backend endpoints). This acts as a higher-level service coordinating other services.

## `src/utils`

This directory holds general utility functions and helpers used across different parts of the frontend application.

- **`api.ts`**: Contains utility functions specifically designed to facilitate making and handling API requests *within the frontend components*. This might include:
    - Standardized functions for GET, POST, PUT, DELETE requests that wrap the core client from `services/api.ts`.
    - Consistent error handling and formatting for API responses used in UI components.
    - Helper functions for constructing API request payloads or query parameters.
    *(Distinction: `services/api.ts` sets up the *base client*, while `utils/api.ts` provides *helper functions* for using that client throughout the UI code).*
- **`validation.ts`**: Provides functions for validating data, commonly used in forms or before sending data to the backend. Examples include:
    - Email format validation.
    - Password strength checks.
    - Checking for required fields.
    - Number or date format validation. 