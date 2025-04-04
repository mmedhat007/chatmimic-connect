#!/bin/bash

# Cursor Memory Bank Initialization Script
# This script ensures all required files for Cursor's Memory Bank exist
# or creates placeholder templates if they don't.

echo "=== Cursor Memory Bank Initialization ==="
echo "Checking for required documentation files..."

# Root directory
DOC_DIR="$(dirname "$0")"
cd "$DOC_DIR" || exit 1

# Define required directories
REQUIRED_DIRS=(
  "1-overview"
  "2-architecture"
  "3-api"
  "4-security"
  "5-integrations"
  "6-deployment"
  "7-troubleshooting"
)

# Create directories if they don't exist
for dir in "${REQUIRED_DIRS[@]}"; do
  if [ ! -d "$dir" ]; then
    mkdir -p "$dir"
    echo "Created directory: $dir"
  else
    echo "Directory already exists: $dir"
  fi
done

# Function to create a file if it doesn't exist
create_file() {
  local file_path=$1
  local content=$2
  
  if [ ! -f "$file_path" ]; then
    echo -e "$content" > "$file_path"
    echo "Created file: $file_path"
  else
    echo "File already exists: $file_path"
  fi
}

# Create core files if they don't exist
create_file "README.md" "# ChatMimic Connect Documentation\n\nThis documentation provides comprehensive information about the ChatMimic Connect platform."
create_file "development_rules.md" "# Development Rules\n\nThis document outlines the coding standards and development practices for the ChatMimic Connect project."
create_file "migration_guide.md" "# Migration Guide\n\nThis document provides instructions for database migrations and version upgrades."
create_file "frontend_structure.md" "# Frontend Structure\n\nThis document describes the frontend architecture and component structure."
create_file "backend_db_structure.md" "# Backend Database Structure\n\nThis document details the database schema and relationships."

# Create directory files if they don't exist
create_file "1-overview/project_overview.md" "# Project Overview\n\nThis document provides a high-level description of the ChatMimic Connect project, its core requirements, scope, and goals."
create_file "2-architecture/technical_architecture.md" "# Technical Architecture\n\nThis document details the system architecture, including component diagrams and technical relationships."
create_file "3-api/api_reference.md" "# API Reference\n\nThis document provides comprehensive documentation of the API endpoints, request/response formats, and integration guidelines."
create_file "4-security/security_guidelines.md" "# Security Guidelines\n\nThis document outlines security policies, configurations, and best practices."
create_file "5-integrations/google_sheets_integration.md" "# Google Sheets Integration\n\nThis document describes the Google Sheets integration, including setup, usage, and troubleshooting."
create_file "6-deployment/production_setup.md" "# Production Setup\n\nThis document contains deployment procedures, environment configurations, and hosting information."
create_file "7-troubleshooting/common_issues.md" "# Common Issues\n\nThis document lists known issues, error messages, and their resolutions."

# Check for .cursor/rules
if [ ! -f "../.cursor/rules" ]; then
  mkdir -p "../.cursor"
  echo -e "# Project Intelligence\n\nThis file serves as Cursor's learning journal, capturing key insights and project-specific intelligence." > "../.cursor/rules"
  echo "Created project intelligence file: ../.cursor/rules"
else
  echo "Project intelligence file already exists: ../.cursor/rules"
fi

echo ""
echo "=== Memory Bank Initialization Complete ==="
echo "Run ./cursor_check.sh to verify the Memory Bank structure."
echo ""
echo "Remember: Keep all documentation updated with every code change." 