// server/index.js
// Force NODE_ENV to be 'development' for testing
process.env.NODE_ENV = 'development';
console.log('Explicitly setting NODE_ENV to:', process.env.NODE_ENV);

// Load environment variables based on environment
if (process.env.NODE_ENV === 'development') {
  console.log('Loading development environment variables from .env file...');
  try {
    // Get absolute path to the .env file to handle spaces in paths
    const path = require('path');
    const envPath = path.resolve(__dirname, '../.env');
    console.log(`Looking for .env file at: ${envPath}`);
    
    const result = require('dotenv').config({ path: envPath });
    if (result.error) {
      console.error('Error loading .env file:', result.error);
    } else {
      console.log('Successfully loaded environment variables from .env file');
      // Print some vars for debugging
      console.log('GOOGLE_CLIENT_ID present:', !!process.env.GOOGLE_CLIENT_ID);
      console.log('GOOGLE_CLIENT_SECRET present:', !!process.env.GOOGLE_CLIENT_SECRET);
    }
  } catch (error) {
    console.error('Error loading environment variables:', error);
  }
} else {
  require('dotenv').config({ path: '/home/denoteai-api-chat/credentials/.env' });
}

// Log the environment mode for debugging
console.log(`Starting server in ${process.env.NODE_ENV || 'development'} mode...`);
console.log('Using production behavior for authentication and data access');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const googleOAuthRoutes = require('./googleOAuth');
const proxyRoutes = require('./routes/proxyRoutes');
const configRoutes = require('./routes/configRoutes');
const googleSheetsRoutes = require('./routes/googleSheets');
const logger = require('./utils/logger');

// Initialize Firebase Admin
let firebaseInitialized = false;
try {
  // Get Firebase credentials - try multiple methods to ensure initialization
  
  // Method 1: Use env variable GOOGLE_APPLICATION_CREDENTIALS (standard approach)
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    console.log(`Using Firebase credentials from environment: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
    
    // Always use environment variable for database URL, never hardcode
    const databaseURL = process.env.FIREBASE_DATABASE_URL || "https://denoteai-default-rtdb.firebaseio.com";
    if (!databaseURL) {
      logger.error('Firebase database URL not provided in environment variables');
      console.error('Missing environment variable: FIREBASE_DATABASE_URL');
      process.exit(1);
    }
    
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      databaseURL: databaseURL
    });
    firebaseInitialized = true;
    logger.info('Firebase Admin SDK initialized successfully with application default credentials');
    console.log('Firebase Admin SDK initialized successfully with application default credentials');
  } 
  // Method 2: Look for credentials file in the server directory
  else {
    const credentialsPath = path.join(__dirname, 'firebase-credentials.json');
    if (fs.existsSync(credentialsPath)) {
      console.log(`Using local Firebase credentials file: ${credentialsPath}`);
      
      // Always use environment variable for database URL, never hardcode
      const databaseURL = process.env.FIREBASE_DATABASE_URL || "https://denoteai-default-rtdb.firebaseio.com";
      if (!databaseURL) {
        logger.error('Firebase database URL not provided in environment variables');
        console.error('Missing environment variable: FIREBASE_DATABASE_URL');
        process.exit(1);
      }
      
      const serviceAccount = require(credentialsPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: databaseURL
      });
      firebaseInitialized = true;
      logger.info('Firebase Admin SDK initialized successfully with local credentials');
      console.log('Firebase Admin SDK initialized successfully with local credentials');
    } 
    // If we still can't find credentials, exit
    else {
      logger.error('Firebase Admin SDK not initialized - no credentials found');
      console.error('Firebase Admin SDK not initialized - no credentials found');
      console.error('Please ensure one of the following:');
      console.error('1. Set GOOGLE_APPLICATION_CREDENTIALS environment variable to a valid service account file');
      console.error('2. Place a firebase-credentials.json file in the server directory');
      process.exit(1);
    }
  }
} catch (error) {
  logger.error('Error initializing Firebase Admin SDK:', error);
  console.error('Error initializing Firebase Admin SDK:', error);
  console.error(error.stack);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS configuration
const corsOrigins = process.env.CORS_ORIGIN ? 
  process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()) : 
  ['http://localhost:8080', 'http://localhost:5173', 'http://localhost:3000', 'https://chat.denoteai.tech'];

// Ensure development origins are included when in development mode
if (process.env.NODE_ENV === 'development') {
  // Add all possible localhost origins with different ports
  const localOrigins = ['http://localhost:8080', 'http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:8080', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000'];
  
  localOrigins.forEach(origin => {
    if (!corsOrigins.includes(origin)) {
      corsOrigins.push(origin);
    }
  });
  
  logger.info('CORS configured for development', { origins: corsOrigins });
}

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl requests)
    if (!origin) return callback(null, true);
    
    // Allow if origin is in whitelist
    if (corsOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    
    // In development, be more permissive with CORS
    if (process.env.NODE_ENV === 'development') {
      // Allow any localhost or 127.0.0.1 origin in development
      if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        logger.info(`Allowing development origin: ${origin}`);
        return callback(null, true);
      }
      
      logger.warn(`Origin not in whitelist but allowing in development mode: ${origin}`);
      return callback(null, true);
    }
    
    logger.warn(`Origin blocked by CORS policy: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Service', 'Origin'],
  credentials: true,
  maxAge: 86400 // 24 hours
}));

