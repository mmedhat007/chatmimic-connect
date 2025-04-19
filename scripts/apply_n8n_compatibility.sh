#!/bin/bash

# Apply N8N compatibility SQL to Supabase
# This script applies the necessary changes to make our Supabase database compatible with n8n

echo "Applying n8n compatibility changes to Supabase..."

# Check if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables must be set"
  echo "Please run: export SUPABASE_URL=<your-supabase-url> SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>"
  exit 1
fi

# First, check if the exec_sql RPC function exists
echo "Checking if exec_sql RPC function exists..."
EXEC_SQL_CHECK=$(curl -s -X GET \
  "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}")

if [[ $EXEC_SQL_CHECK == *"doesNotExist"* ]]; then
  echo "⚠️ The exec_sql RPC function doesn't exist in your Supabase instance."
  echo "You'll need to manually run the SQL script using the Supabase dashboard SQL editor."
  echo "Please navigate to the Supabase dashboard, go to the SQL Editor, and run the contents of sql/n8n_compatibility.sql"
  exit 1
fi

# Execute the SQL file against Supabase using their REST API
echo "Applying n8n_compatibility.sql..."
RESPONSE=$(curl -s -X POST \
  "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d @- << EOF
{
  "query": "$(cat sql/n8n_compatibility.sql | tr -d '\n' | sed 's/"/\\"/g')"
}
EOF
)

# Check if the response contains an error
if [[ $RESPONSE == *"error"* ]]; then
  echo "❌ Failed to apply n8n compatibility changes to Supabase"
  echo "Error: $RESPONSE"
  echo ""
  echo "Alternative installation method:"
  echo "1. Go to Supabase dashboard (https://app.supabase.com)"
  echo "2. Navigate to the SQL Editor"
  echo "3. Copy the contents of sql/n8n_compatibility.sql"
  echo "4. Run the SQL script manually"
  exit 1
fi

# Success message
echo "✅ Successfully applied n8n compatibility changes to Supabase"
echo "The database is now compatible with n8n while maintaining app functionality"
echo ""
echo "You can connect n8n to Supabase using:"
echo "- Host: ${SUPABASE_URL} (remove https:// and path)"
echo "- Database: postgres"
echo "- Username: (use service role key username)"
echo "- Password: (use service role key password)"
echo ""
echo "For more information, see project_documentation/n8n_db_compatibility.md" 