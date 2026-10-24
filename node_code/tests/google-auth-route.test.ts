import './http-test-setup.js';
import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import type { Config } from '../src/config.js';
import { GoogleAuthError } from '../src/google-auth.js';
import { registerRoutes } from '../src/routes.js';

type Dependencies = Parameters<typeof registerRoutes>[1];

async function setup(options: { googleAuth?: unknown; signInResult?: unknown } = {}) {
  const auth = {
    signInWithGoogle: vi.fn().mockResolvedValue(options.signInResult ?? {
      kind: 'session',
      credentials: {
        sessionToken: 'session-value',
        csrfToken: 'csrf-value',
        user: { id: 'user-id', email: 'user@example.test', workspaceId: 'workspace-id', role: 'owner' }
      }
    })
  };
  const app = Fastify();
  await app.register(cookie);
  const dependencies: Dependencies = {
    config: { NODE_ENV: 'test', RATE_LIMIT_ENABLED: false } as Config,
    database: {} as Dependencies['database'],
    queue: {} as Dependencies['queue'],
    auth: auth as unknown as Dependencies['auth'],
    instagramOAuth: {} as Dependencies['instagramOAuth']
  };
  if (options.googleAuth) {
    dependencies.googleAuth = options.googleAuth as NonNullable<Dependencies['googleAuth']>;
  }
  await registerRoutes(app, dependencies);
  return { app, auth };
}

describe('Google sign-in HTTP contract', () => {
  it('reports missing Google configuration', async () => {
    const { app } = await setup();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/google',
        payload: { credential: 'x'.repeat(40) }
      });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({ code: 'GOOGLE_CONFIG_MISSING' });
    } finally {
      await app.close();
    }
  });

  it('validates the credential payload', async () => {
    const { app } = await setup();
    try {
      const response = await app.inject({ method: 'POST', url: '/v1/auth/google', payload: {} });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
    } finally {
      await app.close();
    }
  });

  it('creates a cookie session for a verified identity', async () => {
    const googleAuth = {
      verifyCredential: vi.fn().mockResolvedValue({
        googleSub: 'google-sub',
        email: 'user@example.test',
        displayName: 'Google User'
      })
    };
    const { app, auth } = await setup({ googleAuth });
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/google',
        payload: { credential: 'x'.repeat(40) }
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        data: { id: 'user-id', email: 'user@example.test', workspaceId: 'workspace-id', role: 'owner' }
      });
      expect(auth.signInWithGoogle).toHaveBeenCalledWith({
        googleSub: 'google-sub',
        email: 'user@example.test',
        displayName: 'Google User'
      });
      expect(response.headers['set-cookie']).toEqual(expect.arrayContaining([
        expect.stringContaining('session=session-value'),
        expect.stringContaining('csrf_token=csrf-value')
      ]));
    } finally {
      await app.close();
    }
  });

  it('rejects an email linked to a different Google account', async () => {
    const googleAuth = {
      verifyCredential: vi.fn().mockResolvedValue({ googleSub: 'google-sub', email: 'user@example.test' })
    };
    const { app } = await setup({ googleAuth, signInResult: { kind: 'conflict' } });
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/google',
        payload: { credential: 'x'.repeat(40) }
      });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ code: 'GOOGLE_ACCOUNT_CONFLICT' });
    } finally {
      await app.close();
    }
  });

  it.each([
    ['INVALID_GOOGLE_TOKEN', 401],
    ['GOOGLE_EMAIL_UNVERIFIED', 403],
    ['GOOGLE_CONFIG_MISSING', 503]
  ] as const)('maps %s verification failures', async (code, status) => {
    const googleAuth = {
      verifyCredential: vi.fn().mockRejectedValue(new GoogleAuthError(code, 'verification failed'))
    };
    const { app } = await setup({ googleAuth });
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/google',
        payload: { credential: 'x'.repeat(40) }
      });
      expect(response.statusCode).toBe(status);
      expect(response.json()).toMatchObject({ code });
    } finally {
      await app.close();
    }
  });
});
