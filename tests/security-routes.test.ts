import './http-test-setup.js';
import { createHmac } from 'node:crypto';
import cookie from '@fastify/cookie';
import rawBody from 'fastify-raw-body';
import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import type { Config } from '../src/config.js';
import { InstagramOAuthError } from '../src/instagram/oauth.js';
import { registerRoutes } from '../src/routes.js';

const sentinel = 'PRIVATE_SENTINEL_DO_NOT_LOG';
const credentials = { sessionToken: 'synthetic-session', csrfToken: 'synthetic-csrf',
  user: { id: 'user', workspaceId: 'workspace', email: 'synthetic@example.test', role: 'owner' } };

async function setup(mode: Config['NODE_ENV']) {
  const app = Fastify();
  const auth = { signup: vi.fn().mockResolvedValue(credentials), login: vi.fn().mockResolvedValue(credentials),
    logout: vi.fn().mockResolvedValue(undefined), authenticate: vi.fn().mockResolvedValue({ role: 'owner' }) };
  const database = { insertWebhookEvent: vi.fn().mockResolvedValue({ id: 'event' }),
    markWebhookDispatched: vi.fn(), markWebhookDispatchFailed: vi.fn().mockResolvedValue(undefined) };
  const queue = { enqueueMatch: vi.fn().mockRejectedValue(new Error(`redis://user:${sentinel}@host`)) };
  const instagramOAuth = { createAuthorizationUrl: vi.fn().mockRejectedValue(new InstagramOAuthError('META_TOKEN_EXCHANGE_FAILED', sentinel)) };
  await app.register(cookie);
  await app.register(rawBody, { field: 'rawBody', global: false, encoding: false, routes: ['/v1/webhooks/instagram'] });
  app.register(registerRoutes, {
    config: { NODE_ENV: mode, META_APP_SECRET: 'synthetic-signing-secret' } as Config,
    database: database as unknown as Parameters<typeof registerRoutes>[1]['database'],
    queue: queue as unknown as Parameters<typeof registerRoutes>[1]['queue'],
    auth: auth as unknown as Parameters<typeof registerRoutes>[1]['auth'],
    instagramOAuth: instagramOAuth as unknown as Parameters<typeof registerRoutes>[1]['instagramOAuth']
  });
  return { app, database };
}

describe('security-sensitive route boundaries', () => {
  it.each(['development', 'test', 'staging', 'production'] as const)('sets and clears Secure cookies correctly in %s', async (mode) => {
    const { app } = await setup(mode);
    try {
      for (const url of ['/v1/auth/signup', '/v1/auth/login', '/v1/auth/logout']) {
        const response = await app.inject({ method: 'POST', url,
          payload: url.endsWith('logout') ? {} : { email: 'synthetic@example.test', password: 'synthetic-long-password' } });
        expect(response.statusCode).toBe(url.endsWith('signup') ? 201 : 200);
        const headers = response.headers['set-cookie'];
        expect(Array.isArray(headers)).toBe(true);
        for (const header of headers as string[]) {
          expect(header.includes('; Secure')).toBe(mode === 'staging' || mode === 'production');
        }
      }
    } finally { await app.close(); }
  });

  it('uses reviewed OAuth error messages rather than exception text', async () => {
    const { app } = await setup('test');
    try {
      const response = await app.inject('/v1/auth/instagram/start');
      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe('META_TOKEN_EXCHANGE_FAILED');
      expect(response.body).not.toContain(sentinel);
    } finally { await app.close(); }
  });

  it('persists only a stable failure code when immediate queue dispatch throws a credential-bearing error', async () => {
    const { app, database } = await setup('test');
    try {
      const body = JSON.stringify({ object: 'instagram', entry: [] });
      const signature = createHmac('sha256', 'synthetic-signing-secret').update(body).digest('hex');
      const response = await app.inject({ method: 'POST', url: '/v1/webhooks/instagram', payload: body,
        headers: { 'content-type': 'application/json', 'x-hub-signature-256': `sha256=${signature}` } });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ received: true });
      expect(database.markWebhookDispatchFailed).toHaveBeenCalledWith('event', 'QUEUE_DISPATCH_FAILED');
      expect(database.markWebhookDispatched).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });
});
