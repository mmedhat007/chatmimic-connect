# ChatMimic Connect Frontend Structure

This document provides a comprehensive overview of the ChatMimic Connect frontend architecture, components, features, and integrations. It serves as the central reference for understanding the frontend structure and implementation.

## Technology Stack

- **Framework**: React with TypeScript
- **Build Tool**: Vite
- **UI Components**: Custom components with Tailwind CSS for styling
- **State Management**: React Context API and local component state
- **Routing**: React Router DOM
- **API Communication**: Fetch API with interceptors for secure communication
- **Authentication**: Firebase Authentication

## Architecture Overview

The frontend follows a component-based architecture with the following organization:

1. **Pages**: Top-level route components
2. **Components**: Reusable UI elements
3. **Services**: API interactions and external service integrations
4. **Utils**: Helper functions and utilities
5. **Hooks**: Custom React hooks for shared functionality
6. **Context**: Application-wide state management

## Key Pages

1. **Dashboard**: Main user interface with agent statistics and activity overview
2. **AgentSetupPage**: Interactive wizard for configuring AI agents
3. **Automations**: Management of automated workflows and triggers
4. **Settings**: User preferences and account management
5. **GoogleCallback**: Handle OAuth redirects for Google integrations
6. **NotFound**: 404 error page

## Core Components

1. **ChatBot**: Main chat interface for interacting with AI assistants
2. **ConfigBuilder**: Component for building complex agent configurations
3. **Header**: Navigation and user account interface
4. **Sidebar**: Primary navigation component
5. **Modal**: Reusable modal dialog component
6. **Button**: Styled button components with various states
7. **FormFields**: Input, select, checkbox, and other form components
8. **Toast**: Notification component for user feedback

## Services

1. **firebase.ts**: Firebase authentication and firestore interactions
   - User authentication (login, logout, registration)
   - Session management
   - Real-time database operations

2. **supabase.ts**: Supabase database interactions
   - Vector database for embeddings
   - User configuration storage
   - Behavior rules management

3. **googleSheets.ts**: Google Sheets integration
   - OAuth authentication flow
   - Sheet reading/writing operations
   - Data processing and mapping

4. **ai.ts**: AI service integrations
   - Text extraction and processing
   - Data analysis using Groq models

5. **api.ts**: Central API utilities
   - API endpoint definitions
   - Request formatting
   - Authentication token management

## Authentication Flow

1. Firebase authentication provides user identity
2. Auth tokens are stored in localStorage and included in API requests
3. Fetch interceptors ensure proper handling of authorization headers
4. Token refresh is handled automatically by Firebase SDK

## Key Features

### 1. Agent Configuration

- **Behavior Rules**: Define how agents respond to different scenarios
- **Dynamic Prompting**: Generate context-specific prompts for AI models
- **Rule Testing**: Test behavior rules against sample inputs

### 2. WhatsApp Integration

- **Contact Management**: Import and manage WhatsApp contacts
- **Message Templates**: Create and manage approved message templates
- **Automation Rules**: Configure automated responses and actions

### 3. Google Sheets Integration

- **Data Import/Export**: Bidirectional data flow with Google Sheets
- **OAuth Authentication**: Secure authentication with Google APIs
- **Template Mapping**: Map sheet columns to system fields

### 4. Embeddings Generation

- **Vector Search**: Generate and store text embeddings for semantic search
- **Content Matching**: Find similar content based on semantic meaning
- **Knowledge Base**: Build and query knowledge bases for automated responses

### 5. Analytics

- **Conversation Metrics**: Track message volumes and response times
- **User Engagement**: Measure user interaction and satisfaction
- **Performance Tracking**: Monitor AI agent performance

## Frontend Security Measures

1. **Content Security Policy**: Restricts resource loading to trusted sources
2. **API URL Rewriting**: Prevents direct API calls to backend services
3. **Token Encryption**: Secure storage of authentication tokens
4. **Input Validation**: Client-side validation of all user inputs
5. **XSS Prevention**: Sanitization of dynamic content

## State Management

1. **Authentication State**: Managed through Firebase and context providers
2. **User Configurations**: Loaded from Supabase and cached locally
3. **Form State**: Managed locally with form hooks
4. **UI State**: Modal visibility, sidebar state, notifications

## Frontend-to-Backend Communication

1. All API calls are proxied through the frontend server to avoid CORS and certificate issues
2. Authentication tokens are automatically included in requests
3. Error handling provides user-friendly feedback
4. Rate limiting prevention through debounced requests

## Build and Deployment

1. **Development**: Local development server with hot reloading
2. **Production Build**: Optimized bundle with console statements removed
3. **Deployment**: Static files served through NGINX with proper caching
4. **CI/CD**: Automated builds and deployments (if configured)

## Frontend Project Structure (`src`)

### `src/services`

This directory contains modules responsible for interacting with external APIs and backend services:

- **`api.ts`**: Defines the core API client instance with base configurations
- **`ai.ts`**: Handles interactions with AI-related backend endpoints
- **`firebase.ts`**: Contains functions for interacting with Firebase services
- **`googleSheets.ts`**: Manages interactions related to the Google Sheets integration
- **`initializer.ts`**: Contains initialization logic that runs when the application starts
- **`lifecycleTagging.ts`**: Implements logic for determining and updating customer lifecycle stages
- **`supabase.ts`**: Provides functions for interacting with Supabase services
- **`whatsappGoogleIntegration.ts`**: Orchestrates the integration between WhatsApp events and Google Sheets actions

### `src/utils`

This directory holds general utility functions and helpers:

- **`api.ts`**: Contains utility functions for making and handling API requests
- **`validation.ts`**: Provides functions for validating data
- **`date.ts`**: Date formatting and manipulation utilities
- **`string.ts`**: String manipulation and formatting utilities

## Current Limitations and Planned Improvements

1. **Mobile Responsiveness**: Some views need better mobile optimization
2. **Performance Optimization**: Large component rendering needs optimization
3. **Offline Support**: Limited offline capabilities
4. **Accessibility**: WCAG compliance improvements needed
5. **Localization**: Internationalization support planned

## Integration Points

1. **Firebase**: Authentication and real-time updates
2. **Supabase**: Vector database and configuration storage
3. **Google APIs**: Sheets, Drive, and OAuth
4. **OpenAI/Groq**: AI model providers
5. **WhatsApp Business API**: Messaging platform connection 