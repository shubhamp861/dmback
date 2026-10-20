import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import type { Config } from './config.js';
import { safeError } from './logging.js';

export const MATCH_COMMENT_QUEUE = 'match-comment';

export interface MatchCommentJob {
  webhookEventId: string;
  replayId?: string;
}

export interface EventQueue {
  enqueueMatch(job: MatchCommentJob): Promise<void>;
  close(): Promise<void>;
}

export interface ReplayQueue {
  enqueueReplay(job: { webhookEventId: string; replayId: string }): Promise<void>;
}

export class BullMqEventQueue implements EventQueue, ReplayQueue {
  private readonly queue: Queue<MatchCommentJob>;
  private readonly connection: Redis;

  constructor(config: Config, onError: (error: Error) => void = (error) => console.error('Redis producer error', safeError(error))) {
    this.connection = new Redis(config.REDIS_URL, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      commandTimeout: 2000
    });
    this.connection.on('error', onError);
    this.queue = new Queue<MatchCommentJob>(MATCH_COMMENT_QUEUE, {
      connection: this.connection,
      ...(config.QUEUE_PREFIX !== undefined ? { prefix: config.QUEUE_PREFIX } : {}),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { age: 86400, count: 10000 },
        removeOnFail: { age: 604800, count: 10000 }
      }
    });
    this.queue.on('error', onError);
  }

  async healthcheck(): Promise<void> {
    await this.connection.ping();
  }

  async enqueueMatch(job: MatchCommentJob): Promise<void> {
    // BullMQ waits for initial connection before adding; reject instead of retaining
    // an enqueue that could execute much later after the caller has failed.
    if (this.connection.status !== 'ready') throw new Error('Redis producer is not ready');
    await this.queue.add('match-comment', job, { jobId: job.webhookEventId });
  }

  async enqueueReplay(job: { webhookEventId: string; replayId: string }): Promise<void> {
    if (this.connection.status !== 'ready') throw new Error('Redis producer is not ready');
    await this.queue.add('match-comment', job, { jobId: `replay-${job.replayId}` });
  }

  async close(): Promise<void> {
    try {
      await this.queue.close();
    } finally {
      this.connection.disconnect();
    }
  }
}
