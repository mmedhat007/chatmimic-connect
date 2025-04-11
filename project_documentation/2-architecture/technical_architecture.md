# ChatMimic Connect - Technical Documentation

## Overview

ChatMimic Connect employs a modern web architecture separating frontend and backend concerns. It leverages cloud services like Firebase for real-time data and authentication, Supabase for relational data and vector embeddings, and external AI APIs (OpenAI, Groq) for its core intelligence.

## Frontend (Client-Side)

- **Framework:** React with TypeScript (using Vite for bundling)
- **State Management:** React Context API, potentially Zustand or Redux for more complex state.
- **UI Components:** Shadcn UI library, custom components.
- **Routing:** React Router.
- **Key Responsibilities:**
    - User Interface & User Experience (Configuration pages, Chat Dashboard).
    - User Authentication flow (handling Firebase UI interactions).
    - Initiating Google OAuth flow via backend API.
    - Displaying real-time chat data (listening to Firebase).
    - Sending user messages via backend API.
    - Managing agent & WhatsApp configurations via backend API.
    - **Managing Google Sheets configurations** via backend API (saving, listing sheets, testing connection, disconnecting).
    - Triggering the Google Sheets integration **manual test** via UI button (calls backend APIs).
    - **Note:** Does *not* handle persistent listening or automatic processing of incoming WhatsApp messages for Sheets integration. This is now handled entirely by the backend.

## Backend (Server-Side)

- **Platform:** Node.js with Express framework.
- **Authentication:** Firebase Authentication (validating JWTs via Firebase Admin SDK).
- **Database:**
    - **Firebase Firestore:** Real-time storage for user data, WhatsApp chat messages, encrypted Google OAuth credentials, Google Sheet configurations (`workflows.whatsapp_agent.sheetConfigs`).
    - **Supabase (PostgreSQL):** Storage for agent configurations, business information, vector embeddings (using pgvector).
- **API:** RESTful API endpoints for frontend interactions (config management, Google OAuth, Google Sheet UI support, AI proxy).
- **Key Services & Responsibilities:**
    - **`server/index.js`:** Main application entry point, initializes Firebase Admin, sets up middleware (CORS, Helmet, Rate Limiting), registers routes, **initializes and starts the background message processor service**. Handles graceful shutdown.
    - **`server/middleware/auth.js`:** Handles Firebase token verification for protected routes.
    - **`server/routes/*`:** Define API endpoints for various functionalities (config, proxy, Google Sheets UI support, AI).
    - **`server/services/googleService.js`:** Handles all direct interactions with Google APIs (Sheets, Drive, OAuth token management) using stored user credentials (fetched via UID). Manages token encryption/decryption and refresh. **Provides functions for finding, appending, and updating rows in Google Sheets**, used by `messageProcessorService`.
    - **`server/services/aiService.js`:** Handles interactions with AI APIs (currently Groq via Axios) for tasks like data extraction. Uses server-side API keys. Called by `messageProcessorService`.
    - **`server/services/embeddingService.js` (or similar):** Handles interactions with OpenAI API for generating text embeddings.
    - **`server/services/messageProcessorService.js`:** **(Core Google Sheets Automation Engine)**
        - Runs persistently after server startup, initialized in `index.js`.
        - Uses Firebase Admin SDK (`onSnapshot`) to listen to the `messages` collection group in Firestore for new, unprocessed user messages (`isProcessedByAutomation: false`, `sender: 'user'`).
        - Orchestrates the processing pipeline for Sheets integration:
            - Fetches the relevant user's active Google Sheet configuration(s) and credentials from Firestore.
            - Calls `aiService.extractDataFromMessage` for data extraction based on the message and configured columns.
            - Calls `googleService.findContactRow` to check for existing entries.
            - Calls `googleService.appendSheetRow` or `googleService.updateSheetRow` to interact with the Google Sheets API using the user's stored credentials.
            - Updates the processed message document in Firestore (`isProcessedByAutomation: true`, `automationStatus`).
    - **`server/services/proxyService.js` (If Applicable):** Handles secure proxying of requests to external services.
    - **`server/utils/logger.js`:** Centralized logging using Winston.
    - **`server/utils/encryption.js` (If Applicable):** Handles encryption/decryption of sensitive data like Google OAuth tokens stored in Firestore.

## Databases

