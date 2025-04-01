/**
 * Enhanced logging utility using Winston
 * Provides different log levels, formatting, and conditional file logging in production
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logDir = process.env.NODE_ENV === 'production' 
  ? '/home/denoteai-api-chat/logs' 
  : path.join(__dirname, '..', 'logs');

if (!fs.existsSync(logDir)) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch (error) {
    console.error(`Failed to create logs directory at ${logDir}: ${error.message}`);
    // Continue execution - don't throw an error that would prevent app startup
  }
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Define console format (more readable for development)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  })
);

// Configure transports based on environment
const transports = [
  new winston.transports.Console({
    format: consoleFormat,
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
  })
];

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
  // Regular log file - contains info and above
  transports.push(
    new winston.transports.File({ 
      filename: path.join(logDir, 'app.log'),
      format: logFormat,
      level: 'info',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
  
  // Error log file - contains only errors
  transports.push(
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'),
      format: logFormat,
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Create logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: 'chatmimic-connect' },
  transports,
  // Handles uncaught exceptions and unhandled rejections
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logDir, 'exceptions.log'),
      format: logFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  ],
  exitOnError: false
});

// Add request logging helper
logger.logRequest = (req, msg = 'API Request') => {
  if (process.env.NODE_ENV === 'production' && req.path === '/api/health') {
    return; // Skip logging health checks in production
  }

  // Create a safe copy of headers without Authorization
  const safeHeaders = { ...req.headers };
  if (safeHeaders.authorization) {
    safeHeaders.authorization = 'Bearer [REDACTED]';
  }

  logger.info(`${msg}: ${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    headers: safeHeaders,
    userId: req.user?.uid || 'unauthenticated'
  });
};

// Add response logging helper
logger.logResponse = (req, res, responseTime, msg = 'API Response') => {
  if (process.env.NODE_ENV === 'production' && req.path === '/api/health') {
    return; // Skip logging health checks in production
  }

  const level = res.statusCode >= 400 ? 'warn' : 'info';
  
  logger[level](`${msg}: ${req.method} ${req.path} ${res.statusCode} ${responseTime}ms`, {
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    responseTime,
    userId: req.user?.uid || 'unauthenticated'
  });
};

// Add error logging helper with sanitization
logger.logError = (err, req = null, msg = 'Server Error') => {
  const errorInfo = {
    message: err.message,
    stack: err.stack,
    code: err.code,
  };

  // Add request details if available, but sanitize sensitive information
  if (req) {
    errorInfo.method = req.method;
    errorInfo.path = req.path;
    errorInfo.userId = req.user?.uid || 'unauthenticated';
    
    // Don't log potentially sensitive request body data in errors
    // Just log that there was a body, or include safe fields if needed
    if (Object.keys(req.body || {}).length > 0) {
      errorInfo.hasRequestBody = true;
    }
  }

  logger.error(`${msg}`, errorInfo);
};

module.exports = logger; 