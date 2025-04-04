# Secure Handling of Firebase Credentials

This document outlines the proper handling of Firebase service account credentials in the ChatMimic Connect application.

## Overview

Firebase service account credentials are sensitive and must be handled with care. They provide administrative access to your Firebase project and should never be committed to version control or shared publicly.

## Setting Up Credentials

### 1. Obtaining Firebase Service Account Credentials

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to Project Settings > Service Accounts
4. Click "Generate New Private Key"
5. Save the downloaded JSON file securely

### 2. Adding Credentials to Your Development Environment

The application needs a Firebase service account credentials file to authenticate with Firebase. Place this file in the `server` directory:

```
server/firebase-credentials.json
```

**Important**: This file is automatically added to `.gitignore` to prevent accidental commits. Never commit this file to version control.

### 3. Required Environment Variables

The application uses environment variables to locate and use these credentials:

- `GOOGLE_APPLICATION_CREDENTIALS`: Set automatically by the scripts to the path of your credentials file
- `FIREBASE_DATABASE_URL`: Should be set in your `.env` file to your Firebase Realtime Database URL

Example `.env` entry:
```
FIREBASE_DATABASE_URL=https://your-project-id.firebaseio.com
```

Alternatively, if you have `VITE_FIREBASE_PROJECT_ID` defined, the scripts can automatically construct the database URL.

## Authentication Requirements

All API endpoints require proper Firebase authentication:

- Every request must include a valid Firebase ID token
- There are no development shortcuts or test tokens
- The same authentication standards apply in all environments
- For development testing, create test users in the Firebase Authentication console

## Security Best Practices

1. **Keep credentials out of version control**:
   - Never commit `firebase-credentials.json` to Git
   - Check that the file is in your `.gitignore`

2. **Limit permissions**:
   - Use the principle of least privilege when creating service accounts
   - Create separate service accounts for development and production with appropriate permissions

3. **Rotate credentials regularly**:
   - Generate new credentials periodically
   - Immediately rotate credentials if they're ever compromised

4. **Environment separation**:
   - Use different credentials for development and production environments
   - Never use production credentials in development environments

## Credential Handling in Scripts

The application's scripts (`start-dev.sh` and `server/start-dev.sh`) handle Firebase credentials as follows:

1. They locate the credentials file at `server/firebase-credentials.json`
2. They set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to point to this file
3. They read the `FIREBASE_DATABASE_URL` from the `.env` file
4. They exit with an error if the required environment variables or files are missing

## Troubleshooting

If you encounter Firebase authentication issues:

1. Verify that `server/firebase-credentials.json` exists and contains valid credentials
2. Ensure your `.env` file contains the correct `FIREBASE_DATABASE_URL`
3. Check that the Firebase service account has the necessary permissions
4. Verify that Firebase Realtime Database is enabled in your Firebase project
5. Check the server logs for specific authentication errors

## Common Errors

- **"Firebase Admin SDK not initialized - no credentials found"**:
  Make sure the credentials file exists at `server/firebase-credentials.json`

- **"Firebase database URL not provided in environment variables"**:
  Add `FIREBASE_DATABASE_URL` to your `.env` file

- **"Error initializing Firebase Admin SDK: Error: Failed to parse private key"**:
  Ensure your credentials file is valid and not corrupted 