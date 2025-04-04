# ChatMimic Connect Documentation

## Cursor's Memory Bank

I am Cursor, an expert software engineer whose memory resets completely between sessions. To ensure continuity and effective work, I rely entirely on my Memory Bank. After every reset, I MUST read ALL files in the Memory Bank to understand the project context before starting any task.

### Memory Bank Structure

All project documentation is consolidated in the project_documentation folder. The documentation is organized as follows:

```mermaid
flowchart TD
OV[1-overview.md] --> AR[2-architecture.md]
OV --> API[3-api.md]
OV --> SEC[4-security.md]
OV --> INT[5-integrations.md]
OV --> DEP[6-deployment.md]
OV --> TRB[7-troubleshooting.md]
```

### Core Files (Required)

#### 1-overview
- Provides a high-level summary of the project, defining core requirements, scope, and goals.
- Acts as the foundation for all other documentation.

#### 2-architecture
- Details the system architecture, including diagrams and technical relationships.
- Serves as a reference for overall design and technical decisions.

#### 3-api
- Documents API endpoints, including request/response specifications and integration guidelines.

#### 4-security
- Outlines security policies, configurations, and best practices.
- Highlights potential vulnerabilities and their mitigations.

#### 5-integrations
- Describes third-party integrations and external service configurations.
- Provides instructions for connecting and troubleshooting integrations.

#### 6-deployment
- Contains deployment procedures, environment configurations, and hosting information.
- Explains how to update and maintain the production environment.

#### 7-troubleshooting
- Lists known issues, error messages, and their resolutions.
- Provides a quick-reference guide for debugging and support.

### Continuous Act Mode

I operate in continuous Act Mode, which means I always:

1. **Check the Memory Bank**:
   - Before executing any task, I must review all files in the project_documentation folder to fully understand the current project context.

2. **Update Documentation Immediately**:
   - Any changes in code, configuration, or project strategy must be immediately and accurately reflected in the appropriate documentation file within project_documentation.

3. **Reference Only This Source**:
   - I must rely solely on the files in project_documentation as my official source of project context and avoid using any external references or outdated information.

### Project Intelligence (.cursor/rules)

The .cursor/rules file serves as my learning journal. It captures key insights, project-specific patterns, user preferences, and critical implementation paths. This is a living document that evolves as the project progresses.

#### What to Capture
- Core project requirements and goals (from 1-overview.md)
- System architecture and component relationships (from 2-architecture.md)
- API specifications and usage guidelines (from 3-api.md)
- Security configurations and best practices (from 4-security.md)
- Integration details (from 5-integrations.md)
- Deployment and environment procedures (from 6-deployment.md)
- Troubleshooting tips and known issues (from 7-troubleshooting.md)

**REMEMBER**: After every session reset, I start fresh. The project_documentation folder is my only link to previous work. It must be maintained with precision and clarity. My effectiveness depends entirely on its accuracy. Every change I make in code or configuration must be reflected immediately in the documentation.

## Documentation Structure

This documentation provides comprehensive information about the ChatMimic Connect platform, a WhatsApp AI agent management system that allows businesses to create, configure, and manage AI-powered WhatsApp chatbots.

### 1. Overview
- [Project Overview](1-overview/project_overview.md) - High-level description of the project
- [User Flow](1-overview/user_flow.md) - End-to-end user journey
- [Assistant Capabilities](1-overview/assistant_capabilities.md) - Features of the AI assistant

### 2. Architecture
- [Technical Architecture](2-architecture/technical_architecture.md) - System architecture overview
- [Database Structure](2-architecture/database_structure.md) - Database schema and relationships
- [Backend Security](2-architecture/backend_security.md) - Security implementation details

### 3. API
- [API Reference](3-api/api_reference.md) - Comprehensive API documentation
- [Backend Updates](3-api/backend_updates.md) - Recent backend improvements

### 4. Security
- [Security Guidelines](4-security/security_guidelines.md) - Security best practices
- [Agent Behavior Rules](4-security/agent_behavior_rules.md) - Rules governing AI agent behavior

### 5. Integrations
- [Google Sheets Integration](5-integrations/google_sheets_integration.md) - Google Sheets setup and usage
- [N8N Integration](5-integrations/n8n_integration.md) - N8N workflow automation
- [Vector Store Integration](5-integrations/vector_store_integration.md) - Vector embeddings setup

### 6. Deployment
- [Production Readiness](6-deployment/production_readiness.md) - Production deployment checklist
- [Production Setup](6-deployment/production_setup.md) - Production environment setup

### 7. Troubleshooting
- [Common Issues](7-troubleshooting/common_issues.md) - Frequently encountered problems and solutions
- [Supabase Troubleshooting](7-troubleshooting/supabase_troubleshooting.md) - Supabase-specific issues

## Additional Documentation
- [Development Rules](development_rules.md) - Coding standards and practices
- [Migration Guide](migration_guide.md) - Database migration procedures
- [Frontend Structure](frontend_structure.md) - Frontend architecture and components
- [Backend DB Structure](backend_db_structure.md) - Detailed database architecture

## Development Setup

### Prerequisites
- Node.js (v16+)
- npm (v8+)
- Firebase account (for authentication)

### Setup Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/chatmimic-connect.git
   cd chatmimic-connect
   ```

2. Install dependencies:
   ```bash
   npm install
   cd server && npm install && cd ..
   ```

3. Configure Firebase Authentication:
   - Create a Firebase service account in your Firebase project settings
   - Download the service account credentials JSON file
   - Save it as `server/firebase-credentials.json`
   - Ensure this file is in your .gitignore (it should be already)

4. Create an environment file:
   - Copy .env.example to .env
   - Fill in all required values, especially Firebase-related ones

5. Start the development server:
   ```bash
   ./start-dev.sh
   ```

### Authentication

The system uses Firebase Authentication for all API requests:

- All API requests require a valid Firebase ID token in the Authorization header
- There are no development shortcuts or mock authentication
- Create test users in Firebase Authentication console for development
- Use Firebase Admin SDK to generate tokens for testing

Example of authenticated API request:
```bash
curl -H "Authorization: Bearer eyJhbGciOiJSUzI1..." http://localhost:3000/api/your-endpoint
```

### Important Security Notes

- Never commit the Firebase credentials file to version control
- All endpoints require proper authentication in all environments
- No authentication bypasses are allowed, even in development 