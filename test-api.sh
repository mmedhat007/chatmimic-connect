#!/bin/bash

# Set colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuration
API_URL="http://localhost:3000"
TEST_TOKEN="test-token"

# Ensure temp directory exists
mkdir -p tmp

# Display a formatted header for each test
function print_header() {
  echo -e "${BOLD}==== $1 ====${NC}"
}

# Test an endpoint with the specified HTTP method, printing the results
function test_endpoint() {
  local method=$1
  local endpoint=$2
  local description=$3
  local data=$4
  local auth=$5
  
  echo -e "${YELLOW}Testing ${method} ${endpoint}${NC} - ${description}"
  
  # Add authorization header if specified
  AUTH_HEADER=""
  if [ "$auth" = true ]; then
    AUTH_HEADER="-H \"Authorization: Bearer ${TEST_TOKEN}\""
  fi
  
  # Build the curl command
  curl_cmd="curl -s -X ${method}"
  
  # Add data if provided (for POST/PUT)
  if [ ! -z "$data" ]; then
    curl_cmd="${curl_cmd} -H \"Content-Type: application/json\" -d '${data}'"
  fi
  
  # Add authorization and complete the command
  cmd="${curl_cmd} ${AUTH_HEADER} ${API_URL}${endpoint}"
  
  # Print the actual command being executed (for debugging)
  echo -e "${BLUE}Command: ${cmd}${NC}"
  
  # Save output to a temporary file to parse
  eval ${cmd} > tmp/api_response.json
  
  # Check if response is valid JSON
  if jq empty tmp/api_response.json 2>/dev/null; then
    # Get status from response
    status=$(jq -r '.status // "not_found"' tmp/api_response.json)
    
    if [ "$status" = "success" ] || [ "$status" = "ok" ]; then
      echo -e "${GREEN}✓ SUCCESS${NC} - ${endpoint}"
      echo -e "Response: $(cat tmp/api_response.json | jq -c '.')"
    else
      echo -e "${RED}✗ FAILED${NC} - ${endpoint}"
      echo -e "Error: $(cat tmp/api_response.json | jq -c '.')"
    fi
  else
    echo -e "${RED}✗ FAILED${NC} - ${endpoint} - Invalid JSON response"
    echo -e "Raw Response: $(cat tmp/api_response.json)"
  fi
  
  echo ""
}

# Main test runner
print_header "API Tests"

# Test basic health endpoints
test_endpoint "GET" "/health" "Direct health endpoint" "" false
test_endpoint "GET" "/api/health" "API health endpoint" "" false

# Test embeddings endpoint
test_endpoint "POST" "/api/proxy/embeddings" "Test embeddings" '{"text":"Hello world","model":"text-embedding-3-small"}' true

# Test Google Sheets status
test_endpoint "GET" "/api/google-sheets/status" "Google Sheets status" "" true

# Test Google Sheets disconnect
test_endpoint "POST" "/api/google-sheets/disconnect" "Google Sheets disconnect" "" true

echo -e "${BOLD}All tests completed${NC}" 