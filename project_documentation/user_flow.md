# ChatMimic Connect - User Flow Documentation

## Overview

This document describes the user journey through ChatMimic Connect, from initial signup to fully operational WhatsApp AI agent. The flow is designed to be intuitive and guide users through the necessary setup steps in a logical sequence.

---

## Registration & Authentication

### Signup Process
1. User visits the signup page
2. User provides email and password (minimum 8 characters)
3. System creates a new user account in Firebase Authentication
4. System creates initial user document in Firebase Firestore

### Login Process
1. User visits the login page
2. User provides email and password
3. System authenticates user against Firebase Authentication
4. System redirects to the Platform Selection page (if new user) or Dashboard (if returning user)

---

## Platform Selection

After initial registration, users are presented with platform options:

1. User is presented with available platforms:
   - WhatsApp (active)
   - Meta Platforms (Facebook & Instagram) - coming soon
2. User selects WhatsApp platform
3. System records the platform choice
4. System redirects to WhatsApp Setup page

---

## WhatsApp Setup (5-Step Process)

The WhatsApp setup follows a guided 5-step process to help users connect their WhatsApp Business account:

### Step 1: Create Meta App
- User is guided to visit Meta Developers portal
- User creates a Business type app
- User provides business details as required by Meta

### Step 2: Add WhatsApp Product
- User adds WhatsApp product to their Meta app
- User is directed to the WhatsApp configuration section

### Step 3: Configure Webhook
- User configures webhook URL: `https://automation.denoteai.tech/webhook/whatsapp-webhook`
- User creates and saves a Verify Token
- User enables the "messages" webhook field

### Step 4: API Setup & Phone Number
- User adds and verifies their business phone number
- User is guided to generate a permanent access token with appropriate permissions

### Step 5: Enter Credentials
- User enters their WhatsApp access token
- User enters their WhatsApp phone number ID
- System validates the credentials by sending a test message
- System saves credentials to Firebase
- System creates necessary WhatsApp data structures:
  - WhatsApp_Data document
  - Initial chat template
  - Welcome message template
- System initializes the WhatsApp workflow with:
  - `executions_used`: 0
  - `limit`: Default limit (based on plan)
  - `reset_date`: Next month's date
  - `paid`: Based on user's plan
  - `setup_completed`: Set to false to indicate agent setup is still needed
- System saves a record in localStorage to track WhatsApp setup completion
- System redirects to Agent Setup page

---

## Agent Setup Process

After WhatsApp setup, users configure their AI agent:

1. User enters business information:
   - Business name
   - Industry
   - Locations
   - Contact information
   - Differentiators

2. User configures communication style:
   - Tone (formal, casual, friendly, professional)
   - Emoji usage preferences
   - Response length preferences

3. User provides common scenarios and questions:
   - Frequently asked questions
   - Business processes
   - Special requirements

4. System saves configuration to:
   - Supabase (structured storage)
   - localStorage (for faster access)
   
5. System creates embeddings for semantic search (if OpenAI API is configured)

6. System updates workflow status with `setup_completed: true`

7. System redirects user to Dashboard

---

## Dashboard & Operational Flow

After completing both WhatsApp and Agent setups:

1. User accesses the Dashboard
2. Dashboard displays:
   - Recent conversations
   - New messages
   - Agent status
   - Lifecycle sidebar for lead management

3. User can:
   - View and respond to messages
   - Toggle AI agent on/off for specific conversations
   - Categorize leads through the lifecycle sidebar
   - Access templates and settings

---

## Settings & Configuration Updates

Users can update their configuration at any time:

1. User accesses Automations page to modify AI agent behavior:
   - Company information
   - Communication style
   - Common questions
   - Business processes
   
2. User accesses Settings page to manage:
   - WhatsApp connection
   - Account settings
   - Integration preferences

3. Changes are saved to both Supabase and localStorage

---

## Data Storage Strategy

The system uses a dual-storage approach for optimal performance:

1. User authentication data and WhatsApp credentials in Firebase
2. AI agent configuration in both:
   - Supabase (structured JSONB data)
   - localStorage (for faster access and to prevent repeated setup prompts)
3. WhatsApp message history in Firebase (real-time database)
4. Embeddings for semantic search in Supabase (pgvector)

This approach balances security, performance, and user experience.

## Google Sheets Integration Flow

### Initial Setup
1. User navigates to the Google Sheets page from the sidebar or via prompt after agent setup
2. User clicks "Connect Google Sheets" button
3. User is redirected to Google OAuth consent screen
4. User authorizes the application to access their Google Sheets
5. User is redirected back to the application with a success message
6. OAuth credentials are stored in the user's document under `credentials.googleSheetsOAuth`

### Configuration
1. User selects a Google Sheet from their Google Drive
2. User configures columns to extract from WhatsApp messages:
   - Predefined columns (Name, Phone, Product Interest, etc.)
   - Custom columns with AI extraction prompts
3. User saves the configuration
4. Configurations are stored in the user's document under `workflows.whatsapp_agent.sheetConfigs`
5. User can create multiple configurations for different data collection needs
6. User can toggle configurations on/off as needed

### Data Collection
1. When a new WhatsApp message arrives, the system checks for active Google Sheets configurations
2. For each active configuration:
   - Data is extracted from the message using AI processing
   - A new row is added to the configured Google Sheet
   - The system keeps track of processed messages to avoid duplicates

### Testing
1. User can send a test message to verify the integration
2. The test message is processed using active configurations
3. User can verify the data appears in their Google Sheet

### Management
1. User can edit existing configurations
2. User can disconnect Google Sheets access
3. User can view all active configurations
4. User can create new configurations as needed 