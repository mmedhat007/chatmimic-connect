# ChatMimic Connect

ChatMimic Connect is a powerful platform for creating and managing AI-powered WhatsApp chatbots for businesses. The platform enables seamless integration with WhatsApp Business API, Google Sheets, and advanced AI capabilities to deliver intelligent conversation experiences.

## Key Features

- **AI-Powered Chatbots**: Create custom WhatsApp agents with natural language understanding capabilities
- **Google Sheets Integration**: Automatically collect and organize customer data in Google Sheets
- **Lifecycle Management**: Track customer journey stages with intelligent tagging
- **Behavior Rules**: Configure custom conversation rules and response patterns
- **Analytics Dashboard**: Monitor conversation metrics and performance
- **User-Friendly Interface**: Simple configuration without requiring technical expertise

## Documentation

All project documentation is available in the `project_documentation` folder with a clear, organized structure:

- Project overview and user flows
- Technical architecture and database structure 
- API reference and integration guides
- Deployment and maintenance instructions
- Troubleshooting guides

## Data Management

### Intelligent Data Collection

ChatMimic Connect can automatically extract structured data from conversations and organize it into Google Sheets. Configure exactly which data points to collect and where to store them.

### Vector Embeddings

The platform uses advanced embedding technology to understand conversation context and provide more relevant responses. OpenAI's `text-embedding-3-small` model powers semantic search and retrieval for automation workflows.

## Lifecycle Management

### Automated Customer Tagging

The application includes an intelligent lifecycle tagging system that automatically categorizes contacts based on message content and engagement patterns.

**Manual Override Feature:**
- Manually set a contact's lifecycle stage through the dropdown menu
- A small "M" badge appears next to the lifecycle dropdown to indicate manual mode
- Re-enable automatic tagging when desired

This feature ensures that your intentional categorizations of contacts are preserved while still benefiting from the automatic tagging system.

## Getting Started

There are several ways to work with the ChatMimic Connect codebase:

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/cc292d52-f917-488b-b1ce-98dfd75b5b1a) and start prompting.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes:

```sh
# Step 1: Clone the repository
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies
npm i

# Step 4: Start the development server
npm run dev
```

**Edit directly in GitHub**

- Navigate to the desired file(s)
- Click the "Edit" button (pencil icon) at the top right
- Make your changes and commit

**Use GitHub Codespaces**

- Navigate to the main repository page
- Click on the "Code" button near the top right
- Select the "Codespaces" tab
- Click on "New codespace" to launch a new environment

## Technology Stack

ChatMimic Connect is built with modern technologies:

- **Frontend**: React with TypeScript, Vite, Tailwind CSS, shadcn-ui
- **Backend**: Node.js with Express
- **Authentication**: Firebase Authentication
- **Databases**: Firebase Firestore and Supabase Vector Database
- **AI Services**: OpenAI API, Groq
- **Integration**: WhatsApp Business API, Google Sheets API

## Deployment

For detailed deployment instructions, see the [Production Setup Guide](project_documentation/6-deployment/production_setup.md).

## Custom Domain Setup

While custom domains aren't directly supported through the platform, you can deploy your project under your own domain using Netlify. Visit our docs for more details: [Custom domains](https://docs.lovable.dev/tips-tricks/custom-domain/)
