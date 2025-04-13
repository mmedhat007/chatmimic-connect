// server/index.js
console.log(`[INFO] Starting server in ${process.env.NODE_ENV || 'development'} mode.`);

// Define environment-specific paths
const isProduction = process.env.NODE_ENV === 'production';

// Use pathForEnv from the start
const pathForEnv = require('path'); 

// Path for .env file
const prodEnvPath = pathForEnv.resolve(__dirname, '../../credentials/.env'); 
const devEnvPath = pathForEnv.resolve(__dirname, '.env'); // Assume .env is in server directory for dev
const envPath = isProduction ? prodEnvPath : devEnvPath;

// Path for Firebase credentials
const prodCredentialsPath = pathForEnv.resolve(__dirname, '../../credentials/firebase-credentials.json');
const devCredentialsPath = pathForEnv.resolve(__dirname, 'firebase-credentials.json'); // Assume credentials in server dir for dev
const serviceAccountPath = isProduction ? prodCredentialsPath : devCredentialsPath;

// Explicitly load .env file using dotenv FIRST
console.log(`[INFO] Attempting to load environment variables from: ${envPath}`);
try {
  const dotenvResult = require('dotenv').config({ path: envPath });
  if (dotenvResult.error) {
    // Log dotenv specific error
    console.warn(`[WARN] dotenv could not load .env file from ${envPath}: ${dotenvResult.error.message}`);
  } else if (Object.keys(dotenvResult.parsed || {}).length > 0) {
    console.log(`[INFO] dotenv loaded ${Object.keys(dotenvResult.parsed).length} variables from ${envPath}`);
  } else {
     console.warn(`[WARN] dotenv loaded file ${envPath} but it was empty or contained no variables.`);
  }
} catch (error) {
  // Catch errors during the require('dotenv') itself
  console.error(`[CRITICAL] Failed to require or process dotenv:`, error);
  // In production, a missing .env file is often critical
  if (isProduction) {
      console.error('[CRITICAL] Exiting due to dotenv loading failure in production.');
      process.exit(1);
  }
}

// Now require other modules
console.log('[DEBUG] Requiring path...');
const path = require('path'); 
console.log('[DEBUG] path required.');
console.log('[DEBUG] Requiring express...');
const express = require('express');
console.log('[DEBUG] express required.');
console.log('[DEBUG] Requiring cors...');
const cors = require('cors');
console.log('[DEBUG] cors required.');
console.log('[DEBUG] Requiring helmet...');
const helmet = require('helmet');
console.log('[DEBUG] helmet required.');
console.log('[DEBUG] Requiring firebase-admin...');
const admin = require('firebase-admin');
console.log('[DEBUG] firebase-admin required.');
console.log('[DEBUG] Requiring express-rate-limit...');
const rateLimit = require('express-rate-limit');
console.log('[DEBUG] express-rate-limit required.');

console.log('[DEBUG] index.js: Attempting to require googleOAuth...');
const googleOAuthRoutes = require('./googleOAuth');
console.log('[DEBUG] index.js: googleOAuth required successfully.');

console.log('[DEBUG] index.js: Attempting to require proxyRoutes...');
const proxyRoutes = require('./routes/proxyRoutes');
console.log('[DEBUG] index.js: proxyRoutes required successfully.');

console.log('[DEBUG] index.js: Attempting to require configRoutes...');
const configRoutes = require('./routes/configRoutes');
console.log('[DEBUG] index.js: configRoutes required successfully.');

console.log('[DEBUG] index.js: Attempting to require googleSheetsRoutes...');
const googleSheetsRoutes = require('./routes/googleSheets');
console.log('[DEBUG] index.js: googleSheetsRoutes required successfully.');

console.log('[DEBUG] index.js: Attempting to require aiRoutes...');
const aiRoutes = require('./routes/aiRoutes');
console.log('[DEBUG] index.js: aiRoutes required successfully.');

console.log('[DEBUG] index.js: Attempting to require whatsappRoutes...');
const whatsappRoutes = require('./routes/whatsappRoutes');
console.log('[DEBUG] index.js: whatsappRoutes required successfully.');

