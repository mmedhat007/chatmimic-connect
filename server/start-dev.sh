#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting backend server in production mode...${NC}"
export PORT=3000
export PRODUCTION_MODE=true
echo -e "${YELLOW}Using real Firebase authentication - all API requests need valid Firebase tokens${NC}"

# Set Firebase credentials path to the server credentials file
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export GOOGLE_APPLICATION_CREDENTIALS="${SCRIPT_DIR}/firebase-credentials.json"

# Load environment variables from .env file if it exists
ENV_FILE="${SCRIPT_DIR}/.env"
if [ -f "$ENV_FILE" ]; then
  echo -e "${GREEN}Loading environment variables from ${ENV_FILE}${NC}"
  
  # Load Firebase database URL from .env file
  if grep -q "FIREBASE_DATABASE_URL" "$ENV_FILE"; then
    FIREBASE_DATABASE_URL=$(grep "FIREBASE_DATABASE_URL" "$ENV_FILE" | cut -d '=' -f2)
    export FIREBASE_DATABASE_URL
    echo -e "${GREEN}Using Firebase database URL from .env file${NC}"
  else
    echo -e "${RED}FIREBASE_DATABASE_URL not found in .env file${NC}"
    echo -e "${RED}Please add it to your .env file:${NC}"
    echo -e "${YELLOW}FIREBASE_DATABASE_URL=https://your-project-id.firebaseio.com${NC}"
    exit 1
  fi
else
  echo -e "${RED}.env file not found at ${ENV_FILE}${NC}"
  echo -e "${RED}Please create a .env file with required variables${NC}"
  exit 1
fi

echo -e "${YELLOW}Using Firebase credentials at: ${GOOGLE_APPLICATION_CREDENTIALS}${NC}"
echo -e "${YELLOW}Using Firebase database URL: ${FIREBASE_DATABASE_URL}${NC}"

# Check if there are processes running on port 3000
echo -e "${YELLOW}Checking for processes on port 3000...${NC}"
PORT_3000_PID=$(lsof -i:3000 -t)
if [ -n "$PORT_3000_PID" ]; then
  echo -e "${YELLOW}Found process on port 3000. Killing it...${NC}"
  kill -9 $PORT_3000_PID
  echo -e "${GREEN}Process killed.${NC}"
else
  echo -e "${GREEN}No process found on port 3000.${NC}"
fi

# Start the server
echo -e "${BLUE}Starting server on port 3000...${NC}"
npm run dev 