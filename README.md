# Welcome to ChatMimic Connect

## Documentation

All project documentation has been consolidated into the `project_documentation` folder with a clear, organized structure. Please refer to [Project Documentation](project_documentation/README.md) for comprehensive information about:

* Project overview and user flow
* Technical architecture and database structure
* API reference and backend security
* Integrations (Google Sheets, N8N, Vector Store)
* Deployment and production setup
* Troubleshooting and maintenance

## Supabase Integration

This project uses Supabase for storing user configurations and embeddings. Follow these steps to set up the Supabase integration:

1. Check the [Vector Store Integration Guide](project_documentation/5-integrations/vector_store_integration.md) for detailed instructions.
2. Run the SQL scripts in the `sql/migrations` directory to set up the necessary tables and functions.
3. Make sure your environment variables are set correctly in `.env` or `.env.local`.


### Database Tables

The application uses a dual-database approach as described in the [Database Structure](project_documentation/2-architecture/database_structure.md) document.

### Vector Embeddings

This project uses OpenAI's `text-embedding-3-small` model to create embeddings for user configurations. These embeddings are stored in Supabase for semantic search and retrieval in n8n workflows.

## Lifecycle Management

### Features

#### Manual Lifecycle Override

The application includes an intelligent lifecycle tagging system that automatically categorizes contacts based on message content. However, when you manually set a contact's lifecycle stage through the dropdown menu, a "manual override" flag is activated. This prevents the automatic tagging system from changing the lifecycle stage until you decide to re-enable automatic tagging.

**How it works:**

* When you select a lifecycle stage from the dropdown, the contact is marked with `manually_set_lifecycle=true`
* A small "M" badge appears next to the lifecycle dropdown to indicate manual mode is active
* Automatic lifecycle tagging will not affect this contact until manual mode is disabled

**To re-enable automatic tagging:**

* Open the lifecycle dropdown
* Select "Enable Auto-Tagging" to remove the manual override flag

This feature ensures that your intentional categorizations of contacts are preserved while still benefiting from the automatic tagging system when desired.

## How can I edit this code?

There are several ways to edit your application:

### Use your preferred IDE

If you want to work locally using your own IDE, you can clone this repo and push changes.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

### Edit a file directly in GitHub

* Navigate to the desired file(s).
* Click the "Edit" button (pencil icon) at the top right of the file view.
* Make your changes and commit the changes.

### Use GitHub Codespaces

* Navigate to the main page of your repository.
* Click on the "Code" button (green button) near the top right.
* Select the "Codespaces" tab.
* Click on "New codespace" to launch a new Codespace environment.
* Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

* Vite
* TypeScript
* React
* shadcn-ui
* Tailwind CSS
* Firebase (Authentication, Firestore)
* Supabase (Vector Database)
* OpenAI API
* WhatsApp Business API

## How can I deploy this project?

For detailed deployment instructions, see the [Production Setup Guide](project_documentation/6-deployment/production_setup.md).

