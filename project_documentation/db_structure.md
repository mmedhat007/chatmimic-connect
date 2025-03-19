# ChatMimic Connect - Database Structure

## Dual-Database Architecture

The application uses a dual-database approach combining Firebase (Firestore) and Supabase (PostgreSQL).

---

## 1. Firebase (Firestore)

Used for real-time messaging, user authentication, and WhatsApp integration.

### Collections Structure

#### Users Collection
- `{uid}` (document)
  - `email`: String - User's email address
  - `workflows` (map)
    - `{workflow_name}` (map)
      - `executions_used`: Number - Count of executions used
      - `limit`: Number - Usage limit
      - `reset_date`: Timestamp - Date when limit resets
      - `paid`: Boolean - Indicates if paid
      - `setup_completed`: Boolean - Indicates if agent setup is completed
  - `credentials` (map)
    - `googleAuthCredentials` (map) - Google Analytics credentials
    - `whatsappCredentials` (map) - WhatsApp credentials
      - `access_token`: String - WhatsApp API access token
      - `phone_number_id`: String - WhatsApp business phone ID

#### Whatsapp_Data Collection
- `{uid}` (document)
  - `client_number`: String - WhatsApp business number ID
  - `chats` (subcollection)
    - `{phone_number}` (document)
      - `agentStatus`: String - Status of the AI agent ("on" or "off")
      - `contactName`: String - Name of the contact
      - `createdAt`: Timestamp - Creation timestamp
      - `humanAgent`: Boolean - Indicates if a human agent is active
      - `lastMessage`: String - Content of the last message
      - `lastMessageSender`: String - Sender of the last message
      - `lastMessageTime`: Timestamp - Timestamp of the last message
      - `phoneNumber`: String - Contact's phone number
      - `status`: String - Chat status (open, closed)
      - `tags`: Array - Tags for categorization
      - `lifecycle`: String - Lead status category ("new_lead", "vip_lead", "hot_lead", "payment", "customer", "cold_lead")
      - `assignedTeam`: String - Team assigned to the contact
      - `workflowStatus`: Object - Current workflow status information
        - `name`: String - Name of the current workflow
        - `status`: String - Status of the workflow ("started", "ended", "in_progress")
        - `timestamp`: Number - Timestamp when the status was last updated
      - `messages` (subcollection)
        - `{message_id}` (document)
          - `date`: String - Date string (e.g., "11/03/2025")
          - `message`: String - Message content
          - `sender`: String - Message sender ("agent", "human", or "user")
          - `timestamp`: Timestamp - When message was sent
  - `templates` (subcollection)
    - `{template_id}` (document)
      - `name`: String - Template name
      - `content`: String - Template content
      - `created_at`: Timestamp - Creation timestamp
      - `is_active`: Boolean - Indicates if template is active
      - `type`: String - Template type (e.g., "auto_reply")

---

## 2. Supabase (PostgreSQL)

Used for storing agent configurations and vector embeddings for AI responses.

### Tables Structure

#### User Configuration Table (`user_configs`)
- `id`: Serial - Primary key
- `user_id`: String - Firebase UID
- `temperature`: Float - AI temperature setting
- `max_tokens`: Integer - Maximum tokens for responses
- `full_config`: JSONB - Complete agent configuration data
- `created_at`: Timestamp - Creation timestamp
- `updated_at`: Timestamp - Last update timestamp

For each user, two tables are dynamically created with names based on the MD5 hash of the user's Firebase UID:

#### Main Configuration Table (`user_table_{md5(uid)}`)
- `id`: Serial - Primary key
- `company_info`: JSONB - Company information
  - `name`: String - Company name
  - `industry`: String - Industry type
  - `website`: String - Company website
  - `locations`: Array - Company locations
  - `contact_info`: Object - Contact information
- `services`: JSONB - Service information
  - `main_offerings`: Array - Main services offered
  - `special_features`: Array - Special features
- `communication_style`: JSONB - Communication preferences
  - `tone`: String - Preferred tone (e.g., "Professional yet friendly")
  - `languages`: Array - Supported languages
  - `emoji_usage`: Boolean - If emojis should be used
  - `response_length`: String - Preferred response length
- `business_processes`: JSONB - Business process information
  - `common_questions`: Array - Common customer questions
  - `special_requirements`: Array - Special requirements
- `integrations`: JSONB - Integration information
  - `required_integrations`: Array - Required integrations
  - `automation_preferences`: Object - Automation preferences
  - `lead_process`: Object - Lead processing information
- `created_at`: Timestamp - Creation timestamp
- `updated_at`: Timestamp - Last update timestamp

#### Embeddings Table (`user_embeddings_{md5(uid)}`)
- `id`: Serial - Primary key
- `content`: Text - Text content
- `embedding`: Vector(1536) - Vector for semantic search
- `query_name`: String - Name of the query
- `created_at`: Timestamp - Creation timestamp

### Browser Storage
The application also uses browser localStorage for certain data:
- `userUID`: String - Stores the current user's Firebase UID
- `user_{uid}_config`: JSON String - Stores the complete agent configuration for faster access
- `user_{uid}_whatsapp_config`: JSON String - Stores WhatsApp setup information to avoid redirects
  - `setup_completed`: Boolean - Indicates if WhatsApp setup is completed
  - `phone_number_id`: String - WhatsApp business phone ID
  - `timestamp`: String - When the configuration was saved

---

## Key SQL Functions

### 1. `create_user_table(uid TEXT)`
Creates the main configuration table and embeddings table for a user if they don't exist.

### 2. `match_documents(query_embedding VECTOR(1536), match_threshold FLOAT, match_count INT, table_name TEXT)`
Performs semantic search on the embeddings table using vector similarity.

### 3. `updateContactField(phoneNumber TEXT, field TEXT, value ANY)`
Updates a specific field for a contact in the Firebase database, used for updating lifecycle status and other contact properties.

### 4. `create_config_table()`
Creates the user_configs table in Supabase if it doesn't exist.

### 5. `check_column_exists(table_name TEXT, column_name TEXT)`
Checks if a specific column exists in a table.

### 6. `add_jsonb_column(table_name TEXT, column_name TEXT)`
Adds a JSONB column to a specified table.

---

## Relationships & Constraints

- Each user (Firebase UID) has corresponding tables in Supabase with names derived from the MD5 hash of their UID
- The embeddings table has an index on the embedding column for vector similarity search
- Row Level Security (RLS) is currently disabled for development but should be enabled in production
- Contacts can be categorized into predefined lifecycle stages (new lead, VIP lead, etc.) for better lead management