- **Firebase Firestore:**
    - **`/Users/{uid}`:** Stores user profile information, API keys (e.g., WhatsApp), encrypted Google OAuth credentials, agent configuration references, Google Sheet configurations (`workflows.whatsapp_agent.sheetConfigs`).
    - **`/Whatsapp_Data/{uid}/chats/{phoneNumber}/messages/{messageId}`:** Stores individual WhatsApp messages with sender info, timestamp, content, and processing flags like `isProcessedByAutomation`, `automationStatus`, `isTestMessage`.
    - Real-time capabilities used for chat updates on the frontend.
    - **Listener:** The backend `messageProcessorService` uses a collection group query on `messages` with appropriate filters.
- **Supabase (PostgreSQL):**
    - Stores detailed agent configurations (business info, communication style, Q&A).
    - Stores vector embeddings generated from configuration data.
    - `pgvector` extension used for similarity searches.
    - Row Level Security (RLS) should be enabled, ensuring users can only access their own data.

## Integrations

- **WhatsApp Business API:** Via Meta platform, using access tokens. Webhook configured to receive incoming messages, which are stored in Firestore.
- **Firebase:** Authentication, Firestore (real-time data, configs, credentials, message storage, trigger for backend listener).
- **Supabase:** PostgreSQL database, vector embeddings/search.
- **OpenAI API:** For text embeddings.
- **Groq API:** For LLM tasks like data extraction (called from backend `aiService`).
- **Google APIs (Sheets, Drive, OAuth):** Called securely from the backend (`googleService`) using user-authorized credentials stored in Firestore.

## Data Flow (Google Sheets Automation Example - Updated Flow)

1.  **WhatsApp Message Received:** WhatsApp -> Meta Webhook -> Backend Webhook Endpoint -> Message stored in Firestore (`/Whatsapp_Data/{uid}/chats/{phone}/messages/{msgId}`) with `sender: 'user'`, `isProcessedByAutomation: false` (and no `isTestMessage: true`).
2.  **Backend Listener Triggered:** The persistent `messageProcessorService.js` running on the server detects the new message document via its Firestore `onSnapshot` listener (`collectionGroup('messages').where('isProcessedByAutomation', '==', false)`).
3.  **Processing Initiated:** The service's `processSingleMessage(messageDoc)` function is invoked.
4.  **User Config Fetched:** The service extracts the `uid` from the message path, fetches the user's document (`/Users/{uid}`), retrieves active Google Sheet configuration(s) (`sheetConfigs`) and checks for Google credentials (`refreshToken`).
5.  **AI Extraction:** For each active config, the service calls `aiService.extractDataFromMessage(messageData.message, config.columns)`.
6.  **Sheet Interaction:** The service calls `googleService.findContactRow(uid, config, contactPhoneNumber)`. Based on the result, it calls either `googleService.appendSheetRow(uid, config, rowData)` or `googleService.updateSheetRow(uid, config, rowIndex, rowData)`. These `googleService` functions handle authentication using the user's stored credentials.
7.  **Message Updated:** The service updates the original message document in Firestore via `markMessageProcessed`, setting `isProcessedByAutomation: true` and `automationStatus` details.

## Security Considerations

- Secure handling of API keys and user credentials (encryption at rest for Google tokens).
- Input validation on all API endpoints.
- Authentication middleware (`requireAuth`) protecting relevant backend routes.
- Rate limiting applied to backend APIs.
- Supabase Row Level Security.
- Proper CORS and Helmet configuration.

## Scalability Considerations

- Firestore/Supabase scale automatically to a large extent.
- Backend server may need horizontal scaling under heavy load (multiple instances).
- Optimize Firestore queries (indexing, filtering).
- Optimize Supabase vector searches.
- Consider message queues (like Google Pub/Sub or RabbitMQ) for decoupling message ingestion from processing if the listener becomes a bottleneck (Future optimization).

## Key SQL Functions

### 1. `create_user_table(uid TEXT)`

Creates the main configuration table and embeddings table for a user if they don't exist. The function:
- Sanitizes the user ID and creates table names using MD5 hashing
- Checks if the tables already exist
- Creates the tables with appropriate schema if they don't exist
- Creates an index on the embeddings table for vector similarity search
- Disables Row Level Security (RLS) for simplicity in development
- Returns a boolean indicating success or failure

### 2. `match_documents(query_embedding VECTOR(1536), match_threshold FLOAT, match_count INT, table_name TEXT)`

