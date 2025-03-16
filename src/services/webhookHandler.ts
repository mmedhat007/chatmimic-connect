import { processWebhookPayload } from './whatsappWebhook';

/**
 * Handle incoming webhook requests from WhatsApp
 */
export const handleWebhook = async (req: Request): Promise<Response> => {
  try {
    // Handle verification request from WhatsApp
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      // Verify the webhook
      if (mode === 'subscribe' && token) {
        // The verify token should match the one set in the WhatsApp Business API
        // In a real implementation, this should be fetched from a secure configuration
        // For now, we'll use a simple check
        if (token === import.meta.env.VITE_WHATSAPP_VERIFY_TOKEN) {
          return new Response(challenge, {
            status: 200,
            headers: { 'Content-Type': 'text/plain' }
          });
        } else {
          return new Response('Verification failed', { status: 403 });
        }
      }
    }

    // Handle incoming messages
    if (req.method === 'POST') {
      const payload = await req.json();
      
      // Process the webhook payload
      const result = await processWebhookPayload(payload);
      
      if (!result.success) {
        console.error('Error processing webhook:', result.error);
        return new Response(JSON.stringify({ error: result.error }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Method not allowed
    return new Response('Method not allowed', { status: 405 });
  } catch (error) {
    console.error('Error handling webhook:', error);
    return new Response('Internal server error', { status: 500 });
  }
}; 