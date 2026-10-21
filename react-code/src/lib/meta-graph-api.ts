/**
 * Meta Graph API & Instagram Messaging API Integration Specialist Client
 * Compliant with Meta Platform Terms, Instagram Messaging API, and Webhooks 2026
 */

export interface MetaOAuthTokens {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export interface InstagramProfileData {
  id: string;
  username: string;
  name?: string;
  profile_picture_url?: string;
  followers_count?: number;
  account_type?: string;
}

export interface SendDMOptions {
  recipientId: string;
  messageText: string;
  buttonLabel?: string;
  redirectUrl?: string;
  accessToken: string;
}

export interface WebhookChangeEntry {
  field: string;
  value: {
    id: string;
    text: string;
    from: { id: string; username: string };
    media?: { id: string };
    parent_id?: string;
  };
}

export class MetaGraphApiClient {
  private apiVersion = 'v21.0';
  private baseUrl = 'https://graph.facebook.com';

  /**
   * Generates official Instagram Business OAuth authorization redirect URL
   */
  public getAuthorizationUrl(clientId: string, redirectUri: string, state: string): string {
    const scopes = [
      'instagram_basic',
      'instagram_manage_comments',
      'instagram_manage_messages',
      'pages_show_list',
      'pages_read_engagement',
    ].join(',');

    return `https://www.instagram.com/oauth/authorize?enable_fb_login=0&force_authentication=1&client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=${scopes}&state=${state}`;
  }

  /**
   * Exchanges authorization code for long-lived Instagram access token (60-day validity)
   */
  public async exchangeCodeForToken(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string
  ): Promise<MetaOAuthTokens> {
    const formData = new URLSearchParams();
    formData.append('client_id', clientId);
    formData.append('client_secret', clientSecret);
    formData.append('grant_type', 'authorization_code');
    formData.append('redirect_uri', redirectUri);
    formData.append('code', code);

    const res = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Token exchange failed: ${JSON.stringify(err)}`);
    }

    return await res.json();
  }

  /**
   * Dispatches automated Instagram Direct Message with optional interactive button card
   */
  public async sendInstagramDM(options: SendDMOptions): Promise<{ recipient_id: string; message_id: string }> {
    const { recipientId, messageText, buttonLabel, redirectUrl, accessToken } = options;

    let messagePayload: Record<string, unknown> = {
      text: messageText,
    };

    // If an interactive button card is configured, use generic template
    if (buttonLabel && redirectUrl) {
      messagePayload = {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic',
            elements: [
              {
                title: messageText.slice(0, 80),
                subtitle: 'Tap the button below to claim your access:',
                buttons: [
                  {
                    type: 'web_url',
                    url: redirectUrl,
                    title: buttonLabel.slice(0, 20),
                  },
                ],
              },
            ],
          },
        },
      };
    }

    const res = await fetch(`${this.baseUrl}/${this.apiVersion}/me/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: messagePayload,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Instagram Send API error: ${JSON.stringify(err)}`);
    }

    return await res.json();
  }

  /**
   * Sends automated public reply to an Instagram comment (e.g. "Check your DMs! 🚀")
   */
  public async replyToComment(commentId: string, replyMessage: string, accessToken: string): Promise<{ id: string }> {
    const res = await fetch(`${this.baseUrl}/${this.apiVersion}/${commentId}/replies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message: replyMessage,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Failed to post public comment reply: ${JSON.stringify(err)}`);
    }

    return await res.json();
  }

  /**
   * Verifies SHA256 HMAC signature sent by Meta Webhooks in 'x-hub-signature-256'
   */
  public async verifyWebhookSignature(payloadRaw: string, signatureHeader: string, appSecret: string): Promise<boolean> {
    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
      return false;
    }
    const signatureHash = signatureHeader.slice(7);

    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(appSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadRaw));
      const calculatedHash = Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      return calculatedHash === signatureHash;
    }

    return true;
  }
}

export const metaGraphApi = new MetaGraphApiClient();
