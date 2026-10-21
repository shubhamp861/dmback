import { createHmac, randomUUID } from 'node:crypto';
import { Worker } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { BullMqEventQueue, MATCH_COMMENT_QUEUE, type MatchCommentJob } from '../../src/queue.js';
import { dispatchWebhookOutbox, dispatchWebhookReplays, processWebhookEvent, processWebhookReplay } from '../../src/processing.js';
import { parsePaginationQuery } from '../../src/pagination.js';
import { createIntegrationContext, eventually } from './helpers.js';

describe('real PostgreSQL, Redis, Fastify and worker integration', () => {
  let context: Awaited<ReturnType<typeof createIntegrationContext>>;
  let app: ReturnType<typeof buildApp>;
  let producer: BullMqEventQueue;
  let worker: Worker<MatchCommentJob>;
  const workerErrors: Error[] = [];
  let owner: { workspaceId: string; cookie: string; csrf: string };
  let other: typeof owner;
  let accountId: string;
  let automationId: string;
  const igUserId = `integration-ig-${randomUUID()}`;

  async function signup() {
    const response = await app.inject({ method: 'POST', url: '/v1/auth/signup', payload: {
      email: `${randomUUID()}@example.test`, password: 'integration-only-password', workspaceName: 'Integration workspace'
    } });
    expect(response.statusCode).toBe(201);
    const cookies = response.cookies;
    const csrf = cookies.find((cookie) => cookie.name === 'csrf_token')?.value;
    expect(csrf).toBeTruthy();
    return {
      workspaceId: response.json().data.workspaceId as string,
      cookie: cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; '), csrf: csrf!
    };
  }

  function payload(commentId: string, time = 1) {
    return { object: 'instagram', entry: [{ id: igUserId, time, changes: [
      { field: 'comments', value: { id: commentId, text: 'guide please', from: { id: 'synthetic-contact' } } }
    ] }] };
  }

  async function sendWebhook(body: ReturnType<typeof payload>, valid = true) {
    const raw = JSON.stringify(body);
    const signature = createHmac('sha256', context.config.META_APP_SECRET).update(raw).digest('hex');
    return app.inject({ method: 'POST', url: '/v1/webhooks/instagram', payload: raw,
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': `sha256=${valid ? signature : '0'.repeat(64)}` } });
  }

  async function eventsFor(commentId: string) {
    return (await context.database.pool.query('SELECT * FROM trigger_events WHERE comment_id = $1', [commentId])).rows;
  }

  async function waitProcessed(commentId: string, webhookCount: number) {
    await eventually(async () => {
      const result = await context.database.pool.query(
        `SELECT count(*)::int AS total, count(processed_at)::int AS processed
         FROM webhook_events WHERE payload->'entry'->0->'changes'->0->'value'->>'id' = $1`, [commentId]);
      expect(result.rows[0]).toEqual({ total: webhookCount, processed: webhookCount });
    });
  }

  beforeAll(async () => {
    context = await createIntegrationContext();
    app = buildApp(context.config);
    producer = new BullMqEventQueue(context.config, () => {});
    worker = new Worker<MatchCommentJob>(MATCH_COMMENT_QUEUE,
      (job) => job.data.replayId !== undefined
        ? processWebhookReplay(context.database, job.data.replayId)
        : processWebhookEvent(context.database, job.data.webhookEventId),
      { connection: { url: context.redisUrl }, prefix: context.prefix, concurrency: 8 });
    worker.on('error', (error) => workerErrors.push(error));
    worker.on('failed', (_job, error) => workerErrors.push(error));
    await worker.waitUntilReady();
    await eventually(async () => {
      expect((await app.inject('/ready')).statusCode).toBe(200);
      await producer.healthcheck();
    });
    owner = await signup();
    other = await signup();
    const account = await context.database.pool.query(
      `INSERT INTO ig_accounts(workspace_id, ig_user_id, username, status)
       VALUES ($1, $2, 'integration_account', 'active') RETURNING id`, [owner.workspaceId, igUserId]);
    accountId = account.rows[0].id as string;
    const automation = await context.database.pool.query(
      `INSERT INTO automations(ig_account_id, name, status, keyword_rules)
       VALUES ($1, 'Integration guide', 'live', '[{"value":"guide","mode":"contains"}]') RETURNING id`, [accountId]);
    automationId = automation.rows[0].id as string;
  });

  afterAll(async () => {
    // Close worker/app-owned pools before deleting only this suite's schema/queue.
    try { await worker?.close(); }
    finally {
      try { await producer?.close(); }
      finally {
        try { await app?.close(); }
        finally { await context?.close(); }
      }
    }
    expect(workerErrors).toEqual([]);
  });

  it('rejects invalid signatures without persisting a webhook', async () => {
    const commentId = randomUUID();
    expect((await sendWebhook(payload(commentId), false)).statusCode).toBe(401);
    const result = await context.database.pool.query(
      `SELECT count(*)::int AS total FROM webhook_events
       WHERE payload->'entry'->0->'changes'->0->'value'->>'id' = $1`, [commentId]);
    expect(result.rows[0].total).toBe(0);
  });

  it('deduplicates concurrent identical signed deliveries and persists one queued match', async () => {
    const commentId = randomUUID();
    const responses = await Promise.all(Array.from({ length: 8 }, () => sendWebhook(payload(commentId))));
    expect(responses.map((response) => response.statusCode)).toEqual(Array(8).fill(200));
    await waitProcessed(commentId, 1);
    const events = await eventsFor(commentId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ outcome: 'queued', matched_keyword: 'guide', automation_id: automationId });
    const outbox = await context.database.pool.query(
      `SELECT count(*)::int AS total FROM webhook_event_outbox o
       JOIN webhook_events e ON e.id = o.webhook_event_id
       WHERE e.payload->'entry'->0->'changes'->0->'value'->>'id' = $1`, [commentId]);
    expect(outbox.rows[0].total).toBe(1);
  });

  it('keeps one trigger when distinct out-of-order webhook jobs contain the same comment', async () => {
    const commentId = randomUUID();
    const responses = await Promise.all([sendWebhook(payload(commentId, 200)), sendWebhook(payload(commentId, 100))]);
    expect(responses.map((response) => response.statusCode)).toEqual([200, 200]);
    await waitProcessed(commentId, 2);
    expect(await eventsFor(commentId)).toHaveLength(1);
    // Independently replay the real processor concurrently, bypassing BullMQ job deduplication.
    const stored = await context.database.pool.query(
      `SELECT id FROM webhook_events WHERE payload->'entry'->0->'changes'->0->'value'->>'id' = $1`, [commentId]);
    await Promise.all(Array.from({ length: 8 }, (_, index) =>
      processWebhookEvent(context.database, stored.rows[index % 2].id as string)));
    expect(await eventsFor(commentId)).toHaveLength(1);
  });

  it('persists accepted events during a real Redis transport failure and recovers via the outbox', async () => {
    const commentId = randomUUID();
    context.proxy.setOffline(true);
    try {
      await eventually(async () => {
        const readiness = await app.inject('/ready');
        expect(readiness.statusCode).toBe(503);
        expect(readiness.json().dependencies.queue).not.toBe('ok');
      });
      expect((await app.inject('/health')).statusCode).toBe(200);
      expect((await sendWebhook(payload(commentId))).statusCode).toBe(200);
      const stored = await context.database.pool.query(
        `SELECT e.id, e.processed_at, o.status, o.last_error FROM webhook_events e
         JOIN webhook_event_outbox o ON o.webhook_event_id = e.id
         WHERE e.payload->'entry'->0->'changes'->0->'value'->>'id' = $1`, [commentId]);
      expect(stored.rows).toHaveLength(1);
      expect(stored.rows[0]).toMatchObject({ processed_at: null, status: 'failed', last_error: 'QUEUE_DISPATCH_FAILED' });
      expect(await eventsFor(commentId)).toHaveLength(0);
      context.proxy.setOffline(false);
      await eventually(async () => {
        expect((await app.inject('/ready')).statusCode).toBe(200);
        await producer.healthcheck();
      });
      // Advance this synthetic record's retry eligibility instead of sleeping five seconds.
      await context.database.pool.query(
        'UPDATE webhook_event_outbox SET available_at = now() WHERE webhook_event_id = $1', [stored.rows[0].id]);
      await dispatchWebhookOutbox(context.database, producer);
      await waitProcessed(commentId, 1);
      expect(await eventsFor(commentId)).toHaveLength(1);
      const recovered = await context.database.pool.query(
        'SELECT status, attempts, last_error FROM webhook_event_outbox WHERE webhook_event_id = $1', [stored.rows[0].id]);
      expect(recovered.rows[0]).toMatchObject({ status: 'dispatched', attempts: 1, last_error: null });
    } finally { context.proxy.setOffline(false); }
  });

  it('claims an outbox record only once under concurrent SQL pollers and reclaims expired leases', async () => {
    const commentId = randomUUID();
    const stored = await context.database.insertWebhookEvent(payload(commentId), `claim-${randomUUID()}`);
    const claimed = (await Promise.all(Array.from({ length: 6 }, () => context.database.claimWebhookOutbox()))).flat();
    expect(claimed.filter((record) => record.webhookEventId === stored.id)).toHaveLength(1);
    await context.database.pool.query(
      `UPDATE webhook_event_outbox SET claimed_at = now() - interval '6 minutes' WHERE webhook_event_id = $1`, [stored.id]);
    await dispatchWebhookOutbox(context.database, producer);
    await waitProcessed(commentId, 1);
    expect(await eventsFor(commentId)).toHaveLength(1);
  });

  it('enforces actual SQL workspace isolation for account, automation and event access', async () => {
    const commentId = randomUUID();
    expect((await sendWebhook(payload(commentId))).statusCode).toBe(200);
    await waitProcessed(commentId, 1);
    expect((await context.database.listTriggerEvents(automationId, owner.workspaceId)).length).toBeGreaterThan(0);
    expect(await context.database.getAutomation(automationId, other.workspaceId)).toBeUndefined();
    expect(await context.database.listInstagramAccounts(other.workspaceId)).toEqual([]);
    expect(await context.database.listAutomations(other.workspaceId)).toEqual([]);
    expect(await context.database.listTriggerEvents(automationId, other.workspaceId)).toEqual([]);
    expect(await context.database.updateAutomationStatus(automationId, other.workspaceId, 'paused')).toBeUndefined();
    const create = await app.inject({ method: 'POST', url: '/v1/automations',
      headers: { cookie: other.cookie, 'x-csrf-token': other.csrf },
      payload: { name: 'Forbidden account', igAccountId: accountId, keywordRules: [{ value: 'guide' }] } });
    expect(create.statusCode).toBe(404);
    for (const url of [`/v1/automations/${automationId}`, `/v1/automations/${automationId}/events`]) {
      expect((await app.inject({ url, headers: { cookie: other.cookie } })).statusCode).toBe(404);
    }
    expect((await context.database.getAutomation(automationId, owner.workspaceId))?.status).toBe('live');
    const rows = await context.database.pool.query('SELECT count(*)::int AS total FROM automations');
    expect(rows.rows[0].total).toBe(1);
  });

  it('paginates automation and trigger-event lists with stable timestamp/id cursors', async () => {
    const paginationWorkspaceId = randomUUID();
    const paginationAccountId = randomUUID();
    const paginationAutomationIds = [randomUUID(), randomUUID(), randomUUID()];
    await context.database.pool.query('INSERT INTO workspaces(id, name) VALUES ($1, $2)', [paginationWorkspaceId, 'Pagination workspace']);
    await context.database.pool.query(
      `INSERT INTO ig_accounts(id, workspace_id, ig_user_id, username, status)
       VALUES ($1, $2, $3, 'pagination-account', 'active')`,
      [paginationAccountId, paginationWorkspaceId, `pagination-${randomUUID()}`]
    );
    for (const [index, id] of paginationAutomationIds.entries()) {
      await context.database.pool.query(
        `INSERT INTO automations(id, ig_account_id, name, status, keyword_rules, created_at, updated_at)
         VALUES ($1, $2, $3, 'live', '[]', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
        [id, paginationAccountId, `Pagination ${index}`]
      );
    }

    const firstAutomations = await context.database.listAutomations(paginationWorkspaceId, { limit: 2 });
    expect(firstAutomations.items).toHaveLength(2);
    expect(firstAutomations.hasMore).toBe(true);
    expect(firstAutomations.nextCursor).toBeTruthy();
    const automationCursor = parsePaginationQuery(
      { cursor: firstAutomations.nextCursor }, 'automations', paginationWorkspaceId
    ).cursor;
    if (!automationCursor) throw new Error('Expected an automation pagination cursor');
    const secondAutomations = await context.database.listAutomations(paginationWorkspaceId, {
      limit: 2, cursor: automationCursor
    });
    expect(secondAutomations.items).toHaveLength(1);
    expect(secondAutomations.hasMore).toBe(false);
    expect(firstAutomations.items.map((row) => row.id).filter((id) => secondAutomations.items.some((row) => row.id === id))).toHaveLength(0);

    for (let index = 0; index < 3; index += 1) {
      expect(await context.database.insertTriggerEvent({
        igAccountId: paginationAccountId,
        automationId: paginationAutomationIds[0]!,
        workspaceId: paginationWorkspaceId,
        commentId: `pagination-comment-${index}-${randomUUID()}`,
        commentText: 'pagination',
        outcome: 'queued'
      })).toBe(true);
    }
    await context.database.pool.query(
      `UPDATE trigger_events SET created_at = '2026-01-01T00:00:00Z'
       WHERE automation_id = $1`, [paginationAutomationIds[0]]
    );
    const firstEvents = await context.database.listTriggerEvents(paginationAutomationIds[0]!, paginationWorkspaceId, { limit: 2 });
    expect(firstEvents.items).toHaveLength(2);
    expect(firstEvents.hasMore).toBe(true);
    const eventCursor = parsePaginationQuery(
      { cursor: firstEvents.nextCursor }, 'trigger-events', paginationAutomationIds[0]!
    ).cursor;
    if (!eventCursor) throw new Error('Expected a trigger-event pagination cursor');
    const secondEvents = await context.database.listTriggerEvents(paginationAutomationIds[0]!, paginationWorkspaceId, {
      limit: 2, cursor: eventCursor
    });
    expect(secondEvents.items).toHaveLength(1);
    expect(secondEvents.hasMore).toBe(false);
    expect(firstEvents.items.map((row) => row.id).filter((id) => secondEvents.items.some((row) => row.id === id))).toHaveLength(0);
  });

  it('reads the current membership role from SQL and rejects viewer mutations', async () => {
    await context.database.pool.query("UPDATE memberships SET role = 'viewer' WHERE workspace_id = $1", [owner.workspaceId]);
    try {
      expect((await app.inject({ url: '/v1/automations', headers: { cookie: owner.cookie } })).statusCode).toBe(200);
      const mutation = await app.inject({ method: 'POST', url: `/v1/automations/${automationId}/pause`,
        headers: { cookie: owner.cookie, 'x-csrf-token': owner.csrf } });
      expect(mutation.statusCode).toBe(403);
      expect(mutation.json().code).toBe('FORBIDDEN');
      expect((await context.database.getAutomation(automationId, owner.workspaceId))?.status).toBe('live');
    } finally {
      await context.database.pool.query("UPDATE memberships SET role = 'owner' WHERE workspace_id = $1", [owner.workspaceId]);
    }
  });

  it('rolls back webhook persistence if the transactional outbox insert fails', async () => {
    const commentId = randomUUID();
    await context.database.pool.query(`
      CREATE FUNCTION reject_test_outbox() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'synthetic outbox failure'; END; $$;
      CREATE TRIGGER reject_test_outbox BEFORE INSERT ON webhook_event_outbox
      FOR EACH ROW EXECUTE FUNCTION reject_test_outbox();
    `);
    try {
      expect((await sendWebhook(payload(commentId))).statusCode).toBe(500);
      const result = await context.database.pool.query(
        `SELECT count(*)::int AS total FROM webhook_events
         WHERE payload->'entry'->0->'changes'->0->'value'->>'id' = $1`, [commentId]);
      expect(result.rows[0].total).toBe(0);
      expect(await eventsFor(commentId)).toHaveLength(0);
    } finally {
      await context.database.pool.query('DROP TRIGGER reject_test_outbox ON webhook_event_outbox; DROP FUNCTION reject_test_outbox();');
    }
  });

  async function storedEvent(commentId: string) {
    const result = await context.database.pool.query(
      `SELECT id FROM webhook_events WHERE payload->'entry'->0->'changes'->0->'value'->>'id' = $1`, [commentId]);
    return result.rows[0].id as string;
  }

  async function requestReplay(id: string, actor = owner) {
    return app.inject({ method: 'POST', url: `/v1/webhook-events/${id}/replay`,
      headers: { cookie: actor.cookie, 'x-csrf-token': actor.csrf } });
  }

  async function waitReplay(id: string) {
    await eventually(async () => {
      const result = await context.database.pool.query('SELECT processing_status FROM webhook_replays WHERE id = $1', [id]);
      expect(result.rows[0]?.processing_status).toBe('processed');
    });
  }

  it('audits concurrent replay requests and reprocesses retained completed jobs without duplicating triggers', async () => {
    const commentId = randomUUID();
    expect((await sendWebhook(payload(commentId))).statusCode).toBe(200);
    await waitProcessed(commentId, 1);
    const eventId = await storedEvent(commentId);
    await eventually(async () => expect(await (await context.queue.getJob(eventId))?.getState()).toBe('completed'));
    const responses = await Promise.all([requestReplay(eventId), requestReplay(eventId)]);
    expect(responses.map((response) => response.statusCode)).toEqual([202, 202]);
    const replayIds = responses.map((response) => response.json().data.id as string);
    expect(new Set(replayIds).size).toBe(2);
    const actorId = (await app.inject({ url: '/v1/auth/me', headers: { cookie: owner.cookie } })).json().data.id;
    const audit = await context.database.pool.query(
      `SELECT a.* FROM audit_log a JOIN webhook_replays r ON r.audit_log_id = a.id WHERE r.id = ANY($1::uuid[])`, [replayIds]);
    expect(audit.rows).toHaveLength(2);
    for (const row of audit.rows) {
      expect(row).toMatchObject({ actor_user_id: actorId, workspace_id: owner.workspaceId,
        entity_id: eventId, entity_type: 'webhook_event', action: 'webhook.replay.requested' });
      expect(Object.keys(row.metadata)).toEqual(['replayId']);
      expect(replayIds).toContain(row.metadata.replayId);
      expect(row.created_at).toBeInstanceOf(Date);
    }
    await dispatchWebhookReplays(context.database, producer);
    await Promise.all(replayIds.map(waitReplay));
    for (const id of replayIds) {
      // The same replay delivery may be retried after a completion receipt was lost.
      await processWebhookReplay(context.database, id);
      expect(await context.queue.getJob(`replay-${id}`)).toBeDefined();
    }
    expect(await eventsFor(commentId)).toHaveLength(1);
    const claims = await context.database.pool.query(
      'SELECT count(*)::int AS total FROM trigger_event_idempotency WHERE idempotency_key = $1',
      [`${accountId}:${commentId}:${automationId}`]);
    expect(claims.rows[0].total).toBe(1);
  });

  it('rejects foreign, mixed-workspace, unknown-account and missing events without audit/replay writes', async () => {
    const commentId = randomUUID();
    const own = await context.database.insertWebhookEvent(payload(commentId), `scope-${randomUUID()}`);
    const foreignAccount = await context.database.pool.query(
      `INSERT INTO ig_accounts(workspace_id, ig_user_id, username) VALUES ($1, $2, 'foreign') RETURNING ig_user_id`,
      [other.workspaceId, `foreign-${randomUUID()}`]);
    const mixedPayload = payload(randomUUID());
    mixedPayload.entry.push({ ...mixedPayload.entry[0]!, id: foreignAccount.rows[0].ig_user_id as string });
    const mixed = await context.database.insertWebhookEvent(mixedPayload, `mixed-${randomUUID()}`);
    const unknownPayload = payload(randomUUID());
    unknownPayload.entry[0]!.id = 'unknown-account';
    const unknown = await context.database.insertWebhookEvent(unknownPayload, `unknown-${randomUUID()}`);
    const before = await context.database.pool.query('SELECT count(*)::int AS total FROM webhook_replays');
    const auditBefore = await context.database.pool.query('SELECT count(*)::int AS total FROM audit_log');
    for (const response of [await requestReplay(own.id, other), await requestReplay(mixed.id),
      await requestReplay(unknown.id), await requestReplay(randomUUID())]) {
      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        code: 'NOT_FOUND',
        message: 'Replayable webhook event not found',
        requestId: expect.any(String)
      });
    }
    expect((await context.database.pool.query('SELECT count(*)::int AS total FROM webhook_replays')).rows).toEqual(before.rows);
    expect((await context.database.pool.query('SELECT count(*)::int AS total FROM audit_log')).rows).toEqual(auditBefore.rows);
  });

  it('accepts replay during Redis failure, persists a failed dispatch, and recovers with one trigger', async () => {
    const commentId = randomUUID();
    expect((await sendWebhook(payload(commentId))).statusCode).toBe(200);
    await waitProcessed(commentId, 1);
    const eventId = await storedEvent(commentId);
    context.proxy.setOffline(true);
    try {
      await eventually(async () => expect((await app.inject('/ready')).statusCode).toBe(503));
      const response = await requestReplay(eventId);
      expect(response.statusCode).toBe(202);
      const id = response.json().data.id as string;
      await dispatchWebhookReplays(context.database, producer);
      const failed = await context.database.pool.query('SELECT dispatch_status, last_error FROM webhook_replays WHERE id = $1', [id]);
      expect(failed.rows[0]).toEqual({ dispatch_status: 'failed', last_error: 'QUEUE_DISPATCH_FAILED' });
      context.proxy.setOffline(false);
      await eventually(async () => { await producer.healthcheck(); expect((await app.inject('/ready')).statusCode).toBe(200); });
      await context.database.pool.query('UPDATE webhook_replays SET available_at = now() WHERE id = $1', [id]);
      await dispatchWebhookReplays(context.database, producer);
      await waitReplay(id);
      expect(await eventsFor(commentId)).toHaveLength(1);
    } finally { context.proxy.setOffline(false); }
  });

  it('claims each replay once across SQL pollers and recovers an expired replay lease', async () => {
    const commentId = randomUUID();
    const event = await context.database.insertWebhookEvent(payload(commentId), `lease-${randomUUID()}`);
    const response = await requestReplay(event.id);
    expect(response.statusCode).toBe(202);
    const id = response.json().data.id as string;
    const claims = (await Promise.all(Array.from({ length: 6 }, () => context.database.claimWebhookReplays()))).flat();
    expect(claims.filter((claim) => claim.id === id)).toHaveLength(1);
    await context.database.pool.query("UPDATE webhook_replays SET claimed_at = now() - interval '6 minutes' WHERE id = $1", [id]);
    await dispatchWebhookReplays(context.database, producer);
    await waitReplay(id);
    // Late failure acknowledgements cannot regress a successfully dispatched/completed request.
    await context.database.markWebhookReplayDispatchFailed(id);
    await context.database.markWebhookReplayProcessingFailed(id);
    const status = await context.database.pool.query('SELECT dispatch_status, processing_status FROM webhook_replays WHERE id = $1', [id]);
    expect(status.rows[0]).toEqual({ dispatch_status: 'dispatched', processing_status: 'processed' });
    expect(await eventsFor(commentId)).toHaveLength(1);
  });

  it('rolls back the entire replay request when audit insertion fails', async () => {
    const event = await context.database.insertWebhookEvent(payload(randomUUID()), `audit-${randomUUID()}`);
    await context.database.pool.query(`
      CREATE FUNCTION reject_replay_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.action = 'webhook.replay.requested' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END; $$;
      CREATE TRIGGER reject_replay_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION reject_replay_audit();
    `);
    try {
      expect((await requestReplay(event.id)).statusCode).toBe(500);
      const requests = await context.database.pool.query('SELECT count(*)::int AS total FROM webhook_replays WHERE webhook_event_id = $1', [event.id]);
      const audit = await context.database.pool.query('SELECT count(*)::int AS total FROM audit_log WHERE entity_id = $1', [event.id]);
      expect(requests.rows[0].total).toBe(0);
      expect(audit.rows[0].total).toBe(0);
    } finally { await context.database.pool.query('DROP TRIGGER reject_replay_audit ON audit_log; DROP FUNCTION reject_replay_audit();'); }
  });

  it('rechecks ownership at processing and trigger-write time after accepting a replay', async () => {
    const commentId = randomUUID();
    const event = await context.database.insertWebhookEvent(payload(commentId), `moved-${randomUUID()}`);
    const response = await requestReplay(event.id);
    expect(response.statusCode).toBe(202);
    const id = response.json().data.id as string;
    await context.database.pool.query('UPDATE ig_accounts SET workspace_id = $1 WHERE id = $2', [other.workspaceId, accountId]);
    try {
      await expect(processWebhookReplay(context.database, id)).rejects.toThrow('not eligible');
      expect(await context.database.insertTriggerEvent({ igAccountId: accountId, automationId,
        workspaceId: owner.workspaceId, commentId, commentText: 'synthetic', outcome: 'queued' })).toBe(false);
      expect(await eventsFor(commentId)).toHaveLength(0);
      const status = await context.database.pool.query('SELECT processing_status, last_processing_error FROM webhook_replays WHERE id = $1', [id]);
      expect(status.rows[0]).toEqual({ processing_status: 'failed', last_processing_error: 'WEBHOOK_PROCESSING_FAILED' });
    } finally { await context.database.pool.query('UPDATE ig_accounts SET workspace_id = $1 WHERE id = $2', [owner.workspaceId, accountId]); }
  });
});
