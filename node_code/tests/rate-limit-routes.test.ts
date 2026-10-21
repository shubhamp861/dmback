import './http-test-setup.js';
import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { hashToken, type AuthContext } from '../src/auth.js';
import type { Config } from '../src/config.js';
import { registerRoutes } from '../src/routes.js';
import type { RateLimiter } from '../src/rate-limit.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const accountId = '33333333-3333-4333-8333-333333333333';
const csrfToken = 'valid-csrf-token';
const context: AuthContext = {
  sessionId: 'session-id', userId: 'user-id', email: 'test@example.com', workspaceId,
  role: 'owner', csrfTokenHash: hashToken(csrfToken)
};

function headers() {
  return { cookie: `session=valid-session; csrf_token=${csrfToken}`, 'x-csrf-token': csrfToken };
}

async function setup(rateLimiter: RateLimiter) {
  const database = {
    listInstagramAccounts: vi.fn().mockResolvedValue([{ id: accountId }]),
    listAutomations: vi.fn().mockResolvedValue([]),
    createAutomation: vi.fn()
  };
  const app = Fastify();
  await app.register(cookie);
  await registerRoutes(app, {
    config: {
      NODE_ENV: 'test', RATE_LIMIT_ENABLED: true, RATE_LIMIT_WINDOW_SECONDS: 60,
      RATE_LIMIT_USER_MAX: 120, RATE_LIMIT_WORKSPACE_MAX: 300,
      RATE_LIMIT_AUTH_IP_MAX: 20, RATE_LIMIT_WEBHOOK_IP_MAX: 120
    } as Config,
    database: database as unknown as Parameters<typeof registerRoutes>[1]['database'],
    queue: {} as Parameters<typeof registerRoutes>[1]['queue'],
    auth: { authenticate: vi.fn().mockResolvedValue(context) } as unknown as Parameters<typeof registerRoutes>[1]['auth'],
    instagramOAuth: {} as Parameters<typeof registerRoutes>[1]['instagramOAuth'],
    rateLimiter
  });
  return { app, database };
}

describe('rate-limited routes', () => {
  it('returns a standard 429 response and headers when an authenticated bucket is exhausted', async () => {
    const calls: string[] = [];
    const rateLimiter: RateLimiter = {
      consume: vi.fn(async (key) => {
        calls.push(key);
        return { allowed: !key.includes('user:'), limit: key.includes('user:') ? 120 : 300, remaining: key.includes('user:') ? 0 : 299, retryAfterSeconds: 42 };
      }),
      close: vi.fn(async () => {})
    };
    const { app, database } = await setup(rateLimiter);
    try {
      const response = await app.inject({ method: 'GET', url: '/v1/automations', headers: headers() });
      expect(response.statusCode).toBe(429);
      expect(response.headers['ratelimit-limit']).toBe('120');
      expect(response.headers['ratelimit-remaining']).toBe('0');
      expect(response.headers['retry-after']).toBe('42');
      expect(response.json()).toMatchObject({ code: 'RATE_LIMITED', message: 'Too many requests' });
      expect(database.listAutomations).not.toHaveBeenCalled();
      expect(calls).toEqual(['ratelimit:user:user-id', 'ratelimit:workspace:11111111-1111-4111-8111-111111111111']);
    } finally {
      await app.close();
    }
  });

  it('fails open when the limiter Redis connection is unavailable', async () => {
    const rateLimiter: RateLimiter = {
      consume: vi.fn(async () => { throw new Error('redis unavailable'); }),
      close: vi.fn(async () => {})
    };
    const { app, database } = await setup(rateLimiter);
    try {
      const response = await app.inject({ method: 'GET', url: '/v1/automations', headers: headers() });
      expect(response.statusCode).toBe(200);
      expect(database.listAutomations).toHaveBeenCalledWith(workspaceId, { limit: 50 });
    } finally {
      await app.close();
    }
  });
});
