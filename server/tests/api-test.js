/**
 * API Testing Script for ChatMimic Connect
 * 
 * This script tests all the critical endpoints to ensure they're working
 * Run this after making changes to verify functionality
 */

const axios = require('axios');
const readline = require('readline');
const fs = require('fs').promises;
const path = require('path');

// Create readline interface for interactive use
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Configuration - can be changed via command line options
let config = {
  baseUrl: 'http://localhost:3000',
  authToken: '',
  testEmbeddings: true,
  testGoogleSheets: true,
  testProxyEndpoint: true,
  verbose: false
};

// Result tracking
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

/**
 * Display success message
 */
function success(message) {
  console.log('\x1b[32m✓\x1b[0m', message);
  results.passed++;
  results.tests.push({ name: message, status: 'passed' });
}

/**
 * Display error message
 */
function error(message, details = null) {
  console.log('\x1b[31m✗\x1b[0m', message);
  if (details && config.verbose) {
    console.error('  Details:', details);
  }
  results.failed++;
  results.tests.push({ name: message, status: 'failed', details });
}

/**
 * Display info message
 */
function info(message) {
  console.log('\x1b[36mi\x1b[0m', message);
}

/**
 * Display skipped message
 */
function skipped(message) {
  console.log('\x1b[33m-\x1b[0m', message);
  results.skipped++;
  results.tests.push({ name: message, status: 'skipped' });
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--url':
      case '-u':
        config.baseUrl = args[++i];
        break;
      case '--token':
      case '-t':
        config.authToken = args[++i];
        break;
      case '--no-embeddings':
        config.testEmbeddings = false;
        break;
      case '--no-google-sheets':
        config.testGoogleSheets = false;
        break;
      case '--no-proxy':
        config.testProxyEndpoint = false;
        break;
      case '--verbose':
      case '-v':
        config.verbose = true;
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
    }
  }
}

/**
 * Show help information
 */
function showHelp() {
  console.log(`
API Testing Script for ChatMimic Connect

Usage: node api-test.js [options]

Options:
  -u, --url URL              Base URL for API (default: http://localhost:3000)
  -t, --token TOKEN          Auth token for authenticated requests
  --no-embeddings            Skip embeddings tests
  --no-google-sheets         Skip Google Sheets tests
  --no-proxy                 Skip general proxy endpoint tests
  -v, --verbose              Show detailed error information
  -h, --help                 Show this help information
`);
}

/**
 * Create axios instance with authentication
 */
function createClient() {
  return axios.create({
    baseURL: config.baseUrl,
    headers: config.authToken ? {
      'Authorization': `Bearer ${config.authToken}`
    } : {},
    validateStatus: () => true, // Don't throw on error status codes
    timeout: 10000
  });
}

/**
 * Test health endpoint (basic connectivity test)
 */
async function testHealth() {
  info('Testing API health endpoint...');
  
  try {
    const client = createClient();
    const response = await client.get('/api/health');
    
    if (response.status === 200 && response.data?.status === 'ok') {
      success('Health endpoint responded successfully');
      return true;
    } else {
      error('Health endpoint returned unexpected response', {
        status: response.status,
        data: response.data
      });
      return false;
    }
  } catch (err) {
    error('Error connecting to health endpoint', err.message);
    return false;
  }
}

/**
 * Test embeddings endpoint
 */
async function testEmbeddings() {
  if (!config.testEmbeddings) {
    skipped('Skipping embeddings tests');
    return;
  }
  
  info('Testing embeddings endpoint...');
  
  try {
    const client = createClient();
    const response = await client.post('/api/proxy/embeddings', {
      text: 'This is a test message for embeddings generation.',
      model: 'text-embedding-3-small'
    });
    
    if (response.status === 200 && response.data?.status === 'success' && Array.isArray(response.data?.data?.embedding)) {
      success('Embeddings endpoint returned valid embeddings');
      return true;
    } else if (response.status === 401) {
      skipped('Embeddings test skipped - authentication required');
      return false;
    } else {
      error('Embeddings endpoint returned unexpected response', {
        status: response.status,
        data: response.data
      });
      return false;
    }
  } catch (err) {
    error('Error testing embeddings endpoint', err.message);
    return false;
  }
}

/**
 * Test Google Sheets status endpoint
 */
