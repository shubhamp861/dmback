import './http-test-setup.js';
import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { hashToken, type AuthContext } from '../src/auth.js';
import type { Config } from '../src/config.js';
import { encodeCursor, pageFromRows, parsePaginationQuery } from '../src/pagination.js';
import { registerRoutes } from '../src/routes.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const automationId = '22222222-2222-4222-8222-222222222222';
const csrfToken = 'valid-csrf-token';
const context: AuthContext = {
  sessionId: 'session-id', userId: 'user-id', email: 'test@example.com', workspaceId,
  role: 'owner', csrfTokenHash: hashToken(csrfToken)
};

describe('cursor pagination', () => {
  it('creates an opaque cursor and resumes after the last row', () => {
    const rows = [
      { id: '33333333-3333-4333-8333-333333333333', created_at: new Date('2026-10-21T12:00:00.000Z') },
      { id: '44444444-4444-4444-8444-444444444444', created_at: new Date('2026-10-21T11:00:00.000Z') },
      { id: '55555555-5555-4555-8555-555555555555', created_at: new Date('2026-10-21T10:00:00.000Z') }
    ];
    const page = pageFromRows(rows, { limit: 2 }, 'automations', workspaceId);
    expect(page.items).toHaveLength(2);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toEqual(expect.any(String));
    expect(parsePaginationQuery({ limit: '2', cursor: page.nextCursor }, 'automations', workspaceId)).toEqual({
      limit: 2,
      cursor: {
        v: 1,
        resource: 'automations',
        scopeId: workspaceId,
        createdAt: '2026-10-21T11:00:00.000Z',
        id: '44444444-4444-4444-8444-444444444444'
      }
    });
  });

  it.each([
    { query: { limit: '0' }, code: 'INVALID_PAGINATION' },
    { query: { limit: '101' }, code: 'INVALID_PAGINATION' },
    { query: { limit: '1.5' }, code: 'INVALID_PAGINATION' },
    { query: { cursor: '' }, code: 'INVALID_CURSOR' },
    { query: { cursor: 'not-a-cursor' }, code: 'INVALID_CURSOR' },
    { query: { other: 'value' }, code: 'INVALID_PAGINATION' }
  ])('rejects invalid query $query', ({ query, code }) => {
    expect(() => parsePaginationQuery(query, 'automations', workspaceId)).toThrow(expect.objectContaining({ code }));
  });

  it('returns pagination metadata from the automation route and passes the cursor to SQL', async () => {
    const nextCursor = encodeCursor({
      v: 1, resource: 'automations', scopeId: workspaceId,
      createdAt: '2026-10-21T10:00:00.000Z', id: automationId
    });
    const database = {
      listAutomations: vi.fn().mockResolvedValue({ items: [{ id: automationId }], nextCursor, hasMore: true }),
      listInstagramAccounts: vi.fn(),
      getAutomation: vi.fn(),
      listTriggerEvents: vi.fn()
    };
    const app = Fastify();
    await app.register(cookie);
    await registerRoutes(app, {
      config: { NODE_ENV: 'test', RATE_LIMIT_ENABLED: false } as Config,
      database: database as unknown as Parameters<typeof registerRoutes>[1]['database'],
      queue: {} as Parameters<typeof registerRoutes>[1]['queue'],
      auth: { authenticate: vi.fn().mockResolvedValue(context) } as unknown as Parameters<typeof registerRoutes>[1]['auth'],
      instagramOAuth: {} as Parameters<typeof registerRoutes>[1]['instagramOAuth']
    });
    try {
      const response = await app.inject({
        method: 'GET', url: `/v1/automations?limit=1&cursor=${encodeURIComponent(nextCursor)}`,
        headers: { cookie: 'session=valid-session' }
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        data: [{ id: automationId }],
        pagination: { nextCursor, hasMore: true }
      });
      expect(database.listAutomations).toHaveBeenCalledWith(workspaceId, {
        limit: 1,
        cursor: {
          v: 1, resource: 'automations', scopeId: workspaceId,
          createdAt: '2026-10-21T10:00:00.000Z', id: automationId
        }
      });
    } finally {
      await app.close();
    }
  });
});
