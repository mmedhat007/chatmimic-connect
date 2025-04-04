#!/bin/bash

# ChatMimic Connect - Local Development Setup Script
echo "Setting up ChatMimic Connect for local development..."

# Check if .env files exist, create from examples if not
if [ ! -f ".env" ]; then
  echo "Creating main .env file from example..."
  cp .env.example .env
  echo "Please update .env with your actual credentials"
fi

if [ ! -f "server/.env" ]; then
  echo "Creating server .env file from example..."
  cp server/.env.example server/.env
  echo "Please update server/.env with your actual credentials"
fi

# Set NODE_ENV to development in server/.env
if [ -f "server/.env" ]; then
  echo "Setting NODE_ENV=development in server/.env"
  if grep -q "NODE_ENV=" server/.env; then
    sed -i '' 's/NODE_ENV=.*/NODE_ENV=development/' server/.env
  else
    echo "NODE_ENV=development" >> server/.env
  fi
fi

# Install dependencies
echo "Installing frontend dependencies..."
npm install

echo "Installing server dependencies..."
cd server && npm install && cd ..

# Install concurrently if not already installed
if ! npm list --depth=0 | grep -q concurrently; then
  echo "Installing concurrently for running frontend and backend together..."
  npm install --save-dev concurrently
fi

echo "Setup complete! You can now run the app with:"
echo "npm run dev:full"
echo ""
echo "This will start both the frontend dev server and the backend API server."
echo "The frontend will be available at http://localhost:8080"
echo "API requests will be proxied automatically to the backend at http://localhost:3000" 