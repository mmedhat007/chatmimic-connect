# Production Guidelines

## Console Statements

Console statements have been removed from the production build for security and performance reasons. This is implemented in two ways:

### 1. Frontend (Vite)

The frontend application uses `vite-plugin-remove-console` to automatically strip console statements during production builds:

```js
// vite.config.ts
import removeConsole from "vite-plugin-remove-console";

export default defineConfig(({ mode }) => ({
  plugins: [
    // ...
    mode === 'production' && removeConsole(),
  ].filter(Boolean),
  // ...
}));
```

### 2. Backend (Node.js)

The backend uses a custom logger utility that suppresses non-error console output in production:

```js
// server/utils/logger.js
const isProduction = process.env.NODE_ENV === 'production';

const productionLogger = {
  log: () => {},
  info: () => {},
  warn: () => {},
  error: console.error, // Keep error logs even in production
  debug: () => {},
  trace: () => {}
};

module.exports = isProduction ? productionLogger : console;
```

### 3. ESLint Rules

An ESLint rule has been added to prevent adding new console statements:

```json
"rules": {
  "no-console": ["error", { "allow": ["warn", "error"] }]
}
```

## Best Practices for Logging

1. **Use Error Logging for Critical Issues**
   - When catching errors, use `logger.error()` to ensure the error is properly logged.

2. **For Frontend Development**
   - Use `console.warn()` and `console.error()` for issues that need attention.
   - Avoid `console.log()` for any production code.

3. **For Backend Development**
   - Always use the `logger` utility instead of direct console methods:
     ```js
     const logger = require('./utils/logger');
     
     // Good
     logger.error('Critical error:', error);
     
     // Bad
     console.log('Some message');
     ```

4. **Server-Side Logging**
   - Consider implementing a more robust logging solution for production (e.g., Winston, Pino).
   - Log to files for persistent error tracking.

## Running Builds

To test production builds locally:

```bash
# Frontend
npm run build

# Backend
NODE_ENV=production node server/index.js
``` 