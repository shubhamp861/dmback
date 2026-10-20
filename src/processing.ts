import type { Database } from './db.js';
import { evaluateComment } from './domain/automation.js';
import { extractCommentEvents, parseInstagramWebhook } from './instagram/webhook.js';
import type { EventQueue, ReplayQueue } from './queue.js';
import { QUEUE_DISPATCH_FAILURE } from './logging.js';

export async function processWebhookEvent(database: Database, webhookEventId: string, workspaceId?: string): Promise<void> {
  const storedPayload = await database.getWebhookPayload(webhookEventId);
  if (!storedPayload) {
    throw new Error(`Webhook event ${webhookEventId} was not found`);
  }

  const payload = parseInstagramWebhook(storedPayload);
  const commentEvents = extractCommentEvents(payload);
  for (const comment of commentEvents) {
    const automations = workspaceId === undefined
      ? await database.listLiveAutomations(comment.accountId)
      : await database.listLiveAutomations(comment.accountId, workspaceId);
    for (const automation of automations) {
      if (comment.parentCommentId) {
        await database.insertTriggerEvent({
          igAccountId: automation.igAccountId,
          automationId: automation.id,
          ...(workspaceId !== undefined ? { workspaceId } : {}),
          commentId: comment.commentId,
          commentText: comment.commentText,
          outcome: 'skipped',
          reasonCode: 'NOT_TOP_LEVEL'
        });
        continue;
      }

      const result = evaluateComment(automation, comment.commentText);
      await database.insertTriggerEvent({
        igAccountId: automation.igAccountId,
        automationId: automation.id,
        ...(workspaceId !== undefined ? { workspaceId } : {}),
        commentId: comment.commentId,
        commentText: comment.commentText,
        ...(result.outcome === 'queued' ? { matchedKeyword: result.matchedKeyword } : {}),
        outcome: result.outcome,
        ...(result.outcome === 'skipped' ? { reasonCode: result.reasonCode } : {})
      });
    }
  }
  await database.markWebhookProcessed(webhookEventId);
}

export async function processWebhookReplay(database: Database, replayId: string): Promise<void> {
  try {
    const replay = await database.getWebhookReplayForProcessing(replayId);
    if (!replay) throw new Error('Webhook replay was not found or is not eligible for processing');
    if (replay.processed) return;
    await processWebhookEvent(database, replay.webhookEventId, replay.workspaceId);
    await database.markWebhookReplayProcessed(replayId);
  } catch (error) {
    try {
      await database.markWebhookReplayProcessingFailed(replayId);
    } catch {
      // Preserve the original failure so BullMQ can retry even if recording it fails.
    }
    throw error;
  }
}

export async function dispatchWebhookReplays(
  database: Database,
  queue: ReplayQueue,
  onError: (error: unknown, replayId: string) => void = () => {}
): Promise<void> {
  const records = await database.claimWebhookReplays();
  for (const record of records) {
    try {
      await queue.enqueueReplay({ webhookEventId: record.webhookEventId, replayId: record.id });
      await database.markWebhookReplayDispatched(record.id);
    } catch (error) {
      await database.markWebhookReplayDispatchFailed(record.id);
      try {
        onError(error, record.id);
      } catch {
        // Reporting must not prevent the remaining replay requests from being dispatched.
      }
    }
  }
}

export async function dispatchWebhookOutbox(
  database: Database,
  eventQueue: EventQueue,
  onError: (error: unknown, webhookEventId: string) => void = () => {}
): Promise<void> {
  const records = await database.claimWebhookOutbox();
  for (const record of records) {
    try {
      await eventQueue.enqueueMatch({ webhookEventId: record.webhookEventId });
      await database.markWebhookDispatched(record.webhookEventId);
    } catch (error) {
      await database.markWebhookDispatchFailed(
        record.webhookEventId,
        QUEUE_DISPATCH_FAILURE
      );
      try {
        onError(error, record.webhookEventId);
      } catch {
        // Reporting must not prevent the remaining outbox records from being dispatched.
      }
    }
  }
}
