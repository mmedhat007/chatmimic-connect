// server/index.js
require('dotenv').config({ path: '/home/denoteai-api-chat/credentials/.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const admin = require('firebase-admin');
const path = require('path');
const googleOAuthRoutes = require('./googleOAuth');
const proxyRoutes = require('./routes/proxyRoutes');
const configRoutes = require('./routes/configRoutes');
const googleSheetsRoutes = require('./routes/googleSheets');
const logger = require('./utils/logger');

// Initialize Firebase Admin
try {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
  logger.info('Firebase Admin SDK initialized successfully');
  console.log('Firebase Admin SDK initialized successfully');
} catch (error) {
  logger.error('Error initializing Firebase Admin SDK:', error);
  console.error('Error initializing Firebase Admin SDK:', error);
  // Don't crash the server, allow it to start even if Firebase fails
  // This allows you to debug other aspects of the server
}

const app = express();
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

// Logging middleware
app.use((req, res, next) => {
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
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Server is running',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV
  });
});

// For direct health check without /api prefix
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Server is running',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV
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