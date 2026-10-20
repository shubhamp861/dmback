import './http-test-setup.js';
import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { hashToken, type AuthContext } from '../src/auth.js';
import type { Config } from '../src/config.js';
import { registerRoutes } from '../src/routes.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const automationId = '22222222-2222-4222-8222-222222222222';
const accountId = '33333333-3333-4333-8333-333333333333';
const foreignId = '44444444-4444-4444-8444-444444444444';
const csrfToken = 'valid-csrf-token';
const input = { name: 'Example', igAccountId: accountId, keywordRules: [{ value: 'hello' }] };
const context: AuthContext = {
  sessionId: 'session-id', userId: 'user-id', email: 'test@example.com', workspaceId,
  role: 'owner', csrfTokenHash: hashToken(csrfToken)
};

const endpoints = [
  { method: 'GET', url: '/v1/auth/me', access: 'read', status: 200 },
  { method: 'GET', url: '/v1/ig-accounts', access: 'read', status: 200 },
  { method: 'GET', url: '/v1/automations', access: 'read', status: 200 },
  { method: 'GET', url: `/v1/automations/${automationId}`, access: 'read', status: 200 },
  { method: 'GET', url: `/v1/automations/${automationId}/events`, access: 'read', status: 200 },
  { method: 'GET', url: '/v1/auth/instagram/start', access: 'connect', status: 302 },
  { method: 'GET', url: '/v1/auth/instagram/callback?code=code&state=abcdefghijklmnopqrst', access: 'connect', status: 200 },
  { method: 'POST', url: '/v1/automations', access: 'write', status: 201 },
  ...(['publish', 'pause', 'resume'] as const).map((action) => ({
    method: 'POST' as const, url: `/v1/automations/${automationId}/${action}`, access: 'write', status: 200
  }))
] as const;

async function setup(role: string = 'owner') {
  const database = {
    listInstagramAccounts: vi.fn().mockResolvedValue([{ id: accountId }]),
    listAutomations: vi.fn().mockResolvedValue([{ id: automationId }]),
    getAutomation: vi.fn().mockImplementation(async (id: string) => id === automationId ? { id } : undefined),
    listTriggerEvents: vi.fn().mockResolvedValue([]),
    createAutomation: vi.fn().mockImplementation(async (data: typeof input) => data.igAccountId === accountId ? { id: automationId } : undefined),
    updateAutomationStatus: vi.fn().mockImplementation(async (id: string) => id === automationId ? { id } : undefined)
  };
  const instagramOAuth = {
    createAuthorizationUrl: vi.fn().mockResolvedValue('https://www.instagram.com/oauth/authorize'),
    completeAuthorization: vi.fn().mockResolvedValue({ id: accountId })
  };
  const authenticate = vi.fn().mockImplementation(async (token: string | undefined) =>
    token === 'valid-session' ? { ...context, role } : undefined);
  const app = Fastify();
  await app.register(cookie);
  // These deliberately narrow doubles implement only the exercised methods;
  // production dependencies retain their concrete service types.
  await registerRoutes(app, {
    config: { NODE_ENV: 'test' } as Config,
    database: database as unknown as Parameters<typeof registerRoutes>[1]['database'],
    queue: {} as Parameters<typeof registerRoutes>[1]['queue'],
    auth: { authenticate } as unknown as Parameters<typeof registerRoutes>[1]['auth'],
    instagramOAuth: instagramOAuth as unknown as Parameters<typeof registerRoutes>[1]['instagramOAuth']
  });
  return { app, database, instagramOAuth, authenticate, serviceMocks: [...Object.values(database), ...Object.values(instagramOAuth)] };
}

function headers() {
  return { cookie: `session=valid-session; csrf_token=${csrfToken}`, 'x-csrf-token': csrfToken };
}

