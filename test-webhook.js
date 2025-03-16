#!/usr/bin/env node

const http = require('http');

// Function to test the verification endpoint
function testVerification(challenge = 'test_challenge_123') {
  console.log(`Testing verification with challenge: ${challenge}`);
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: `/api/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=test_token&hub.challenge=${encodeURIComponent(challenge)}`,
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('RESPONSE BODY:');
      console.log(data);
      console.log('\nVerification test complete!');
      
      if (data === challenge) {
        console.log('✅ Success! The challenge was echoed back correctly.');
      } else {
        console.log('❌ Failed! The challenge was not echoed back correctly.');
      }
    });
  });

  req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
  });

  req.end();
}

// Function to test sending a message
function testMessage(message = 'Hello, this is a test message!') {
  console.log(`Testing message: "${message}"`);
  
  const payload = {
    object: 'whatsapp_business_account',
    entry: [{
      id: '12345',
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: '1234567890',
            phone_number_id: '1234567890'
          },
          contacts: [{
            profile: {
              name: 'Test User'
            },
            wa_id: '9876543210'
          }],
          messages: [{
            from: '9876543210',
            id: 'test-message-id',
            timestamp: Math.floor(Date.now() / 1000).toString(),
            text: {
              body: message
            },
            type: 'text'
          }]
        },
        field: 'messages'
      }]
    }]
  };

  const data = JSON.stringify(payload);
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/webhook/whatsapp',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    
    let responseData = '';
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    res.on('end', () => {
      console.log('RESPONSE BODY:');
      console.log(responseData);
      console.log('\nMessage test complete!');
    });
  });

  req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
  });

  req.write(data);
  req.end();
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];
const param = args[1];

if (command === 'verify') {
  testVerification(param);
} else if (command === 'message') {
  testMessage(param);
} else {
  console.log('Usage:');
  console.log('  node test-webhook.js verify [challenge]  - Test the verification endpoint');
  console.log('  node test-webhook.js message [message]   - Test sending a message');
}