# ChatMimic Connect - Development Rules & Guidelines

This document records specific development rules and guidelines that must be followed when working on the ChatMimic Connect project. These rules ensure code quality, maintainability, and prevent potential issues.

## Database Operations

### 1. Targeted Field Updates

**RULE**: Never make changes to a database field which might remove other fields in the process. Always specify the exact field where changes should happen.

**CORRECT**:
```typescript
// Only update the specific nested field
await updateDoc(doc(db, 'Users', userUID), {
  'workflows.whatsapp_agent.sheetConfigs': sheetConfigs
});
```

**INCORRECT**:
```typescript
// This might overwrite the entire workflows object, removing other fields
await updateDoc(doc(db, 'Users', userUID), {
  workflows: { whatsapp_agent: { sheetConfigs } }
});
```

### 2. Data Structure Consistency

**RULE**: Follow the established data structure patterns consistently.

#### Workflow Structure

All workflows under the `workflows` map share a common structure:
- `executions_used`: Number - Count of executions used
- `limit`: Number - Usage limit
- `reset_date`: Timestamp - Date when limit resets
- `paid`: Boolean - Indicates if paid
- `setup_completed`: Boolean - Indicates if agent setup is completed

In addition to these common fields, each workflow type may have specific fields:

- **WhatsApp Agent Workflow**:
  - `sheetConfigs`: Array - Google Sheets configuration data
  - `lifecycleTagConfigs`: Array - Lifecycle tagging rule configurations

#### Credential Storage

- Store Google Sheets OAuth credentials under `credentials.googleSheetsOAuth`
- Store WhatsApp credentials under `credentials.whatsappCredentials`
- Store Google Analytics credentials under `credentials.googleAuthCredentials`

## Code Quality

### 1. Error Handling

**RULE**: Always include proper error handling and provide meaningful error messages.

```typescript
try {
  // Operation that might fail
} catch (error) {
  console.error('Specific context of what failed:', error);
  // Handle the error appropriately
}
```

### 2. Authentication Checks

**RULE**: Always check for user authentication before performing operations that require it.

```typescript
const userUID = getCurrentUser();
if (!userUID) {
  throw new Error('User not authenticated');
  // or return appropriate error response
}
```

### 3. Data Validation

**RULE**: Validate user inputs and data from external sources before processing.

## Documentation

### 1. Update Documentation with Changes

**RULE**: Always update the project documentation when making significant changes to the codebase.

- Update `db_structure.md` when changing database structures
- Update `project_specs.md` when adding new features or making major changes
- Update `user_flow.md` when changing user interactions or flows
- Update any other relevant documentation

### 2. Code Comments

**RULE**: Provide clear comments for complex logic or important functions.

```typescript
/**
 * Processes incoming WhatsApp messages and updates Google Sheets
 * based on active configurations.
 * 
 * @param phoneNumber The sender's phone number
 * @param messageId The unique message ID
 * @returns Promise<boolean> Success status
 */
```

## Environment Setup

### 1. Environment Variables

**RULE**: Use environment variables for sensitive information and configuration values.

- Store API keys in `.env` file
- Access via `import.meta.env.VARIABLE_NAME` (for Vite projects)
- Never commit `.env` files to the repository

## UI/UX Guidelines

### 1. Responsive Design

**RULE**: Ensure all UI components work correctly on different screen sizes.

### 2. Loading States

**RULE**: Always provide loading indicators for asynchronous operations.

## Version Control

### 1. Commit Messages

**RULE**: Write clear, descriptive commit messages that explain what changes were made and why.

---

This document will be updated as new rules and guidelines are established. 