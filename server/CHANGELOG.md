# Changelog

## [Unreleased]

### Added
- Comprehensive API documentation file (`API_ENDPOINTS.md`) listing all endpoints, methods, parameters, and response formats
- Server README with detailed API standards and documentation guidelines

### Changed
- Standardized response format across all API endpoints
  - All success responses now use `{ status: 'success', data: {...}, meta: {...} }`
  - All error responses now use `{ status: 'error', message: "...", details: {...}, meta: {...} }`
- Added responseTime tracking to all API endpoints
- Improved documentation format for all route handlers using `@authentication`, `@request`, and `@response` tags
- Updated the following routes to follow standardized formats:
  - `/api/config` routes (GET and POST)
  - `/api/google-sheets/*` routes 
  - `/api/proxy/proxy` and dynamic proxy routes
  - `/api/google-oauth/*` routes
  - `/api/health` and `/health` routes
- Enhanced error handling across all endpoints with consistent logging and response formats
- Updated 404 and global error handlers to follow the standardized response format

### Fixed
- Improved error handling with detailed error messages and proper status codes
- Fixed inconsistent response formats across different route handlers
- Ensured all API routes return proper meta information including response times 