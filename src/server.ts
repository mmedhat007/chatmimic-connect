// import { handleWebhook } from './services/webhookHandler';
import { handleSimpleWebhook } from './services/simpleWebhookHandler';

// This function will be used by Vite's development server to handle API requests
export const apiHandler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const path = url.pathname;

  console.log(`API request received: ${req.method} ${path}`);

  // Handle WhatsApp webhook
  if (path === '/api/webhook/whatsapp') {
    // Handle verification request from WhatsApp
    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      console.log('Verification request details:', { mode, token, challenge });

      // For testing purposes, accept any verification request with a challenge
      if (mode === 'subscribe' && challenge) {
        console.log('Responding with challenge:', challenge);
        return new Response(challenge, {
          status: 200,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    }

    // Handle incoming messages (POST requests)
    if (req.method === 'POST') {
      try {
        const payload = await req.json();
        console.log('Received webhook payload:', JSON.stringify(payload, null, 2));
        
        // Just acknowledge receipt for testing
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error parsing webhook payload:', error);
        return new Response(JSON.stringify({ error: 'Invalid payload' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  }

  // Route not found or method not allowed
  return new Response('Not found or method not allowed', { status: 404 });
}; 