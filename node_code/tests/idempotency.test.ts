import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  IdempotencyStore,
  fingerprintJson,
  isValidIdempotencyKey,
  sha256Fingerprint
} from '../src/idempotency.js';

const mocks = vi.hoisted(() => ({ query: vi.fn(), release: vi.fn() }));

function client() {
  return { query: mocks.query, release: mocks.release };
}

describe('idempotency helpers', () => {
  it('accepts printable ASCII keys and rejects whitespace, controls, and overlong keys', () => {
    expect(isValidIdempotencyKey('order-123/ABC')).toBe(true);
    expect(isValidIdempotencyKey('')).toBe(false);
    expect(isValidIdempotencyKey('has space')).toBe(false);
    expect(isValidIdempotencyKey('has\nnewline')).toBe(false);
    expect(isValidIdempotencyKey('é')).toBe(false);
    expect(isValidIdempotencyKey('x'.repeat(129))).toBe(false);
    expect(isValidIdempotencyKey('x'.repeat(128))).toBe(true);
  });

  it('computes stable SHA-256 request fingerprints', () => {
    expect(sha256Fingerprint('body')).toBe(
      '230d8358dc8e8890b4c58deeb62912ee2f20357ae92a5cc861b98e68fe31acb5'
    );
    expect(fingerprintJson({ action: 'create', value: 1 })).toBe(fingerprintJson({ action: 'create', value: 1 }));
  });
});

describe('idempotency database contract', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('inserts one new record transactionally', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'id-1' }] })
      .mockResolvedValueOnce({ rows: [] }); // COMMIT
    const pool = { connect: async () => client() };
    await expect(new IdempotencyStore(pool).beginIdempotency({
      workspaceId: 'workspace', userId: 'user', key: 'key', fingerprint: 'a'.repeat(64)
    })).resolves.toEqual({ kind: 'new', id: 'id-1' });
    expect(String(mocks.query.mock.calls[1]?.[0])).toContain('ON CONFLICT (workspace_id, user_id, key) DO NOTHING');
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it('replays completed records and conflicts on a different fingerprint', async () => {
    const pool = { connect: async () => client() };
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'id-1', request_fingerprint: 'a', status: 'completed', response_status: 201, response_body: { ok: true } }] })
      .mockResolvedValueOnce({ rows: [] });
    await expect(new IdempotencyStore(pool).beginIdempotency({ workspaceId: 'w', userId: 'u', key: 'k', fingerprint: 'a' }))
      .resolves.toEqual({ kind: 'replay', statusCode: 201, body: { ok: true } });

    vi.resetAllMocks();
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'id-1', request_fingerprint: 'b', status: 'completed', response_status: 201, response_body: { ok: true } }] })
      .mockResolvedValueOnce({ rows: [] });
    await expect(new IdempotencyStore(pool).beginIdempotency({ workspaceId: 'w', userId: 'u', key: 'k', fingerprint: 'a' }))
      .resolves.toEqual({ kind: 'conflict' });
  });

  it('completes and abandons only in-progress records', async () => {
    const pool = { query: mocks.query, connect: async () => client() };
    mocks.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await new IdempotencyStore(pool).completeIdempotency('id-1', 201, { ok: true });
    expect(mocks.query.mock.calls[0]?.[1]).toEqual(['id-1', 201, JSON.stringify({ ok: true })]);
    mocks.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await new IdempotencyStore(pool).abandonIdempotency('id-1');
    expect(String(mocks.query.mock.calls[1]?.[0])).toContain("status = 'in_progress'");
  });
});
