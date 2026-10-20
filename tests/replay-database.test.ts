import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn(), release: vi.fn() }));
vi.mock('pg', () => ({ default: { Pool: class {
  connect = async () => ({ query: mocks.query, release: mocks.release });
} } }));
import { Database } from '../src/db.js';

const workspaceId = 'workspace';
const input = { webhookEventId: 'event', workspaceId, actorUserId: 'actor' };
const ownEntry = { id: 'owned-ig', changes: [{ field: 'comments', value: { id: 'comment', text: 'synthetic text' } }] };
let storedPayload: unknown;
let memberships: unknown[];
let accounts: Array<{ ig_user_id: string; workspace_id: string }>;
let auditFailure: boolean;
let completed: boolean;

function statements() { return mocks.query.mock.calls.map(([sql]) => String(sql)); }

beforeEach(() => {
  vi.resetAllMocks();
  storedPayload = { object: 'instagram', entry: [ownEntry] };
  memberships = [{ role: 'owner' }];
  accounts = [{ ig_user_id: 'owned-ig', workspace_id: workspaceId }];
  auditFailure = false;
  completed = false;
  mocks.query.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM memberships')) return { rows: memberships };
    if (sql.includes('SELECT payload FROM webhook_events')) return { rows: storedPayload === undefined ? [] : [{ payload: storedPayload }] };
    if (sql.includes('FROM ig_accounts')) return { rows: accounts };
    if (sql.includes('INSERT INTO audit_log')) {
      if (auditFailure) throw new Error('synthetic audit failure');
      return { rows: [{ id: 'audit' }] };
    }
    if (sql.includes('FROM webhook_replays')) return { rows: [{ id: 'replay', webhookEventId: 'event', workspaceId, processed: completed }] };
    return { rows: [] };
  });
});

describe('replay transaction and payload validation', () => {
  it('creates a replay and minimal audit atomically after checking every account', async () => {
    const db = new Database('postgres://unused');
    const replay = await db.requestWebhookReplay(input);
    expect(replay).toMatchObject({ webhookEventId: 'event', status: 'pending' });
    const audit = mocks.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO audit_log'));
    expect(audit?.[1]).toEqual([workspaceId, 'actor', 'event', JSON.stringify({ replayId: replay?.id })]);
    expect(statements().at(-1)).toBe('COMMIT');
    expect(statements().findIndex((sql) => sql.includes('INSERT INTO audit_log')))
      .toBeLessThan(statements().findIndex((sql) => sql.includes('INSERT INTO webhook_replays')));
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it.each(['missing', 'malformed', 'unsupported', 'empty', 'unknown-account', 'mixed-workspaces', 'foreign', 'no-comments'])(
    'rejects %s without replay/audit writes', async (kind) => {
      if (kind === 'missing') storedPayload = undefined;
      if (kind === 'malformed') storedPayload = { object: 'instagram', entry: 'not-an-array' };
      if (kind === 'unsupported') storedPayload = { object: 'page', entry: [ownEntry] };
      if (kind === 'empty') storedPayload = { object: 'instagram', entry: [] };
      if (kind === 'no-comments') storedPayload = { object: 'instagram', entry: [{ id: 'owned-ig', changes: [] }] };
      if (kind === 'unknown-account') accounts = [];
      if (kind === 'foreign') accounts = [{ ig_user_id: 'owned-ig', workspace_id: 'foreign' }];
      if (kind === 'mixed-workspaces') {
        storedPayload = { object: 'instagram', entry: [ownEntry, { ...ownEntry, id: 'foreign-ig' }] };
        accounts.push({ ig_user_id: 'foreign-ig', workspace_id: 'foreign' });
      }
      const replay = await new Database('postgres://unused').requestWebhookReplay(input);
      expect(replay).toBeUndefined();
      expect(statements().at(-1)).toBe('ROLLBACK');
      expect(statements().some((sql) => sql.includes('INSERT INTO'))).toBe(false);
    });

  it('requires an eligible membership inside the write transaction, not only at the route', async () => {
    memberships = [];
    expect(await new Database('postgres://unused').requestWebhookReplay(input)).toBeUndefined();
    expect(statements().some((sql) => sql.includes('SELECT payload'))).toBe(false);
    expect(statements().some((sql) => sql.includes('INSERT INTO'))).toBe(false);
  });

  it('rolls back on audit failure rather than accepting an unaudited replay', async () => {
    auditFailure = true;
    await expect(new Database('postgres://unused').requestWebhookReplay(input)).rejects.toThrow('synthetic audit failure');
    expect(statements()).toContain('ROLLBACK');
    expect(statements()).not.toContain('COMMIT');
    expect(statements().some((sql) => sql.includes('INSERT INTO webhook_replays'))).toBe(false);
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it('revalidates stored payload/account ownership before replay processing', async () => {
    accounts[0]!.workspace_id = 'foreign';
    expect(await new Database('postgres://unused').getWebhookReplayForProcessing('replay')).toBeUndefined();
    expect(statements().at(-1)).toBe('ROLLBACK');
  });

  it('returns already processed requests for harmless acknowledgement without reading private payloads again', async () => {
    completed = true;
    expect(await new Database('postgres://unused').getWebhookReplayForProcessing('replay')).toMatchObject({ processed: true });
    expect(statements().some((sql) => sql.includes('SELECT payload'))).toBe(false);
    expect(statements().at(-1)).toBe('COMMIT');
  });

  it('does not claim an idempotency key or write a trigger if ownership changed before insertion', async () => {
    const result = await new Database('postgres://unused').insertTriggerEvent({
      igAccountId: 'account', automationId: 'automation', workspaceId, commentId: 'comment', commentText: 'synthetic', outcome: 'queued'
    });
    expect(result).toBe(false);
    expect(statements().at(-1)).toBe('ROLLBACK');
    expect(statements().some((sql) => sql.includes('INSERT INTO trigger'))).toBe(false);
  });
});