async function testGoogleSheetsStatus() {
  if (!config.testGoogleSheets) {
    skipped('Skipping Google Sheets tests');
    return;
  }
  
  info('Testing Google Sheets status endpoint...');
  
  try {
    const client = createClient();
    const response = await client.get('/api/google-sheets/status');
    
    if (response.status === 200) {
      success('Google Sheets status endpoint responded successfully');
      return {
        success: true,
        connected: response.data?.data?.connected || false
      };
    } else if (response.status === 401) {
      skipped('Google Sheets status test skipped - authentication required');
      return { success: false };
    } else {
      error('Google Sheets status endpoint returned unexpected response', {
        status: response.status,
        data: response.data
      });
      return { success: false };
    }
  } catch (err) {
    error('Error testing Google Sheets status endpoint', err.message);
    return { success: false };
  }
}

/**
 * Test direct API endpoints that don't require authentication
 */
async function testPublicEndpoints() {
  info('Testing public API endpoints...');
  
  const endpoints = [
    { path: '/health', method: 'GET', name: 'Direct health endpoint' },
    { path: '/api/health', method: 'GET', name: 'API health endpoint' }
  ];
  
  const client = createClient();
  let allPassed = true;
  
  for (const endpoint of endpoints) {
    try {
      const response = await client[endpoint.method.toLowerCase()](endpoint.path);
      
      if (response.status === 200) {
        success(`Public endpoint ${endpoint.name} (${endpoint.path}) responded successfully`);
      } else {
        error(`Public endpoint ${endpoint.name} (${endpoint.path}) returned status ${response.status}`, {
          status: response.status,
          data: response.data
        });
        allPassed = false;
      }
    } catch (err) {
      error(`Error accessing ${endpoint.name} (${endpoint.path})`, err.message);
      allPassed = false;
    }
  }
  
  return allPassed;
}

/**
 * Ask for user input with a promise
 */
function askQuestion(question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer);
    });
  });
}

/**
 * Run all tests
 */
async function runTests() {
  console.log(`\nTesting ChatMimic Connect API at ${config.baseUrl}\n`);
  
  // First test health endpoint
  const healthOk = await testHealth();
  
  if (!healthOk) {
    error('Health check failed, aborting remaining tests');
    return;
  }
  
  // Test additional public endpoints
  await testPublicEndpoints();
  
  // For unauthenticated runs, provide clear messaging
  if (!config.authToken) {
    console.log('\n\x1b[33mRunning in unauthenticated mode\x1b[0m');
    console.log('Some tests will be skipped as they require authentication.');
    console.log('Use -t flag with a valid token to run all tests.\n');
  }
  
  // Run embeddings test - will auto-skip if auth is required
  await testEmbeddings();
  
  // Run Google Sheets tests - will auto-skip if auth is required
  const sheetsStatus = await testGoogleSheetsStatus();
  
  // Add more tests as needed
  
  // Display summary
  console.log('\nTest Summary:');
  console.log(`  Passed: \x1b[32m${results.passed}\x1b[0m`);
  console.log(`  Failed: \x1b[31m${results.failed}\x1b[0m`);
  console.log(`  Skipped: \x1b[33m${results.skipped}\x1b[0m`);
  console.log(`  Total: ${results.passed + results.failed + results.skipped}`);
  
  // Save results to file
  const timestamp = new Date().toISOString().replace(/:/g, '-').substring(0, 19);
  const resultsFile = path.join(__dirname, `test-results-${timestamp}.json`);
  
  await fs.writeFile(
    resultsFile, 
    JSON.stringify({
      timestamp: new Date().toISOString(),
      config,
      results: {
        passed: results.passed,
        failed: results.failed,
        skipped: results.skipped,
        tests: results.tests
      }
    }, null, 2)
  );
  
  console.log(`\nDetailed results saved to: ${resultsFile}`);
}

// Main function
async function main() {
  parseArgs();
  
  // Simplified auth flow - don't require token for basic testing
  if (!config.authToken) {
    console.log('No auth token provided. Running in unauthenticated mode.');
    console.log('Some endpoints may not be tested fully.');
    // Continue without asking for token
  }
  
  try {
    await runTests();
  } catch (err) {
    console.error('Unhandled error during tests:', err);
  }
  
  rl.close();
}

// Run the main function
main(); 