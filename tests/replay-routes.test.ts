import './http-test-setup.js';
import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { hashToken } from '../src/auth.js';
import type { Config } from '../src/config.js';
import { registerSafeErrorHandlers } from '../src/logging.js';
import { registerRoutes } from '../src/routes.js';

const eventId = '11111111-1111-4111-8111-111111111111';
const workspaceId = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';
const replayId = '44444444-4444-4444-8444-444444444444';
const csrf = 'synthetic-csrf';
const url = `/v1/webhook-events/${eventId}/replay`;

async function setup(role = 'owner', authenticated = true) {
  const app = Fastify();
  await app.register(cookie);
  registerSafeErrorHandlers(app);
  const database = { requestWebhookReplay: vi.fn().mockResolvedValue({ id: replayId, webhookEventId: eventId, status: 'pending' }) };
  const queue = { enqueueMatch: vi.fn(), enqueueReplay: vi.fn() };
  const authenticate = vi.fn().mockResolvedValue(authenticated ? { role, workspaceId, userId, csrfTokenHash: hashToken(csrf) } : undefined);
  app.register(registerRoutes, {
    config: { NODE_ENV: 'test' } as Config,
    database: database as unknown as Parameters<typeof registerRoutes>[1]['database'],
    queue: queue as unknown as Parameters<typeof registerRoutes>[1]['queue'],
    auth: { authenticate } as unknown as Parameters<typeof registerRoutes>[1]['auth'],
    instagramOAuth: {} as Parameters<typeof registerRoutes>[1]['instagramOAuth']
  });
  return { app, database, queue };
}

function headers() { return { cookie: `session=synthetic-session; csrf_token=${csrf}`, 'x-csrf-token': csrf }; }

describe('audited webhook replay endpoint', () => {
  it.each(['owner', 'admin', 'editor', 'viewer', 'unknown', '__proto__'])('enforces role policy for %s', async (role) => {
    const { app, database, queue } = await setup(role);
    try {
      const response = await app.inject({ method: 'POST', url, headers: headers() });
      const allowed = role === 'owner' || role === 'admin';
      expect(response.statusCode).toBe(allowed ? 202 : 403);
      if (allowed) {
        expect(response.json()).toEqual({ data: { id: replayId, webhookEventId: eventId, status: 'pending' } });
        expect(database.requestWebhookReplay).toHaveBeenCalledExactlyOnceWith({ webhookEventId: eventId, workspaceId, actorUserId: userId });
      } else expect(database.requestWebhookReplay).not.toHaveBeenCalled();
      // Acceptance relies on the committed outbox, not immediate Redis availability.
      expect(queue.enqueueMatch).not.toHaveBeenCalled();
      expect(queue.enqueueReplay).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it('rejects unauthenticated requests before any replay or audit work', async () => {
    const { app, database } = await setup('owner', false);
    try {
      expect((await app.inject({ method: 'POST', url })).statusCode).toBe(401);
      expect(database.requestWebhookReplay).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it.each([
    { cookie: `session=synthetic-session; csrf_token=${csrf}` },
    { cookie: 'session=synthetic-session', 'x-csrf-token': csrf },
    { cookie: `session=synthetic-session; csrf_token=${csrf}`, 'x-csrf-token': 'wrong' },
    { cookie: 'session=synthetic-session; csrf_token=wrong', 'x-csrf-token': 'wrong' }
  ])('requires cookie, header and session CSRF agreement', async (requestHeaders) => {
    const { app, database } = await setup();
    try {
      const response = await app.inject({ method: 'POST', url, headers: requestHeaders });
      expect(response.statusCode).toBe(403);
      expect(response.json().code).toBe('CSRF_INVALID');
      expect(database.requestWebhookReplay).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it('returns the same safe 404 when no exclusively owned replayable event exists', async () => {
    const { app, database } = await setup();
    database.requestWebhookReplay.mockResolvedValueOnce(undefined);
    try {
      const response = await app.inject({ method: 'POST', url, headers: headers() });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ code: 'NOT_FOUND', message: 'Replayable webhook event not found' });
    } finally { await app.close(); }
  });

  it.each([{ workspaceId: 'foreign' }, { actorUserId: 'foreign' }, { payload: 'PRIVATE_PAYLOAD' }])('rejects client-supplied replay overrides', async (payload) => {
    const { app, database } = await setup();
    try {
      expect((await app.inject({ method: 'POST', url, headers: headers(), payload })).statusCode).toBe(400);
      expect(database.requestWebhookReplay).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it('rejects malformed event IDs without reaching persistence', async () => {
    const { app, database } = await setup();
    try {
      expect((await app.inject({ method: 'POST', url: '/v1/webhook-events/not-a-uuid/replay', headers: headers() })).statusCode).toBe(400);
      expect(database.requestWebhookReplay).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it('never reports acceptance when the replay/audit transaction fails', async () => {
    const { app, database } = await setup();
    database.requestWebhookReplay.mockRejectedValueOnce(new Error('PRIVATE_DATABASE_DIAGNOSTIC'));
    try {
      const response = await app.inject({ method: 'POST', url, headers: headers() });
      expect(response.statusCode).toBe(500);
      expect(response.body).not.toContain('PRIVATE_DATABASE_DIAGNOSTIC');
    } finally { await app.close(); }
  });
});
