// server/index.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const admin = require('firebase-admin');
const path = require('path');
const googleOAuthRoutes = require('./googleOAuth');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  // You can specify the database URL if needed
  // databaseURL: process.env.FIREBASE_DATABASE_URL,
});

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://chat.denoteai.tech'
    : 'http://localhost:8080',
  credentials: true
}));

// Security middleware
app.use(helmet());

// Content Security Policy middleware
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', `
    default-src 'self';
    script-src 'self' https://apis.google.com;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' data: https://www.gstatic.com;
    font-src 'self' https://fonts.gstatic.com;
    connect-src 'self' https://api.groq.com https://*.supabase.co https://oauth2.googleapis.com https://sheets.googleapis.com https://www.googleapis.com https://*.firebaseio.com https://*.firebase.googleapis.com;
    frame-src 'self' https://accounts.google.com;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'self';
    upgrade-insecure-requests;
  `.replace(/\s+/g, ' ').trim());
  next();
});

// Middleware to verify Firebase Auth token
const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = { uid: decodedToken.uid };
    next();
  } catch (error) {
    console.error('Error verifying Firebase token:', error);
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// Auth protected routes
app.use('/api/google-oauth', verifyFirebaseToken, googleOAuthRoutes);

// API routes for other services can be added here
// app.use('/api/other-service', verifyFirebaseToken, otherServiceRoutes);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  // Serve static files from the React app build directory
  app.use(express.static(path.join(__dirname, '../dist')));
  
  // Handle any requests that don't match the ones above
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

// Input validation middleware example for a specific route
app.post('/api/example', verifyFirebaseToken, (req, res) => {
  const { name, email } = req.body;
  
  // Validate inputs
  if (!name || typeof name !== 'string' || name.length > 100) {
    return res.status(400).json({ error: 'Invalid name' });
  }
  
  if (!email || typeof email !== 'string' || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  
  // Process the request if validation passes
  res.json({ success: true });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

module.exports = app; 