Performs semantic search on the embeddings table using vector similarity. The function:
- Sanitizes the table name using MD5 hashing
- Checks if the table exists
- Executes a query to find similar embeddings based on cosine similarity
- Returns matching documents with their similarity scores

## Application Architecture

### Core Services

#### 1. Firebase Service (`firebase.ts`)

Handles authentication, real-time messaging, and WhatsApp integration:
- User authentication (login, signup, password reset)
- Real-time chat management
- WhatsApp template management
- Contact management

#### 2. Supabase Service (`supabase.ts`)

Manages agent configuration and vector embeddings:
- Creating user-specific tables
- Saving and retrieving agent configurations
- Generating and storing embeddings for semantic search
- Performing vector similarity search for AI responses

#### 3. API Service (`api.ts`)

Handles external API integrations:
- WhatsApp Business API integration
- OpenAI API for embeddings and completions

### Key Pages

#### 1. Agent Setup Page (`AgentSetupPage.tsx`)

Guides users through setting up their WhatsApp AI agent:
- Collects business information
- Configures communication style
- Sets up common questions and responses
- Saves configuration to Supabase
- Creates embeddings for semantic search

#### 2. WhatsApp Setup Page (`WhatsAppSetup.tsx`)

Configures WhatsApp Business API integration:
- Collects WhatsApp Business Account ID
- Sets up phone number ID
- Configures access token and verify token
- Creates initial message templates

#### 3. Main Dashboard (`Index.tsx`)

Provides an overview of WhatsApp conversations:
- Displays active chats
- Shows message history
- Allows switching between AI and human agent modes
- Provides quick access to templates and settings

#### 4. Automations Page (`AutomationsPage.tsx`)

Allows customization of the AI agent's behavior:
- Editing company information
- Configuring services and offerings
- Setting communication style preferences
- Managing business processes and integrations

#### 5. Settings Page (`Settings.tsx`)

Manages user settings and integrations:
- Account settings
- WhatsApp configuration
- Template management
- Integration settings

## Technical Implementation Details

### Agent Configuration Flow

1. User completes the setup process in `AgentSetupPage.tsx`
2. Configuration data is structured as JSON objects
3. The `saveToSupabase` function is called with the configuration data
4. The function ensures user tables exist by calling `createUserTable`
5. Configuration data is saved to the main table using `saveAgentConfig`
6. Embeddings are generated for the configuration using OpenAI's API
7. Embeddings are saved to the embeddings table using `saveEmbeddings`

### WhatsApp Integration Flow

1. User configures WhatsApp in `WhatsAppSetup.tsx`
2. WhatsApp credentials are saved to Firebase
3. A webhook endpoint is created for receiving WhatsApp messages
4. Incoming messages trigger the AI agent to generate responses
5. Responses are sent back to the user via WhatsApp Business API

### AI Response Generation Flow

1. Incoming message is received from WhatsApp
2. Message is stored in Firebase
3. AI agent retrieves relevant context using vector similarity search
4. OpenAI API is used to generate a response based on the context
5. Response is sent back to the user and stored in Firebase

## Deployment Architecture

The application is deployed as a web application with the following components:

1. **Frontend**: React application deployed on a web server
2. **Backend**: Firebase and Supabase for database and authentication
3. **Webhook**: Endpoint for receiving WhatsApp messages
4. **Vector Search**: Supabase with pgvector extension for semantic search

## Troubleshooting Common Issues

### 1. Table Creation Issues

If tables are not being created properly:
- Check if the `create_user_table` function is being called with the correct UID
- Verify that the UID is being properly sanitized
- Check for any errors in the SQL function execution

### 2. Authentication Issues

If users cannot authenticate:
- Verify Firebase configuration
- Check if the user exists in Firebase Authentication
- Ensure the correct API keys are being used

### 3. WhatsApp Integration Issues

If WhatsApp integration is not working:
- Verify WhatsApp Business API credentials
- Check webhook configuration
- Ensure the webhook endpoint is accessible

### 4. Vector Search Issues

If vector search is not working:
- Verify that the pgvector extension is enabled
- Check if embeddings are being properly generated and stored
- Ensure the correct table names are being used for queries

## Future Enhancements

1. **Multi-language Support**: Enhance the AI agent to support multiple languages
2. **Advanced Analytics**: Implement detailed analytics for conversation tracking
3. **Integration Marketplace**: Create a marketplace for third-party integrations
4. **Custom Training**: Allow users to train their AI agents with custom data
5. **Workflow Automation**: Implement advanced workflow automation for complex scenarios 