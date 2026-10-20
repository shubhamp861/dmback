import { randomUUID } from 'node:crypto';
import pg from 'pg';
import type { PoolClient } from 'pg';
import type { AutomationForMatching } from './domain/automation.js';
import type { InstagramWebhookPayload } from './instagram/webhook.js';
import { extractCommentEvents, instagramWebhookSchema } from './instagram/webhook.js';
import { MATCH_COMMENT_QUEUE } from './queue.js';

const { Pool } = pg;

export interface WebhookEventRecord {
  id: string;
  duplicate: boolean;
}

export interface WebhookOutboxRecord {
  webhookEventId: string;
  queueName: string;
  jobId: string;
}

export interface WebhookReplayRecord {
  id: string;
  webhookEventId: string;
  workspaceId: string;
}

export interface InstagramOAuthStateRecord {
  userId: string;
  workspaceId: string;
  sessionId: string;
  redirectUri: string;
}

export interface InstagramAccountRecord {
  id: string;
  workspaceId: string;
  igUserId: string;
  username: string;
  accountType: string | null;
  profilePictureUrl: string | null;
  permissions: string[];
  status: string;
  tokenExpiresAt: string | null;
}

export interface AutomationRecord extends AutomationForMatching {
  publicReplies: string[];
  flowId: string | null;
}

