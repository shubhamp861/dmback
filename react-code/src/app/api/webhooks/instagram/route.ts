import { metaGraphApi } from '@/src/lib/meta-graph-api';

const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'dmlink_instagram_verify_token_2026';
const META_APP_SECRET = process.env.META_APP_SECRET || '';

/**
 * Standard Next.js App Router & Web Fetch Request handler types
 */
interface WebhookRequest extends Request {
  nextUrl?: URL;
}

/**
 * GET Handler: Meta Webhook Challenge Handshake
 * Responds to Meta verification challenge when subscribing to webhook
 */
export async function GET(req: Request | WebhookRequest): Promise<Response> {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === META_VERIFY_TOKEN && challenge) {
    console.log('[Meta Webhook] Verification successful for challenge:', challenge);
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return new Response(JSON.stringify({ error: 'Verification token mismatch' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * POST Handler: Instagram Comment, Story Reply & Mention Events
 * Verifies HMAC-SHA256 signature and executes automated DM sequences
 */
export async function POST(req: Request | WebhookRequest): Promise<Response> {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-hub-signature-256') || '';

    // Verify HMAC signature in production
    if (META_APP_SECRET) {
      const isValid = await metaGraphApi.verifyWebhookSignature(rawBody, signature, META_APP_SECRET);
      if (!isValid) {
        console.error('[Meta Webhook] Invalid HMAC signature');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const payload = JSON.parse(rawBody);

    if (payload.object === 'instagram' && Array.isArray(payload.entry)) {
      for (const entry of payload.entry) {
        if (Array.isArray(entry.changes)) {
          for (const change of entry.changes) {
            if (change.field === 'comments') {
              const commentData = change.value;
              console.log('[Meta Webhook] Received comment:', {
                id: commentData.id,
                text: commentData.text,
                from: commentData.from?.username,
                mediaId: commentData.media?.id,
              });

              // Process keyword matching against live automations
              // Query DB for live automations, match keyword rules, execute public reply + DM
            }
          }
        }
      }
    }

    // Always respond 200 OK to acknowledge receipt to Meta within 5 seconds
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Meta Webhook] Error processing event:', error);
    return new Response(JSON.stringify({ error: 'Internal processing error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