// Enhanced security headers - adjusted to work with API requests
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for API server
  crossOriginEmbedderPolicy: false, // Allow embedding of resources
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Add specific OPTIONS handler for Google OAuth routes to handle CORS preflight requests
app.options('/api/google-oauth/*', (req, res) => {
  logger.debug('Handling OPTIONS preflight for Google OAuth route', {
    path: req.path,
    origin: req.headers.origin,
  });
  
  // Send CORS headers for preflight requests
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Service, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  res.status(204).end();
});

// Also add OPTIONS handler for /google-oauth/* routes (without /api prefix)
app.options('/google-oauth/*', (req, res) => {
  logger.debug('Handling OPTIONS preflight for Google OAuth route (non-api prefix)', {
    path: req.path,
    origin: req.headers.origin,
  });
  
  // Send CORS headers for preflight requests
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Service, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  res.status(204).end();
});

// Import handleTokenRefresh from auth middleware
const { handleTokenRefresh } = require('./middleware/auth');

// Add token refresh endpoint (must be before auth middleware)
app.post('/api/refresh-token', handleTokenRefresh);
app.post('/refresh-token', handleTokenRefresh);

// Logging middleware
app.use((req, res, next) => {
  // Skip logging for health check in production
  if (process.env.NODE_ENV === 'production' && (req.path === '/health' || req.path === '/api/health')) {
    return next();
  }
  
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    query: req.query
  });
  
  // Log response
  const originalSend = res.send;
  res.send = function(data) {
    logger.debug(`Response ${res.statusCode}`, {
      path: req.path,
      method: req.method,
      status: res.statusCode
    });
    originalSend.call(this, data);
  };
  
  next();
});

