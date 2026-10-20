import { describe, expect, it, vi } from 'vitest';
import { InstagramOAuthService } from '../src/instagram/oauth.js';
import type { Config } from '../src/config.js';

const config = {
  NODE_ENV: 'test',
  PORT: 3000,
  HOST: '127.0.0.1',
  DATABASE_URL: 'postgres://instagram:instagram@localhost:5432/instagram_automation',
  REDIS_URL: 'redis://localhost:6379',
  META_APP_ID: 'test-app-id',
  META_APP_SECRET: 'test-app-secret',
  META_REDIRECT_URI: 'http://localhost:3000/v1/auth/instagram/callback',
  META_API_VERSION: 'v23.0',
  META_GRAPH_BASE_URL: 'https://graph.instagram.com',
  META_OAUTH_BASE_URL: 'https://api.instagram.com',
  META_INSTAGRAM_SCOPES: 'instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages',
  META_WEBHOOK_VERIFY_TOKEN: 'test-verify-token',
  TOKEN_ENCRYPTION_KEY: Buffer.from('01234567890123456789012345678901').toString('base64'),
  WEB_ORIGIN: 'http://localhost:3001',
  LOG_LEVEL: 'info'
} satisfies Config;

describe('InstagramOAuthService', () => {
  it('builds a session-bound authorization URL and stores hashed state', async () => {
    const createInstagramOAuthState = vi.fn().mockResolvedValue(undefined);
    const service = new InstagramOAuthService({ createInstagramOAuthState } as never, config);
    const url = await service.createAuthorizationUrl({
      sessionId: 'session-1',
      userId: 'user-1',
      workspaceId: 'workspace-1',
      email: 'developer@example.local',
      role: 'owner',
      csrfTokenHash: 'csrf-hash'
    });

    const parsed = new URL(url);
    expect(parsed.origin).toBe('https://www.instagram.com');
    expect(parsed.pathname).toBe('/oauth/authorize');
    expect(parsed.searchParams.get('client_id')).toBe('test-app-id');
    expect(parsed.searchParams.get('state')).toHaveLength(43);
    expect(parsed.searchParams.get('scope')).toContain('instagram_business_basic');
    expect(createInstagramOAuthState).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      sessionId: 'session-1',
      redirectUri: config.META_REDIRECT_URI,
      expiresInSeconds: 600,
      stateHash: expect.any(String)
    }));
  });
});
