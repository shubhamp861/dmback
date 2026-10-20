import './http-test-setup.js';
import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { hashToken, type AuthContext } from '../src/auth.js';
import type { Config } from '../src/config.js';
import { registerRoutes } from '../src/routes.js';

const csrf = 'route-idempotency-csrf';
const context: AuthContext = {
  sessionId: 'session', userId: 'user', email: 'user@example.test', workspaceId: 'workspace',
  role: 'owner', csrfTokenHash: hashToken(csrf)
};
const accountId = '33333333-3333-4333-8333-333333333333';
const automationId = '44444444-4444-4444-8444-444444444444';
const input = { name: 'Idempotent automation', igAccountId: accountId, keywordRules: [{ value: 'guide' }] };

async function setup() {
  const app = Fastify();
  await app.register(cookie);
  const database = {
    createAutomation: vi.fn().mockResolvedValue({ id: automationId, name: input.name }),
    updateAutomationStatus: vi.fn().mockResolvedValue({ id: automationId, status: 'paused' }),
    requestWebhookReplay: vi.fn().mockResolvedValue({ id: 'replay', webhookEventId: automationId, status: 'pending' }),
    beginIdempotency: vi.fn().mockResolvedValue({ kind: 'new', id: 'idempotency-record' }),
    completeIdempotency: vi.fn().mockResolvedValue(undefined)
  };
  const auth = { authenticate: vi.fn().mockResolvedValue(context) };
  await app.register(registerRoutes, {
    config: { NODE_ENV: 'test' } as Config,
    database: database as unknown as Parameters<typeof registerRoutes>[1]['database'],
    queue: {} as Parameters<typeof registerRoutes>[1]['queue'],
    auth: auth as unknown as Parameters<typeof registerRoutes>[1]['auth'],
    instagramOAuth: {} as Parameters<typeof registerRoutes>[1]['instagramOAuth']
  });
  return { app, database };
}

function headers(key = 'create-automation-1') {
  return { cookie: `session=session; csrf_token=${csrf}`, 'x-csrf-token': csrf, 'idempotency-key': key };
}

describe('route idempotency contract', () => {
  it('stores the first automation mutation response', async () => {
    const { app, database } = await setup();
    try {
      const response = await app.inject({ method: 'POST', url: '/v1/automations', headers: headers(), payload: input });
      expect(response.statusCode).toBe(201);
      expect(database.beginIdempotency).toHaveBeenCalledOnce();
      expect(database.completeIdempotency).toHaveBeenCalledWith('idempotency-record', 201, response.json());
      expect(database.createAutomation).toHaveBeenCalledOnce();
    } finally { await app.close(); }
  });

  it('replays the stored response without calling the mutation service', async () => {
    const { app, database } = await setup();
    database.beginIdempotency.mockResolvedValueOnce({ kind: 'replay', statusCode: 201, body: { data: { id: automationId } } });
    try {
      const response = await app.inject({ method: 'POST', url: '/v1/automations', headers: headers(), payload: input });
      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual({ data: { id: automationId } });
      expect(database.createAutomation).not.toHaveBeenCalled();
      expect(database.completeIdempotency).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it('rejects a reused key when the request is conflicting or still in progress', async () => {
    const { app, database } = await setup();
    database.beginIdempotency.mockResolvedValueOnce({ kind: 'conflict' });
    try {
      const response = await app.inject({ method: 'POST', url: '/v1/automations', headers: headers(), payload: { ...input, name: 'different' } });
      expect(response.statusCode).toBe(409);
      expect(response.json().code).toBe('IDEMPOTENCY_CONFLICT');
      expect(database.createAutomation).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it('rejects invalid keys before database mutation work', async () => {
    const { app, database } = await setup();
    try {
      const response = await app.inject({ method: 'POST', url: '/v1/automations', headers: headers('has space'), payload: input });
      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe('INVALID_IDEMPOTENCY_KEY');
      expect(database.beginIdempotency).not.toHaveBeenCalled();
      expect(database.createAutomation).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it('supports replay requests with the same contract', async () => {
    const { app, database } = await setup();
    try {
      const response = await app.inject({ method: 'POST', url: `/v1/webhook-events/${automationId}/replay`, headers: headers('replay-1') });
      expect(response.statusCode).toBe(202);
      expect(database.requestWebhookReplay).toHaveBeenCalledOnce();
      expect(database.completeIdempotency).toHaveBeenCalledWith('idempotency-record', 202, response.json());
    } finally { await app.close(); }
  });
});