export class Database {
  readonly pool: pg.Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl, max: 10,
      connectionTimeoutMillis: 2000,
      query_timeout: 5000,
      statement_timeout: 5000,
      idle_in_transaction_session_timeout: 10000
    });
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async healthcheck(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async insertWebhookEvent(payload: InstagramWebhookPayload, payloadHash: string): Promise<WebhookEventRecord> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<{ id: string; inserted: boolean }>(
        `INSERT INTO webhook_events (object_type, payload, payload_hash)
         VALUES ($1, $2::jsonb, $3)
         ON CONFLICT (payload_hash) DO UPDATE SET payload_hash = EXCLUDED.payload_hash
         RETURNING id, (xmax = 0) AS inserted`,
        [payload.object, JSON.stringify(payload), payloadHash]
      );

      const row = result.rows[0];
      if (!row) throw new Error('Webhook event was not persisted');
      await client.query(
        `INSERT INTO webhook_event_outbox (webhook_event_id, queue_name, job_id)
          VALUES ($1, $2, $3)
          ON CONFLICT (webhook_event_id) DO NOTHING`,
        [row.id, MATCH_COMMENT_QUEUE, row.id]
      );
      await client.query('COMMIT');
      return { id: row.id, duplicate: !row.inserted };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async claimWebhookOutbox(limit = 25): Promise<WebhookOutboxRecord[]> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<WebhookOutboxRecord>(
        `WITH candidates AS (
           SELECT id
           FROM webhook_event_outbox
           WHERE (status IN ('pending', 'failed') AND available_at <= now())
              OR (status = 'dispatching' AND claimed_at < now() - interval '5 minutes')
           ORDER BY created_at
           FOR UPDATE SKIP LOCKED
           LIMIT $1
         )
         UPDATE webhook_event_outbox outbox
         SET status = 'dispatching', claimed_at = now(), attempts = outbox.attempts + 1,
             updated_at = now()
         FROM candidates
         WHERE outbox.id = candidates.id
         RETURNING outbox.webhook_event_id AS "webhookEventId",
                   outbox.queue_name AS "queueName", outbox.job_id AS "jobId"`,
        [limit]
      );
      await client.query('COMMIT');
      return result.rows;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async markWebhookDispatched(webhookEventId: string): Promise<void> {
    await this.pool.query(
      `UPDATE webhook_event_outbox
       SET status = 'dispatched', dispatched_at = now(), claimed_at = NULL,
           last_error = NULL, updated_at = now()
       WHERE webhook_event_id = $1`,
      [webhookEventId]
    );
  }

  async markWebhookDispatchFailed(webhookEventId: string, errorMessage: string, retryAfterSeconds = 5): Promise<void> {
    await this.pool.query(
      `UPDATE webhook_event_outbox
       SET status = 'failed', claimed_at = NULL,
           available_at = now() + ($2::text || ' seconds')::interval,
           last_error = left($3, 2000), updated_at = now()
       WHERE webhook_event_id = $1`,
      [webhookEventId, retryAfterSeconds, errorMessage]
    );
  }

  async requestWebhookReplay(input: {
    webhookEventId: string;
    workspaceId: string;
    actorUserId: string;
  }): Promise<{ id: string; webhookEventId: string; status: 'pending' } | undefined> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const membership = await client.query(
        `SELECT role FROM memberships
         WHERE workspace_id = $1 AND user_id = $2 AND role IN ('owner', 'admin')
         FOR SHARE`,
        [input.workspaceId, input.actorUserId]
      );
      if (!membership.rows[0] || !await this.webhookBelongsToWorkspace(client, input.webhookEventId, input.workspaceId)) {
        await client.query('ROLLBACK');
        return undefined;
      }

      const id = randomUUID();
      const audit = await client.query<{ id: string }>(
        `INSERT INTO audit_log (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'webhook.replay.requested', 'webhook_event', $3, $4::jsonb)
         RETURNING id`,
        [input.workspaceId, input.actorUserId, input.webhookEventId, JSON.stringify({ replayId: id })]
      );
      const auditRow = audit.rows[0];
      if (!auditRow) throw new Error('Webhook replay audit was not persisted');
      await client.query(
        `INSERT INTO webhook_replays (id, webhook_event_id, workspace_id, actor_user_id, audit_log_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, input.webhookEventId, input.workspaceId, input.actorUserId, auditRow.id]
      );
      await client.query('COMMIT');
      return { id, webhookEventId: input.webhookEventId, status: 'pending' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async claimWebhookReplays(limit = 25): Promise<WebhookReplayRecord[]> {
    const result = await this.pool.query<WebhookReplayRecord>(
      `WITH candidates AS (
         SELECT id FROM webhook_replays
         WHERE (dispatch_status IN ('pending', 'failed') AND available_at <= now())
            OR (dispatch_status = 'dispatching' AND claimed_at < now() - interval '5 minutes')
         ORDER BY created_at, id
         FOR UPDATE SKIP LOCKED
         LIMIT $1
       )
       UPDATE webhook_replays replay
       SET dispatch_status = 'dispatching', claimed_at = now(),
           attempts = replay.attempts + 1, updated_at = now()
       FROM candidates WHERE replay.id = candidates.id
       RETURNING replay.id, replay.webhook_event_id AS "webhookEventId", replay.workspace_id AS "workspaceId"`,
      [limit]
    );
    return result.rows;
  }

  async markWebhookReplayDispatched(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE webhook_replays
       SET dispatch_status = 'dispatched', dispatched_at = now(), claimed_at = NULL,
           last_error = NULL, updated_at = now()
       WHERE id = $1 AND dispatch_status = 'dispatching' AND dispatched_at IS NULL`,
      [id]
    );
  }

  async markWebhookReplayDispatchFailed(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE webhook_replays
       SET dispatch_status = 'failed', claimed_at = NULL, available_at = now() + interval '5 seconds',
           last_error = 'QUEUE_DISPATCH_FAILED', updated_at = now()
       WHERE id = $1 AND dispatch_status = 'dispatching' AND dispatched_at IS NULL`,
      [id]
    );
  }

  async getWebhookReplayForProcessing(id: string): Promise<(WebhookReplayRecord & { processed: boolean }) | undefined> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<WebhookReplayRecord & { processed: boolean }>(
        `SELECT id, webhook_event_id AS "webhookEventId", workspace_id AS "workspaceId",
                (processing_status = 'processed') AS processed
         FROM webhook_replays WHERE id = $1 FOR SHARE`,
        [id]
      );
      const replay = result.rows[0];
      if (!replay || (!replay.processed && !await this.webhookBelongsToWorkspace(client, replay.webhookEventId, replay.workspaceId))) {
        await client.query('ROLLBACK');
        return undefined;
      }
      await client.query('COMMIT');
      return replay;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async markWebhookReplayProcessed(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE webhook_replays SET processing_status = 'processed', processed_at = now(),
           last_processing_error = NULL, updated_at = now()
       WHERE id = $1 AND processing_status <> 'processed'`,
      [id]
    );
  }

  async markWebhookReplayProcessingFailed(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE webhook_replays SET processing_status = 'failed',
           last_processing_error = 'WEBHOOK_PROCESSING_FAILED', updated_at = now()
       WHERE id = $1 AND processing_status <> 'processed'`,
      [id]
    );
  }

  private async webhookBelongsToWorkspace(client: PoolClient, eventId: string, workspaceId: string): Promise<boolean> {
    // Hold payload and ownership stable until the request/read transaction commits.
    const event = await client.query<{ payload: unknown }>(
      'SELECT payload FROM webhook_events WHERE id = $1 FOR SHARE', [eventId]
    );
    const parsed = instagramWebhookSchema.safeParse(event.rows[0]?.payload);
    if (!parsed.success || parsed.data.object !== 'instagram' || parsed.data.entry.length === 0) return false;
    const accountIds = [...new Set(parsed.data.entry.map((entry) => entry.id))];
    if (accountIds.some((accountId) => !accountId.trim())) return false;
    const comments = extractCommentEvents(parsed.data);
    if (comments.length === 0 || comments.some((comment) => !comment.commentId.trim())) return false;
    const accounts = await client.query<{ ig_user_id: string; workspace_id: string }>(
      `SELECT ig_user_id, workspace_id FROM ig_accounts
       WHERE ig_user_id = ANY($1::text[]) ORDER BY ig_user_id FOR SHARE`,
      [accountIds]
    );
    return accounts.rows.length === accountIds.length && accounts.rows.every((account) => account.workspace_id === workspaceId);
  }

  async createInstagramOAuthState(input: {
    userId: string;
    workspaceId: string;
    sessionId: string;
    stateHash: string;
    redirectUri: string;
    expiresInSeconds: number;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO instagram_oauth_states
         (user_id, workspace_id, session_id, state_hash, redirect_uri, expires_at)
       VALUES ($1, $2, $3, $4, $5, now() + ($6::text || ' seconds')::interval)`,
      [input.userId, input.workspaceId, input.sessionId, input.stateHash, input.redirectUri, input.expiresInSeconds]
    );
  }

  async consumeInstagramOAuthState(stateHash: string, sessionId: string): Promise<InstagramOAuthStateRecord | undefined> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<InstagramOAuthStateRecord>(
        `SELECT user_id AS "userId", workspace_id AS "workspaceId", session_id AS "sessionId",
                redirect_uri AS "redirectUri"
         FROM instagram_oauth_states
         WHERE state_hash = $1 AND session_id = $2 AND consumed_at IS NULL AND expires_at > now()
         FOR UPDATE`,
        [stateHash, sessionId]
      );
      const state = result.rows[0];
      if (!state) {
        await client.query('ROLLBACK');
        return undefined;
      }
      await client.query('UPDATE instagram_oauth_states SET consumed_at = now() WHERE state_hash = $1', [stateHash]);
      await client.query('COMMIT');
      return state;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async upsertInstagramAccount(input: {
    workspaceId: string;
    igUserId: string;
    username: string;
    accountType: string | null;
    profilePictureUrl: string | null;
    tokenCiphertext: Buffer;
    tokenExpiresAt: Date | null;
    permissions: string[];
  }): Promise<InstagramAccountRecord | undefined> {
    const result = await this.pool.query<InstagramAccountRecord>(
      `INSERT INTO ig_accounts
         (workspace_id, ig_user_id, username, account_type, profile_picture_url,
          token_ciphertext, token_expires_at, permissions, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
       ON CONFLICT (ig_user_id) DO UPDATE SET
         username = EXCLUDED.username,
         account_type = EXCLUDED.account_type,
         profile_picture_url = EXCLUDED.profile_picture_url,
         token_ciphertext = EXCLUDED.token_ciphertext,
         token_expires_at = EXCLUDED.token_expires_at,
         permissions = EXCLUDED.permissions,
         status = 'active',
         updated_at = now()
       WHERE ig_accounts.workspace_id = EXCLUDED.workspace_id
       RETURNING id, workspace_id AS "workspaceId", ig_user_id AS "igUserId",
                 username, account_type AS "accountType", profile_picture_url AS "profilePictureUrl",
                 permissions, status, token_expires_at AS "tokenExpiresAt"`,
      [input.workspaceId, input.igUserId, input.username, input.accountType,
        input.profilePictureUrl, input.tokenCiphertext, input.tokenExpiresAt, input.permissions]
    );
    return result.rows[0];
  }

  async listInstagramAccounts(workspaceId: string): Promise<InstagramAccountRecord[]> {
    const result = await this.pool.query<InstagramAccountRecord>(
      `SELECT id, workspace_id AS "workspaceId", ig_user_id AS "igUserId", username,
              account_type AS "accountType", profile_picture_url AS "profilePictureUrl",
              permissions, status, token_expires_at AS "tokenExpiresAt"
       FROM ig_accounts WHERE workspace_id = $1 ORDER BY created_at DESC`,
      [workspaceId]
    );
    return result.rows;
  }

  async markWebhookProcessed(eventId: string): Promise<void> {
    await this.pool.query('UPDATE webhook_events SET processed_at = now() WHERE id = $1', [eventId]);
  }

  async getWebhookPayload(eventId: string): Promise<InstagramWebhookPayload | undefined> {
    const result = await this.pool.query<{ payload: InstagramWebhookPayload }>(
      'SELECT payload FROM webhook_events WHERE id = $1',
      [eventId]
    );
    return result.rows[0]?.payload;
  }

  async listLiveAutomations(igUserId: string, workspaceId?: string): Promise<AutomationRecord[]> {
    const result = await this.pool.query({
      text: `SELECT a.id, a.ig_account_id, a.status, a.keyword_rules, a.settings,
                    a.public_replies, a.flow_id
             FROM automations a
             JOIN ig_accounts account ON account.id = a.ig_account_id
              WHERE account.ig_user_id = $1 AND a.status = 'live'
                AND ($2::uuid IS NULL OR account.workspace_id = $2)`,
      values: [igUserId, workspaceId ?? null]
    });

    return result.rows.map((row) => {
      const settings = asRecord(row.settings);
      const exclusions = Array.isArray(settings.exclusions) ? settings.exclusions : [];
      return {
        id: row.id as string,
        igAccountId: row.ig_account_id as string,
        status: row.status as AutomationForMatching['status'],
        keywordRules: Array.isArray(row.keyword_rules) ? row.keyword_rules : [],
        exclusions,
        publicReplies: Array.isArray(row.public_replies) ? row.public_replies : [],
        flowId: (row.flow_id as string | null) ?? null
      };
    });
  }

  async insertTriggerEvent(input: {
    igAccountId: string;
    automationId: string;
    workspaceId?: string;
    commentId: string;
    commentText: string;
    matchedKeyword?: string;
    outcome: 'sent' | 'skipped' | 'failed' | 'queued';
    reasonCode?: string;
  }): Promise<boolean> {
    const idempotencyKey = `${input.igAccountId}:${input.commentId}:${input.automationId}`;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      if (input.workspaceId !== undefined) {
        // Recheck under the write transaction: ownership may have changed since
        // a replay's automation lookup. Do not write a foreign trigger or claim.
        const owned = await client.query(
          `SELECT a.id FROM automations a JOIN ig_accounts account ON account.id = a.ig_account_id
           WHERE a.id = $1 AND account.id = $2 AND account.workspace_id = $3
           FOR SHARE OF a, account`,
          [input.automationId, input.igAccountId, input.workspaceId]
        );
        if (!owned.rows[0]) { await client.query('ROLLBACK'); return false; }
      }
      const keyResult = await client.query<{ trigger_event_id: string }>(
        `INSERT INTO trigger_event_idempotency (idempotency_key, trigger_event_id)
         VALUES ($1, gen_random_uuid())
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING trigger_event_id`,
        [idempotencyKey]
      );

      const keyRow = keyResult.rows[0];
      if (!keyRow) {
        await client.query('ROLLBACK');
        return false;
      }

      await client.query(
        `INSERT INTO trigger_events
          (id, ig_account_id, automation_id, comment_id, comment_text, matched_keyword,
           outcome, reason_code, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [keyRow.trigger_event_id, input.igAccountId, input.automationId, input.commentId,
          input.commentText, input.matchedKeyword ?? null, input.outcome,
          input.reasonCode ?? null, idempotencyKey]
      );
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async createAutomation(input: {
    workspaceId: string;
    igAccountId: string;
    name: string;
    keywordRules: unknown;
    exclusions: unknown;
    publicReplies: unknown;
    flowId: string | null;
    settings: unknown;
  }): Promise<Record<string, unknown> | undefined> {
    const result = await this.pool.query(
      `INSERT INTO automations
        (ig_account_id, name, keyword_rules, public_replies, flow_id, settings)
       SELECT $1, $3, $4::jsonb, $5::jsonb, $6, $7::jsonb
       FROM ig_accounts
       WHERE id = $1 AND workspace_id = $2
       RETURNING *`,
      [input.igAccountId, input.workspaceId, input.name, JSON.stringify(input.keywordRules),
        JSON.stringify(input.publicReplies), input.flowId,
        JSON.stringify({ ...asRecord(input.settings), exclusions: input.exclusions })]
    );
    return result.rows[0] as Record<string, unknown> | undefined;
  }

  async getAutomation(id: string, workspaceId: string): Promise<Record<string, unknown> | undefined> {
    const result = await this.pool.query(
      `SELECT a.* FROM automations a
       JOIN ig_accounts account ON account.id = a.ig_account_id
       WHERE a.id = $1 AND account.workspace_id = $2`,
      [id, workspaceId]
    );
    return result.rows[0] as Record<string, unknown> | undefined;
  }

  async listAutomations(workspaceId: string): Promise<Record<string, unknown>[]> {
    const result = await this.pool.query(
      `SELECT a.* FROM automations a
       JOIN ig_accounts account ON account.id = a.ig_account_id
       WHERE account.workspace_id = $1
       ORDER BY a.created_at DESC`,
      [workspaceId]
    );
    return result.rows as Record<string, unknown>[];
  }

  async listTriggerEvents(automationId: string, workspaceId: string): Promise<Record<string, unknown>[]> {
    const result = await this.pool.query(
      `SELECT events.id, events.ig_account_id, events.automation_id, events.comment_id, events.comment_text,
              events.matched_keyword, events.outcome, events.reason_code, events.attempts,
              events.created_at, events.sent_at
       FROM trigger_events events
       JOIN automations a ON a.id = events.automation_id
       JOIN ig_accounts account ON account.id = a.ig_account_id
       WHERE events.automation_id = $1 AND account.workspace_id = $2
       ORDER BY events.created_at DESC`,
      [automationId, workspaceId]
    );
    return result.rows as Record<string, unknown>[];
  }

  async updateAutomationStatus(id: string, workspaceId: string, status: 'live' | 'paused'): Promise<Record<string, unknown> | undefined> {
    const result = await this.pool.query(
      `UPDATE automations a SET status = $3, updated_at = now()
       FROM ig_accounts account
       WHERE a.id = $1 AND account.id = a.ig_account_id AND account.workspace_id = $2
       RETURNING a.*`,
      [id, workspaceId, status]
    );
    return result.rows[0] as Record<string, unknown> | undefined;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