// Authentication middleware
app.use(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  // Log for debugging
  console.log(`Index.js auth middleware processing: ${req.path}`);
  console.log(`Auth header present: ${!!authHeader}`);
  if (authHeader) {
    console.log(`Auth header: ${authHeader}`);
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      console.log(`Token: ${token}`);
      console.log(`Is test-token-dev: ${token === 'test-token-dev'}`);
      console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
      console.log(`Development mode check: ${process.env.NODE_ENV === 'development'}`);
    }
  }
  
  // Skip authentication for health check endpoints and preflight requests
  if (req.path === '/api/health' || req.path === '/health' || req.method === 'OPTIONS') {
    return next();
  }
  
  // Special handling for development mode test tokens
  if (process.env.NODE_ENV === 'development' && authHeader && 
      authHeader.startsWith('Bearer ') && authHeader.split('Bearer ')[1] === 'test-token-dev') {
    console.log('Using development test token for authentication');
    req.user = {
      uid: 'test-user-development',
      email: 'test@example.com',
      name: 'Test User',
      role: 'user'
    };
    return next();
  }
  
  // Only use real Firebase authentication
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // Try Firebase verification
    if (firebaseInitialized) {
      try {
        const idToken = authHeader.split('Bearer ')[1];
        
        // Add token debugging info (safely - without exposing the full token)
        const tokenStart = idToken.substring(0, 10);
        const tokenEnd = idToken.substring(idToken.length - 5);
        console.log(`Attempting to verify token: ${tokenStart}...${tokenEnd} (${idToken.length} chars)`);
        console.log(`Firebase initialized: ${firebaseInitialized}`);
        
        // Log Firebase admin status
        console.log(`Firebase Admin apps count: ${admin.apps.length}`);
        console.log(`Firebase Admin initialized: ${!!admin.apps[0]}`);
        console.log(`Firebase database URL: ${process.env.FIREBASE_DATABASE_URL || 'not set'}`);
        
        // Try to verify the token
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.user = decodedToken;
        logger.debug('User authenticated with Firebase token', { 
          uid: decodedToken.uid,
          path: req.path 
        });
        console.log(`User authenticated: ${decodedToken.uid}`);
        return next();
      } catch (error) {
        logger.warn('Firebase token verification failed', { 
          error: error.message,
          path: req.path
        });
        console.warn(`Firebase token verification failed: ${error.message}`);
        
        // Check for specific error types to provide more helpful error messages
        let errorDetails = 'Invalid token';
        if (error.code === 'auth/id-token-expired') {
          errorDetails = 'Your authentication token has expired. Please refresh the page to get a new token.';
        } else if (error.code === 'auth/id-token-revoked') {
          errorDetails = 'Your authentication token has been revoked. Please log in again.';
        } else if (error.code === 'auth/argument-error') {
          errorDetails = 'Invalid token format. Please log in again.';
        } else if (error.code === 'auth/invalid-credential') {
          errorDetails = 'Invalid authentication credentials. Please log in again.';
        }
        
        // Return 401 Unauthorized for authentication failures
        return res.status(401).json({
          status: 'error',
          message: 'Authentication failed',
          details: process.env.NODE_ENV === 'development' ? `${error.message} (${error.code})` : errorDetails
        });
      }
    } else {
      logger.error('Firebase not initialized but token provided');
      return res.status(500).json({
        status: 'error',
        message: 'Authentication service unavailable'
      });
    }
  }
  
  // If no token provided, return 401 Unauthorized
  return res.status(401).json({
    status: 'error',
    message: 'Authentication required',
    details: 'No valid authorization token provided'
  });
});

// Health check endpoint (no auth required)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Server is running',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    port: PORT
  });
});

// For direct health check without /api prefix
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Server is running',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    port: PORT
  });
});

// API Routes for both direct access and through NGINX
// Support both /api/* path formats and direct /* paths
app.use('/api/google-oauth', googleOAuthRoutes);
app.use('/google-oauth', googleOAuthRoutes);

app.use('/api/proxy', proxyRoutes);
app.use('/proxy', proxyRoutes);

app.use('/api/config', configRoutes);
app.use('/config', configRoutes);

// New Google Sheets routes
app.use('/api/google-sheets', googleSheetsRoutes);
app.use('/google-sheets', googleSheetsRoutes);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  // Serve static files from the React app build directory
  app.use(express.static(path.join(__dirname, '../dist')));
  
  // Handle any requests that don't match the ones above
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
} else {
  // For development mode, handle direct page requests from SPA routes
  // This ensures that refreshing pages like /google-sheets works
  app.get('*', (req, res, next) => {
    // Only handle requests that look like frontend routes (no file extensions, not API routes)
    const isApiRoute = req.path.startsWith('/api/') || req.path.startsWith('/proxy/') || 
                      req.path.startsWith('/google-oauth/') || req.path.startsWith('/google-sheets/') ||
                      req.path.startsWith('/config/');
    const hasFileExtension = req.path.includes('.');
    
    if (!isApiRoute && !hasFileExtension && req.path !== '/') {
      logger.info(`Handling SPA route in development: ${req.path}`);
      
      // Return a simple HTML that redirects to the frontend
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Redirecting...</title>
            <script>
              // Store the current path to restore after redirect
              localStorage.setItem('lastRoute', '${req.path}');
              // Redirect to the frontend development server
              window.location.href = 'http://localhost:8080';
            </script>
          </head>
          <body>
            <p>Redirecting to frontend...</p>
          </body>
        </html>
      `);
    } else {
      next();
    }
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    status: 'error',
    message: 'An unexpected error occurred',
    error: process.env.NODE_ENV === 'production' ? undefined : err.message
  });
});

// Start the server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  console.log(`Server running on port ${PORT}`);
});

// Global error handler
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection:', error);
});

module.exports = app; 