console.log('[DEBUG] index.js: Attempting to require logger...');
const logger = require('./utils/logger');
console.log('[DEBUG] index.js: logger required successfully.');

// Validate required environment variables
const requiredEnvVars = [
  'FIREBASE_DATABASE_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'OPENAI_API_KEY',
  'GROQ_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'TOKEN_ENCRYPTION_KEY'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  // Use console.error for critical startup issues
  console.error(`[CRITICAL] Missing required environment variables: ${missingEnvVars.join(', ')}`); 
  logger.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  
  // Exit in production if env vars are missing
  if (process.env.NODE_ENV === 'production') {
    console.error('[CRITICAL] Exiting due to missing environment variables in production.');
    process.exit(1); // Exit explicitly
  }
}

// Initialize Firebase Admin
console.log(`[INFO] Attempting to initialize Firebase Admin using credentials: ${serviceAccountPath}`);
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
  logger.info('Firebase Admin SDK initialized successfully.'); 
} catch (error) {
  console.error('[CRITICAL] Error initializing Firebase Admin SDK:', error);
  logger.error('CRITICAL: Error initializing Firebase Admin SDK. Authentication will likely fail.', {
    error: error.message,
    errorCode: error.code,
    serviceAccountPath: serviceAccountPath // Log the path being used
  });
  
  // Check file existence again using fs
  try {
      const fs = require('fs');
      if (!fs.existsSync(serviceAccountPath)) {
        console.error(`[CRITICAL] Service account key file does not exist at: ${serviceAccountPath}`);
        logger.error(`Service account key file does not exist at: ${serviceAccountPath}`);
      }
  } catch (fsError) {
       console.error('[CRITICAL] Error checking file existence:', fsError);
  }
  
  console.error('[CRITICAL] Exiting due to Firebase initialization error.');
  process.exit(1);
}

// Start Background Message Processor (after Firebase init)
console.log('[INFO] Initializing background message processor...');
try {
    const messageProcessor = require('./services/messageProcessorService');
    messageProcessor.startListening();
    logger.info('Background message processor started successfully.');
} catch (error) {
    console.error('[CRITICAL] Failed to start background message processor:', error);
    logger.error('CRITICAL: Failed to start background message processor.', { error: error.message, stack: error.stack });
    // Optional: Decide if server should exit if listener fails to start.
    // if (isProduction) process.exit(1);
}

const app = express();
// >>> NEW: Trust the first proxy hop (e.g., Nginx) - Moved earlier
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS configuration
const corsOrigins = process.env.CORS_ORIGIN ? 
  process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()) : 
  ['http://localhost:5173', 'https://chat.denoteai.tech'];

app.use(cors({
  origin: corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400 // 24 hours
}));

// Enhanced security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", ...corsOrigins],
      frameSrc: ["'self'"],
      childSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false, // Allow embedding of resources
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // Limit each IP
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true,
  message: {
    status: 'error',
    message: 'Too many requests, please try again later'
  }
});

const embeddingsLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_EMBEDDING_REQUESTS) || 50,
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true,
  message: {
    status: 'error',
    message: 'Too many embedding requests, please try again later'
  }
});

const extractLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_EXTRACT_REQUESTS) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true,
  message: {
    status: 'error',
    message: 'Too many extraction requests, please try again later'
  }
});

// Apply rate limiting to all requests
app.use(apiLimiter);

// Debug middleware to log all incoming requests in development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`[DEBUG] Request received: ${req.method} ${req.originalUrl}`);
    next();
  });
}

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    query: req.query,
    originalUrl: req.originalUrl
  });
  
  // Log response
  const originalSend = res.send;
  res.send = function(data) {
    logger.debug(`Response ${res.statusCode}`, {
      path: req.path,
      method: req.method,
      status: res.statusCode,
      originalUrl: req.originalUrl
    });
    originalSend.call(this, data);
  };
  
  next();
});

