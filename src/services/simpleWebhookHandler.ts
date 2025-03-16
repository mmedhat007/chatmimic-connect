/**
 * Simple webhook handler for testing WhatsApp verification
 * This handler doesn't depend on Firebase or other services
 */
export const handleSimpleWebhook = async (req: Request): Promise<Response> => {
  try {
    console.log('Webhook request received:', req.method, new URL(req.url).pathname);
    
    // Handle verification request from WhatsApp
    if (req.method === 'GET') {
      const url = new URL(req.url);
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

    // Method not allowed
    return new Response('Method not allowed', { 
      status: 405,
      headers: { 'Content-Type': 'text/plain' }
    });
  } catch (error) {
    console.error('Error handling webhook:', error);
    return new Response('Internal server error', { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}; 