describe('protected route authorization', () => {
  it('keeps /health live without authenticating or accessing dependencies', async () => {
    const { app, serviceMocks, authenticate } = await setup();
    try {
      const response = await app.inject('/health');
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: 'ok' });
      expect(authenticate).not.toHaveBeenCalled();
      for (const service of serviceMocks) expect(service).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  for (const role of ['owner', 'admin', 'editor', 'viewer', 'unknown', '__proto__']) {
    it.each(endpoints)(`${role}: $method $url`, async (endpoint) => {
      const { app, serviceMocks, authenticate } = await setup(role);
      try {
        const allowed = ['owner', 'admin'].includes(role)
          || (role === 'editor' && endpoint.access !== 'connect')
          || (role === 'viewer' && endpoint.access === 'read');
        const response = await app.inject({
          method: endpoint.method as 'GET' | 'POST', url: endpoint.url,
          headers: headers(), ...(endpoint.method === 'POST' ? { payload: input } : {})
        });
        expect(authenticate).toHaveBeenCalledWith('valid-session');
        expect(response.statusCode).toBe(allowed ? endpoint.status : 403);
        if (!allowed) {
          expect(response.json().code).toBe('FORBIDDEN');
          for (const service of serviceMocks) expect(service).not.toHaveBeenCalled();
        }
      } finally { await app.close(); }
    });
  }

  for (const session of ['', 'session=expired-session']) {
    it.each(endpoints)(`unauthenticated (${session || 'missing cookie'}): $method $url`, async (endpoint) => {
      const { app, serviceMocks } = await setup();
      try {
        const response = await app.inject({ method: endpoint.method as 'GET' | 'POST', url: endpoint.url,
          headers: { cookie: session }, ...(endpoint.method === 'POST' ? { payload: input } : {}) });
        expect(response.statusCode).toBe(401);
        expect(response.json().code).toBe('UNAUTHENTICATED');
        for (const service of serviceMocks) expect(service).not.toHaveBeenCalled();
      } finally { await app.close(); }
    });
  }

  for (const role of ['owner', 'admin', 'editor']) {
    for (const csrf of ['missing-header', 'missing-cookie', 'mismatch', 'wrong-session-token']) {
      it.each(endpoints.filter((endpoint) => endpoint.method === 'POST'))(`${role} requires CSRF (${csrf}): $url`, async (endpoint) => {
        const { app, serviceMocks } = await setup(role);
        try {
          const requestHeaders: Record<string, string> = headers();
          if (csrf === 'missing-header') delete requestHeaders['x-csrf-token'];
          if (csrf === 'missing-cookie') requestHeaders.cookie = 'session=valid-session';
          if (csrf === 'mismatch') requestHeaders['x-csrf-token'] = 'other-token';
          if (csrf === 'wrong-session-token') {
            requestHeaders.cookie = 'session=valid-session; csrf_token=other-token';
            requestHeaders['x-csrf-token'] = 'other-token';
          }
          const response = await app.inject({ method: 'POST', url: endpoint.url, headers: requestHeaders, payload: input });
          expect(response.statusCode).toBe(403);
          expect(response.json().code).toBe('CSRF_INVALID');
          for (const service of serviceMocks) expect(service).not.toHaveBeenCalled();
        } finally { await app.close(); }
      });
    }
  }
});

describe('workspace boundaries', () => {
  it('forwards session workspace and session identity to every scoped dependency', async () => {
    const { app, database, instagramOAuth } = await setup();
    try {
      for (const endpoint of endpoints) {
        const response = await app.inject({ method: endpoint.method as 'GET' | 'POST', url: endpoint.url,
          headers: headers(), ...(endpoint.method === 'POST' ? { payload: { ...input, workspaceId: foreignId } } : {}) });
        expect(response.statusCode).toBe(endpoint.status);
      }
      expect(database.listInstagramAccounts).toHaveBeenCalledWith(workspaceId);
      expect(database.listAutomations).toHaveBeenCalledWith(workspaceId);
      expect(database.getAutomation).toHaveBeenCalledWith(automationId, workspaceId);
      expect(database.listTriggerEvents).toHaveBeenCalledWith(automationId, workspaceId);
      expect(database.createAutomation).toHaveBeenCalledWith(expect.objectContaining({ workspaceId, igAccountId: accountId }));
      expect(database.updateAutomationStatus.mock.calls).toEqual([
        [automationId, workspaceId, 'live'], [automationId, workspaceId, 'paused'], [automationId, workspaceId, 'live']
      ]);
      expect(instagramOAuth.createAuthorizationUrl).toHaveBeenCalledWith(context);
      expect(instagramOAuth.completeAuthorization).toHaveBeenCalledWith({
        code: 'code', state: 'abcdefghijklmnopqrst', workspaceId, sessionId: context.sessionId
      });
    } finally { await app.close(); }
  });

  it.each([
    { method: 'GET', suffix: '', code: 'NOT_FOUND' },
    { method: 'GET', suffix: '/events', code: 'NOT_FOUND' },
    ...['publish', 'pause', 'resume'].map((action) => ({ method: 'POST', suffix: `/${action}`, code: 'NOT_FOUND' }))
  ])('returns a safe 404 for a foreign automation: $method $suffix', async ({ method, suffix, code }) => {
    const { app, database } = await setup();
    try {
      const response = await app.inject({ method: method as 'GET' | 'POST',
        url: `/v1/automations/${foreignId}${suffix}`, headers: headers() });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ code, message: 'Automation not found' });
      if (method === 'GET') expect(database.getAutomation).toHaveBeenCalledWith(foreignId, workspaceId);
      else expect(database.updateAutomationStatus).toHaveBeenCalledWith(foreignId, workspaceId, expect.any(String));
      expect(database.listTriggerEvents).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it('returns a safe 404 when creating against a foreign Instagram account', async () => {
    const { app, database } = await setup('editor');
    try {
      const response = await app.inject({ method: 'POST', url: '/v1/automations', headers: headers(),
        payload: { ...input, igAccountId: foreignId, workspaceId: foreignId } });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ code: 'ACCOUNT_NOT_FOUND', message: 'Instagram account not found' });
      expect(database.createAutomation).toHaveBeenCalledWith(expect.objectContaining({ igAccountId: foreignId, workspaceId }));
    } finally { await app.close(); }
  });
});