// Authentication middleware
app.use(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  
  const idToken = authHeader.split('Bearer ')[1];
  
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    // Just log the error but don't block the request
    // This allows unauthenticated requests to pass through
    // Individual routes will enforce authentication as needed
    logger.error('Error verifying Firebase token:', error);
    next();
  }
});

// Health check endpoint (no auth required)
/**
 * Server health check endpoint
 * GET /api/health
 * 
 * @authentication Not required
 * @response
 *   Success:
 *     {
 *       "status": "success",
 *       "data": {
 *         "version": "1.0.0",
 *         "env": "production"
 *       },
 *       "meta": {
 *         "responseTime": 1 // milliseconds
 *       }
 *     }
 */
app.get('/api/health', (req, res) => {
  const startTime = Date.now();
  const responseTime = Date.now() - startTime;
  
  res.status(200).json({
    status: 'success',
    data: {
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV
    },
    meta: {
      responseTime
    }
  });
});

// For direct health check without /api prefix
/**
 * Server health check endpoint (alternate path)
 * GET /health
 * 
 * @authentication Not required
 * @response
 *   Success:
 *     {
 *       "status": "success",
 *       "data": {
 *         "version": "1.0.0",
 *         "env": "production"
 *       },
 *       "meta": {
 *         "responseTime": 1 // milliseconds
 *       }
 *     }
 */
app.get('/health', (req, res) => {
  const startTime = Date.now();
  const responseTime = Date.now() - startTime;
  
  res.status(200).json({
    status: 'success',
    data: {
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV
    },
    meta: {
      responseTime
    }
  });
});

// API Routes for both direct access and through NGINX
// Support both /api/* path formats and direct /* paths
app.use('/api/google-oauth', googleOAuthRoutes);
app.use('/google-oauth', googleOAuthRoutes);

// Apply specific rate limiters to proxy endpoints
// Important: Order matters! More specific routes first
app.use('/api/proxy/embeddings', embeddingsLimiter);
app.use('/proxy/embeddings', embeddingsLimiter);

app.use('/api/proxy/extract-data', extractLimiter);
app.use('/proxy/extract-data', extractLimiter);

// Mount the proxy routes
app.use('/api/proxy', proxyRoutes);
app.use('/proxy', proxyRoutes);

// Config routes
app.use('/api/config', configRoutes);
app.use('/config', configRoutes);

// Google Sheets routes (Restored)
app.use('/api/google-sheets', googleSheetsRoutes);
app.use('/google-sheets', googleSheetsRoutes);

// AI routes
app.use('/api/ai', aiRoutes);

// WhatsApp routes
app.use('/api/whatsapp', whatsappRoutes);

// Explicitly define a 404 handler for API routes to give better errors
app.use('/api/*', (req, res) => {
  const startTime = Date.now();
  const responseTime = Date.now() - startTime;
  
  logger.warn(`API endpoint not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    status: 'error',
    message: `Endpoint not found: ${req.method} ${req.originalUrl}`,
    meta: {
      responseTime
    }
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  // Serve static files from the React app build directory
  app.use(express.static(path.join(__dirname, '../dist')));
  
  // Handle any requests that don't match the ones above
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  const startTime = Date.now();
  const responseTime = Date.now() - startTime;
  
  logger.error('Unhandled error:', err);
  res.status(500).json({
    status: 'error',
    message: 'An unexpected error occurred',
    details: process.env.NODE_ENV === 'production' ? undefined : {
      error: err.message,
      stack: err.stack
    },
    meta: {
      responseTime
    }
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`[INFO] Server is running on port ${PORT}`);
  logger.info(`Server started on port ${PORT}. CORS origins: ${corsOrigins.join(', ')}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  const messageProcessor = require('./services/messageProcessorService'); // Re-require for shutdown
  messageProcessor.stopListening();
  // Add server close logic here if needed
  logger.info('HTTP server closed');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  const messageProcessor = require('./services/messageProcessorService'); // Re-require for shutdown
  messageProcessor.stopListening();
  // Add server close logic here if needed
  logger.info('HTTP server closed');
  process.exit(0);
});

module.exports = app; 