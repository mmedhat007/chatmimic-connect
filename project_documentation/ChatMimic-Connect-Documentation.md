# ChatMimic Connect - Technical Documentation

## Overview

ChatMimic Connect is a WhatsApp AI agent management platform that allows businesses to create, configure, and manage AI-powered WhatsApp chatbots. The platform integrates with WhatsApp Business API, Firebase, and Supabase to provide a complete solution for businesses to automate their customer interactions.

## Database Architecture

The application uses a dual-database approach:

### 1. Firebase (Firestore)

Used for real-time messaging, user authentication, and WhatsApp integration.

#### Collections Structure:

**Users Collection**
- `{uid}` (document)
  - `email`: User's email address
  - `workflows` (map)
    - `{workflow_name}` (map)
      - `executions_used`: Number of executions used
      - `limit`: Usage limit
      - `reset_date`: Date when limit resets
      - `paid`: Boolean indicating if paid
  - `credentials` (map)
    - `googleAuthCredentials` (map): Google Analytics credentials
    - `whatsappCredentials` (map): WhatsApp credentials

**Whatsapp_Data Collection**
- `{uid}` (document)
  - `client_number`: WhatsApp business number ID
  - `chats` (subcollection)
    - `{phone_number}` (document)
      - `agentStatus`: Status of the AI agent ("on" or "off")
      - `contactName`: Name of the contact
      - `createdAt`: Creation timestamp
      - `humanAgent`: Boolean indicating if a human agent is active
      - `lastMessage`: Content of the last message
      - `lastMessageSender`: Sender of the last message
      - `lastMessageTime`: Timestamp of the last message
      - `phoneNumber`: Contact's phone number
      - `status`: Chat status (open, closed)
      - `tags`: Array of tags for categorization
      - `messages` (subcollection)
        - `{message_id}` (document)
          - `date`: Date string (e.g., "11/03/2025")
          - `message`: Message content
          - `sender`: Message sender ("agent", "human", or "user")
          - `timestamp`: Timestamp when message was sent
  - `templates` (subcollection)
    - `{template_id}` (document)
      - `name`: Template name
      - `content`: Template content
      - `created_at`: Creation timestamp
      - `is_active`: Boolean indicating if template is active
      - `type`: Template type (e.g., "auto_reply")

### 2. Supabase (PostgreSQL)

Used for storing agent configurations and vector embeddings for AI responses.

#### Tables Structure:

For each user, two tables are dynamically created with names based on the MD5 hash of the user's Firebase UID:

**Main Configuration Table (`user_table_{md5(uid)}`)**
- `id`: Serial primary key
- `company_info`: JSONB object containing company information
  - `name`: Company name
  - `industry`: Industry type
  - `website`: Company website
  - `locations`: Array of locations
  - `contact_info`: Contact information
- `services`: JSONB object containing service information
  - `main_offerings`: Array of main services offered
  - `special_features`: Array of special features
- `communication_style`: JSONB object containing communication preferences
  - `tone`: Preferred tone (e.g., "Professional yet friendly")
  - `languages`: Array of supported languages
  - `emoji_usage`: Boolean indicating if emojis should be used
  - `response_length`: Preferred response length
- `business_processes`: JSONB object containing business process information
  - `common_questions`: Array of common customer questions
  - `special_requirements`: Array of special requirements
- `integrations`: JSONB object containing integration information
  - `required_integrations`: Array of required integrations
  - `automation_preferences`: Automation preferences
  - `lead_process`: Lead processing information
- `created_at`: Timestamp of creation
- `updated_at`: Timestamp of last update

**Embeddings Table (`user_embeddings_{md5(uid)}`)**
- `id`: Serial primary key
- `content`: Text content
- `embedding`: Vector(1536) for semantic search
- `query_name`: Name of the query
- `created_at`: Timestamp of creation

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

## Security Considerations

1. **Authentication**: Firebase Authentication is used for user authentication
2. **Data Isolation**: Each user's data is stored in separate tables in Supabase
3. **API Keys**: API keys are stored in environment variables
4. **Row Level Security**: RLS is disabled for simplicity in development but should be enabled in production

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