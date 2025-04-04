#!/bin/bash

# Set colors for output
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Print banner
echo -e "${CYAN}=================================${NC}"
echo -e "${CYAN}Starting ChatMimic Connect Dev${NC}"
echo -e "${CYAN}=================================${NC}"

# Set Firebase credentials path to the server credentials file
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export GOOGLE_APPLICATION_CREDENTIALS="${PROJECT_ROOT}/server/firebase-credentials.json"

# Load environment variables from .env file if it exists
ENV_FILE="${PROJECT_ROOT}/.env"
if [ -f "$ENV_FILE" ]; then
  echo -e "${GREEN}Loading environment variables from ${ENV_FILE}${NC}"
  
  # Load Firebase database URL from .env file
  if grep -q "FIREBASE_DATABASE_URL" "$ENV_FILE"; then
    FIREBASE_DATABASE_URL=$(grep "^FIREBASE_DATABASE_URL" "$ENV_FILE" | cut -d '=' -f2)
    export FIREBASE_DATABASE_URL
    echo -e "${GREEN}Using Firebase database URL from .env file${NC}"
  elif grep -q "VITE_FIREBASE_PROJECT_ID" "$ENV_FILE"; then
    # Extract project ID from VITE variable and construct the URL
    FIREBASE_PROJECT_ID=$(grep "^VITE_FIREBASE_PROJECT_ID" "$ENV_FILE" | cut -d '=' -f2)
    export FIREBASE_DATABASE_URL="https://${FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com"
    echo -e "${YELLOW}Constructed Firebase database URL from project ID: ${FIREBASE_DATABASE_URL}${NC}"
  else
    echo -e "${RED}Neither FIREBASE_DATABASE_URL nor VITE_FIREBASE_PROJECT_ID found in .env file${NC}"
    echo -e "${RED}Please add one of them to your .env file:${NC}"
    echo -e "${YELLOW}FIREBASE_DATABASE_URL=https://your-project-id.firebaseio.com${NC}"
    echo -e "${YELLOW}or${NC}"
    echo -e "${YELLOW}VITE_FIREBASE_PROJECT_ID=your-project-id${NC}"
    exit 1
  fi
else
  echo -e "${RED}.env file not found at ${ENV_FILE}${NC}"
  echo -e "${RED}Please create a .env file with required variables${NC}"
  exit 1
fi

echo -e "${YELLOW}Using Firebase credentials at: ${GOOGLE_APPLICATION_CREDENTIALS}${NC}"
echo -e "${YELLOW}Using Firebase database URL: ${FIREBASE_DATABASE_URL}${NC}"

# Set production mode for real authentication
export PRODUCTION_MODE=true
echo -e "${YELLOW}Production mode is enabled: Using real Firebase authentication and Google OAuth${NC}"
echo -e "${YELLOW}All API requests require a valid Firebase token${NC}"
echo -e "${YELLOW}There are no development shortcuts or mock authentication${NC}"

# Check if there are already processes running on the required ports
echo -e "${YELLOW}Checking for existing processes on ports 3000 and 8080...${NC}"

# Check for process on port 3000 (backend)
PORT_3000_PID=$(lsof -i:3000 -t)
if [ -n "$PORT_3000_PID" ]; then
  echo -e "${YELLOW}Found process ${PORT_3000_PID} running on port 3000. Killing it...${NC}"
  kill -9 $PORT_3000_PID
  echo -e "${GREEN}Process killed.${NC}"
else
  echo -e "${GREEN}No process found on port 3000.${NC}"
fi

# Check for process on port 8080 (frontend)
PORT_8080_PID=$(lsof -i:8080 -t)
if [ -n "$PORT_8080_PID" ]; then
  echo -e "${YELLOW}Found process ${PORT_8080_PID} running on port 8080. Killing it...${NC}"
  kill -9 $PORT_8080_PID
  echo -e "${GREEN}Process killed.${NC}"
else
  echo -e "${GREEN}No process found on port 8080.${NC}"
fi

# Store the project root directory
PROJECT_ROOT="$(pwd)"

# Start backend server in the background
echo -e "${YELLOW}Starting backend server on port 3000...${NC}"
cd server && ./start-dev.sh &
BACKEND_PID=$!
echo -e "${GREEN}Backend server started with PID ${BACKEND_PID}${NC}"

# Give the backend server a moment to start
echo -e "${YELLOW}Waiting for backend server to initialize...${NC}"
sleep 3

# Test if the backend server is responding
echo -e "${YELLOW}Testing backend server connection...${NC}"
curl -s http://localhost:3000/api/health > /dev/null
if [ $? -eq 0 ]; then
  echo -e "${GREEN}Backend server is running correctly on port 3000.${NC}"
else
  echo -e "${RED}Backend server is not responding. Please check for errors.${NC}"
  echo -e "${YELLOW}Starting frontend server anyway...${NC}"
fi

# Start frontend server in the background
echo -e "${YELLOW}Starting frontend server on port 8080...${NC}"
cd "${PROJECT_ROOT}" && npm run dev &
FRONTEND_PID=$!
echo -e "${GREEN}Frontend server started with PID ${FRONTEND_PID}${NC}"

# Final message
echo -e "${CYAN}=================================${NC}"
echo -e "${CYAN}Development servers are running:${NC}"
echo -e "${GREEN}Backend: http://localhost:3000${NC}"
echo -e "${GREEN}Frontend: http://localhost:8080${NC}"
echo -e "${CYAN}=================================${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop both servers${NC}"

# Wait for Ctrl+C
wait 