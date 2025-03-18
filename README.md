# Welcome to ChatMimic Connect

## Project info

**URL**: https://lovable.dev/projects/cc292d52-f917-488b-b1ce-98dfd75b5b1a

## Supabase Integration

This project uses Supabase for storing user configurations and embeddings. Follow these steps to set up the Supabase integration:

1. Check the [Supabase Setup Guide](docs/SUPABASE_SETUP.md) for detailed instructions.
2. Run the SQL scripts in the `sql/migrations` directory to set up the necessary tables and functions.
3. Make sure your environment variables are set correctly in `.env` or `.env.local`.

### Required Environment Variables

```
VITE_SUPABASE_URL=https://kutdbashpuuysxywvzgs.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_OPENAI_API_KEY=your_openai_api_key
```

### Database Tables

The application uses the following Supabase tables:

1. `user_configs` - Stores user configuration data for the WhatsApp AI agent
2. `user_embeddings` - Stores embeddings for semantic search

### Vector Embeddings

This project uses OpenAI's `text-embedding-3-small` model to create embeddings for user configurations. These embeddings are stored in Supabase for semantic search and retrieval in n8n workflows.

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/cc292d52-f917-488b-b1ce-98dfd75b5b1a) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

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

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with .

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/cc292d52-f917-488b-b1ce-98dfd75b5b1a) and click on Share -> Publish.

## I want to use a custom domain - is that possible?

We don't support custom domains (yet). If you want to deploy your project under your own domain then we recommend using Netlify. Visit our docs for more details: [Custom domains](https://docs.lovable.dev/tips-tricks/custom-domain/)
