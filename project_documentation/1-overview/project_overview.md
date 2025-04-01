# ChatMimic Connect - Project Specifications

## Project Overview

ChatMimic Connect is a WhatsApp AI agent management platform that allows businesses to create, configure, and manage AI-powered WhatsApp chatbots. The platform integrates with WhatsApp Business API, Firebase, and Supabase to provide a complete solution for businesses to automate their customer interactions.

---

## Core Features

### WhatsApp Integration
- [x] WhatsApp Business API integration
- [x] Webhook endpoint for receiving messages
- [x] Real-time message handling

### AI Agent Management
- [x] AI agent configuration interface
- [x] Custom communication style settings
- [x] Business information storage
- [x] Vector embeddings for semantic search

### Chat Management
- [x] Real-time chat interface
- [x] Human/AI agent toggling
- [x] Message history viewing
- [x] Contact management

### Template Management
- [x] WhatsApp message templates
- [x] Template creation and editing
- [x] Template activation/deactivation

### Lead Management
- [x] Lifecycle status sidebar
- [x] Lead categorization (New Lead, VIP Lead, Hot Lead, etc.)
- [x] Team assignment 
- [x] Workflow status tracking
- [x] Manual lifecycle override functionality
  - Manual flag to prevent automatic updates
  - Visual indicator for manually set stages
  - Option to re-enable automatic tagging

### Google Sheets Integration
- OAuth-based authentication with Google
- Automatic data extraction from WhatsApp messages using AI
- Custom column mapping with predefined and custom fields
- Real-time synchronization with new WhatsApp messages
- Token refresh mechanism for persistent access
- Test functionality to verify integration
- Multiple configuration support for different data collection needs

---

## Technical Architecture

### Frontend
- [x] React application
- [x] Agent setup flow
- [x] WhatsApp setup flow
- [x] Chat dashboard with lifecycle sidebar
- [x] Automations page
- [x] Settings page
- [x] Google Sheets integration page with custom icons

### Backend
- [x] Firebase for authentication and real-time data
- [x] Supabase for agent configuration and vector search
- [x] OpenAI API integration for embeddings and completions
- [x] WhatsApp Business API for messaging

### Database
- [x] Firebase Firestore collections for users and messages
- [x] Supabase PostgreSQL for configuration and embeddings
- [x] Vector similarity search using pgvector

### UI/UX Components
- [x] Sidebar navigation with platform-specific icons
- [x] Custom Google Sheets icon using the official spreadsheet design
- [x] Responsive chat interface
- [x] User-friendly form components
- [x] Intuitive configuration panels

---

## Current Development Status

### Completed
- User authentication system
- WhatsApp integration
- AI agent configuration
- Chat interface
- Template management
- Vector embeddings for semantic search
- Lifecycle management sidebar for lead tracking

### In Progress
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Integration marketplace

### Planned
- [ ] Custom training for AI agents
- [ ] Enhanced workflow automation
- [ ] Advanced lead management with scoring
- [ ] Mobile application
- [ ] Team collaboration features

### Future Integrations (Planned)
- CRM systems (Salesforce, HubSpot, etc.)
- Calendar systems (Google Calendar, Outlook)
- E-commerce platforms (Shopify, WooCommerce)
- Payment gateways (Stripe, PayPal)

---

## Key Components

### User Registration & Platform Selection Flow
The process by which new users join and select their platform:
1. User signs up with email and password
2. User selects WhatsApp as their platform
3. User is guided through WhatsApp Business API setup

### WhatsApp Setup Flow
The guided 5-step process for WhatsApp integration:
1. Create Meta App - Users create an app in Meta Developers portal
2. Add WhatsApp Product - Users add WhatsApp integration to their Meta app
3. Configure Webhook - Users set up webhook for message receiving
4. API Setup & Phone Number - Users verify their business phone number
5. Enter Credentials - Users input their access token and phone number ID
6. System saves the credentials and creates initial templates and structures

### Agent Setup Flow
The process by which users configure their AI agents:
1. Collect business information
2. Configure communication style
3. Set up common questions and responses
4. Save configuration to Supabase
5. Generate embeddings for semantic search

### WhatsApp Integration Flow
The process by which messages are handled:
1. Receive incoming message via webhook
2. Store message in Firebase
3. Generate AI response using context from vector search
4. Send response back via WhatsApp API
5. Update chat history in Firebase

### AI Response Generation
How the AI generates responses:
1. Retrieve relevant context using vector similarity search
2. Use OpenAI API to generate response based on context
3. Format response according to communication style preferences
4. Send response to user

### Lead Management Flow
How leads are tracked and managed:
1. Incoming messages create new contacts
2. Contacts can be categorized into lifecycle stages (New Lead, Hot Lead, etc.)
3. Manual lifecycle override prevents automatic updates when explicitly set by users
4. Visual indicators show when a contact's lifecycle is in manual mode
5. Contacts can be assigned to teams for handling
6. Workflow status shows automation processes applied to contacts

---

## Critical Issues & Challenges

### Security
- [ ] Enable Row Level Security in Supabase
- [ ] Implement proper API key management
- [ ] Secure webhook endpoint

### Scalability
- [ ] Optimize vector search for large datasets
- [ ] Implement caching for frequently accessed data
- [ ] Set up rate limiting for API calls

### Performance
- [ ] Optimize message handling for high-volume chats
- [ ] Improve vector search performance
- [ ] Reduce latency in AI response generation

---

## Implementation Notes

### User Flow
- Streamlined signup and onboarding process
- 5-step guided WhatsApp integration with detailed instructions
- Sequential setup: Platform selection → WhatsApp setup → Agent setup → Dashboard
- Using localStorage to track setup progress and avoid repeated setups

### Database Design
- Using dual-database approach for different data needs
- Dynamically creating user-specific tables in Supabase
- Using vector embeddings for semantic search
- Contact data includes lifecycle status and workflow information
- Agent configurations are stored in both Supabase (full_config) and localStorage for redundancy and performance

### WhatsApp Integration
- Guided setup process with Meta Developers portal instructions
- Using WhatsApp Business API for messaging
- Creating webhook endpoint for receiving messages
- Managing templates through WhatsApp API
- Storing credentials securely in Firebase

### AI Configuration
- Storing configuration as JSON objects in Supabase
- Using OpenAI API for embeddings and completions
- Performing vector similarity search for context retrieval
- Using localStorage to cache configuration for faster access and avoid repeated setups

### Lead Management
- Implementing lifecycle stages for lead categorization
- Supporting team assignment for lead handling
- Tracking automation workflows applied to contacts
- Providing a dedicated sidebar for lifecycle management 