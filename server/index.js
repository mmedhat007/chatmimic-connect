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
const logger = require('./utils/logger');

// Initialize Firebase Admin
try {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
  console.log('Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error);
  // Don't crash the server, allow it to start even if Firebase fails
  // This allows you to debug other aspects of the server
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));  // Increased payload limit for embeddings
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://chat.denoteai.tech'
    : 'http://localhost:8080',
  credentials: true
}));

// Security middleware
app.use(helmet());

// Content Security Policy middleware - without using express-csp-header
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' https://apis.google.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "img-src 'self' data: https://www.gstatic.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "connect-src 'self' https://api.groq.com https://api.openai.com https://*.supabase.co https://oauth2.googleapis.com https://sheets.googleapis.com https://www.googleapis.com https://*.firebaseio.com https://*.firebase.googleapis.com; " +
    "frame-src 'self' https://accounts.google.com; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'; " +
    "frame-ancestors 'self'; " +
    "upgrade-insecure-requests"
  );
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  
  // Log when request starts
  logger.info(`${req.method} ${req.originalUrl}`, { 
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info(`${req.method} ${req.originalUrl} completed`, {
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
  });
  
  next();
});

// Middleware to verify Firebase Auth token
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
    logger.error('Error verifying Firebase token:', error);
    res.status(403).json({ error: 'Unauthorized' });
  }
});

// API Routes
app.use('/api/google-oauth', googleOAuthRoutes);
app.use('/api/proxy', proxyRoutes);
app.use('/api/config', configRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Server is running',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV
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
  logger.error('Unhandled error:', err);
  res.status(500).json({
    status: 'error',
    message: 'An unexpected error occurred',
    error: process.env.NODE_ENV === 'production' ? undefined : err.message
  });
});

// Start the server
app.listen(PORT, () => {
  logger.log(`Server running on port ${PORT}`);
});

// Global error handler
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection:', error);
});

module.exports = app; 