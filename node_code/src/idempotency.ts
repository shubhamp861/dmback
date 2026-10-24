import { createHash } from 'node:crypto';
import type { QueryResult, QueryResultRow } from 'pg';

export type IdempotencyBody = unknown;

export interface BeginIdempotencyInput {
  workspaceId: string;
  userId: string;
  key: string;
  fingerprint: string;
}

export type BeginIdempotencyResult =
  | { kind: 'new'; id: string }
  | { kind: 'replay'; statusCode: number; body: IdempotencyBody }
  | { kind: 'conflict' };

export function isValidIdempotencyKey(key: string): boolean {
  return typeof key === 'string' && key.length >= 1 && key.length <= 128 && /^[\x21-\x7e]+$/.test(key);
}

export function assertValidIdempotencyKey(key: string): void {
  if (!isValidIdempotencyKey(key)) {
    throw new Error('Invalid Idempotency-Key');
  }
}

export function sha256Fingerprint(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function fingerprintJson(value: unknown): string {
  return sha256Fingerprint(JSON.stringify(value) ?? 'undefined');
}

interface IdempotencyClient {
  query<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<T>>;
  release(): void;
}

interface IdempotencyPool {
  connect(): Promise<IdempotencyClient>;
  query?<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<T>>;
}

export interface IdempotencyCleanupOptions {
  /** Completed records older than this are deleted. */
  retentionHours: number;
  /** In-progress records older than this are treated as abandoned and deleted. */
  staleInProgressMinutes: number;
}

export class IdempotencyStore {
  constructor(private readonly pool: IdempotencyPool) {}

  async beginIdempotency(input: BeginIdempotencyInput): Promise<BeginIdempotencyResult> {
    assertValidIdempotencyKey(input.key);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO idempotency_keys
           (workspace_id, user_id, key, request_fingerprint, status)
         VALUES ($1, $2, $3, $4, 'in_progress')
         ON CONFLICT (workspace_id, user_id, key) DO NOTHING
         RETURNING id`,
        [input.workspaceId, input.userId, input.key, input.fingerprint]
      );
      const newRow = inserted.rows[0];
      if (newRow) {
        await client.query('COMMIT');
        return { kind: 'new', id: newRow.id };
      }

      const existing = await client.query<{
        id: string;
        request_fingerprint: string;
        status: 'in_progress' | 'completed';
        response_status: number | null;
        response_body: IdempotencyBody;
      }>(
        `SELECT id, request_fingerprint, status, response_status, response_body
           FROM idempotency_keys
          WHERE workspace_id = $1 AND user_id = $2 AND key = $3
          FOR UPDATE`,
        [input.workspaceId, input.userId, input.key]
      );
      const row = existing.rows[0];
      if (!row || row.request_fingerprint !== input.fingerprint || row.status !== 'completed' || row.response_status === null) {
        await client.query('ROLLBACK');
        return { kind: 'conflict' };
      }
      await client.query('COMMIT');
      return { kind: 'replay', statusCode: row.response_status, body: row.response_body };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async completeIdempotency(id: string, statusCode: number, body: IdempotencyBody): Promise<void> {
    const result = await this.poolQuery(
      `UPDATE idempotency_keys
          SET status = 'completed', response_status = $2, response_body = $3::jsonb,
              completed_at = now(), updated_at = now()
        WHERE id = $1 AND status = 'in_progress'`,
      [id, statusCode, body === undefined ? null : JSON.stringify(body)]
    );
    if (result.rowCount !== 1) throw new Error('Idempotency record is not in progress');
  }

  async abandonIdempotency(id: string): Promise<void> {
    await this.poolQuery(
      `DELETE FROM idempotency_keys WHERE id = $1 AND status = 'in_progress'`,
      [id]
    );
  }

  async failIdempotency(id: string): Promise<void> {
    await this.abandonIdempotency(id);
  }

  /** Deletes expired completed records and stuck in-progress records; returns the deleted count. */
  async cleanupIdempotencyKeys(options: IdempotencyCleanupOptions): Promise<number> {
    const result = await this.poolQuery(
      `DELETE FROM idempotency_keys
        WHERE (status = 'completed' AND created_at < now() - ($1::int * interval '1 hour'))
           OR (status = 'in_progress' AND created_at < now() - ($2::int * interval '1 minute'))`,
      [options.retentionHours, options.staleInProgressMinutes]
    );
    return result.rowCount ?? 0;
  }

  private async poolQuery(text: string, values: unknown[]): Promise<QueryResult> {
    // Kept behind this small adapter so tests can mock only the pool surface used here.
    if (!this.pool.query) throw new Error('Idempotency pool query is unavailable');
    return this.pool.query(text, values);
  }
}
