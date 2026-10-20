import { Worker } from 'bullmq';
import { loadConfig } from './config.js';
import { Database } from './db.js';
import { BullMqEventQueue, MATCH_COMMENT_QUEUE, type MatchCommentJob } from './queue.js';
import { dispatchWebhookOutbox, dispatchWebhookReplays, processWebhookEvent, processWebhookReplay } from './processing.js';
import { createShutdown, installShutdownSignals, startSerialPoll } from './runtime.js';
import { safeError, safeJobError } from './logging.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const database = new Database(config.DATABASE_URL);
  database.pool.on('error', (error) => console.error('Database pool error', safeError(error)));
  const eventQueue = new BullMqEventQueue(config);
  const worker = new Worker<MatchCommentJob>(
    MATCH_COMMENT_QUEUE,
    async (job) => {
      try {
        if (job.data.replayId !== undefined) {
          await processWebhookReplay(database, job.data.replayId);
        } else {
          await processWebhookEvent(database, job.data.webhookEventId);
        }
      }
      catch (error) { throw safeJobError(error); }
    },
    {
      connection: { url: config.REDIS_URL },
      ...(config.QUEUE_PREFIX !== undefined ? { prefix: config.QUEUE_PREFIX } : {}),
      concurrency: 10
    }
  );

  worker.on('completed', () => {
    console.info('Processed webhook event');
  });

  worker.on('failed', (_job, error) => {
    console.error('Failed webhook event', safeError(error));
  });
  worker.on('error', (error) => console.error('Worker Redis error', safeError(error)));

  const outboxPoll = startSerialPoll({
    run: async () => {
      try {
        await dispatchWebhookOutbox(database, eventQueue, (error) => {
          console.error('Failed to dispatch webhook outbox', safeError(error));
        });
      } finally {
        await dispatchWebhookReplays(database, eventQueue, (error) => {
          console.error('Failed to dispatch webhook replay', safeError(error));
        });
      }
    },
    intervalMs: 5000,
    onError: (error) => console.error('Webhook outbox poll failed', safeError(error))
  });

  const shutdown = createShutdown({
    stop: outboxPoll.stop,
    steps: [
      // Stop taking new jobs immediately; pause locally without waiting for active jobs.
      () => worker.pause(true),
      outboxPoll.drain,
      () => worker.close(),
      () => eventQueue.close(),
      () => database.close()
    ],
    timeoutMs: config.SHUTDOWN_TIMEOUT_MS ?? 30000,
    onFailure: (error) => {
      console.error('Worker shutdown failed or exceeded deadline; leaving unfinished jobs for lock recovery', safeError(error));
      // Never acknowledge unfinished work or close its database underneath a live processor.
      // Process exit drops Redis locks; BullMQ stalled recovery and outbox lease expiry retry it.
      process.exit(1);
    }
  });
  installShutdownSignals(shutdown);
}

main().catch((error: unknown) => {
  console.error('Worker startup failed', safeError(error));
  process.exit(1);
});
