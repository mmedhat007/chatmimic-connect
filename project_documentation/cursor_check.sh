#!/bin/bash

# Cursor Documentation Check Script
# This script verifies that all required documentation files exist
# and alerts if any are missing.

echo "=== Cursor Memory Bank Verification ==="
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

# Check for required directories
MISSING_DIRS=0
for dir in "${REQUIRED_DIRS[@]}"; do
  if [ ! -d "$dir" ]; then
    echo "❌ Missing required directory: $dir"
    MISSING_DIRS=$((MISSING_DIRS + 1))
  else
    echo "✅ Directory exists: $dir"
  fi
done

# Check for required core files
REQUIRED_FILES=(
  "README.md"
  "development_rules.md"
  "migration_guide.md"
  "frontend_structure.md"
  "backend_db_structure.md"
)

MISSING_FILES=0
for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "❌ Missing required file: $file"
    MISSING_FILES=$((MISSING_FILES + 1))
  else
    echo "✅ File exists: $file"
  fi
done

# Check for key directory files
DIR_FILES=(
  "1-overview/project_overview.md"
  "2-architecture/technical_architecture.md"
  "3-api/api_reference.md"
  "4-security/security_guidelines.md"
  "5-integrations/google_sheets_integration.md"
  "6-deployment/production_setup.md"
  "7-troubleshooting/common_issues.md"
)

MISSING_DIR_FILES=0
for file_path in "${DIR_FILES[@]}"; do
  if [ ! -f "$file_path" ]; then
    echo "❌ Missing required file: $file_path"
    MISSING_DIR_FILES=$((MISSING_DIR_FILES + 1))
  else
    echo "✅ File exists: $file_path"
  fi
done

# Check for .cursor/rules
if [ ! -f "../.cursor/rules" ]; then
  echo "❌ Missing project intelligence file: ../.cursor/rules"
  MISSING_FILES=$((MISSING_FILES + 1))
else
  echo "✅ Project intelligence file exists: ../.cursor/rules"
fi

# Summary
echo ""
echo "=== Memory Bank Status ==="
if [ $MISSING_DIRS -eq 0 ] && [ $MISSING_FILES -eq 0 ] && [ $MISSING_DIR_FILES -eq 0 ]; then
  echo "✅ ALL REQUIRED DOCUMENTATION FILES EXIST"
  echo "Memory Bank is complete and ready for use."
else
  echo "❌ DOCUMENTATION INCOMPLETE"
  echo "Missing directories: $MISSING_DIRS"
  echo "Missing core files: $MISSING_FILES"
  echo "Missing directory files: $MISSING_DIR_FILES"
  echo "Please create the missing files to complete the Memory Bank."
fi

echo ""
echo "Remember: Cursor's effectiveness depends entirely on the Memory Bank's accuracy."
echo "Keep all documentation updated with every code change." 