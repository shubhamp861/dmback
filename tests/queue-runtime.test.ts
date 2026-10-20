import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '../src/config.js';

const mocks = vi.hoisted(() => ({
  redis: { status: 'connecting', on: vi.fn(), ping: vi.fn(), disconnect: vi.fn() },
  queue: { add: vi.fn(), close: vi.fn(), on: vi.fn() },
  redisConstructor: vi.fn(), queueConstructor: vi.fn()
}));
vi.mock('ioredis', () => ({ Redis: class {
  constructor(...args: unknown[]) { mocks.redisConstructor(...args); return mocks.redis; }
} }));
vi.mock('bullmq', () => ({ Queue: class {
  constructor(...args: unknown[]) { mocks.queueConstructor(...args); return mocks.queue; }
} }));
import { BullMqEventQueue } from '../src/queue.js';

describe('Redis producer reliability', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.redis.status = 'connecting'; });
  const config = { REDIS_URL: 'redis://example.invalid:6379' } as Config;

  it('fails immediately before Redis is ready, without retaining a future enqueue', async () => {
    const queue = new BullMqEventQueue(config);
    await expect(queue.enqueueMatch({ webhookEventId: 'event-1' })).rejects.toThrow('not ready');
    expect(mocks.queue.add).not.toHaveBeenCalled();
    expect(mocks.redisConstructor).toHaveBeenCalledWith(config.REDIS_URL, expect.objectContaining({
      enableOfflineQueue: false, maxRetriesPerRequest: 1, commandTimeout: 2000, connectTimeout: 2000
    }));
    mocks.redis.status = 'ready';
    await queue.enqueueMatch({ webhookEventId: 'event-1' });
    expect(mocks.queue.add).toHaveBeenCalledExactlyOnceWith('match-comment', { webhookEventId: 'event-1' }, { jobId: 'event-1' });
  });

  it('handles Redis error events and closes the owned connection even if queue close fails', async () => {
    const onError = vi.fn();
    const queue = new BullMqEventQueue(config, onError);
    expect(mocks.redis.on).toHaveBeenCalledWith('error', onError);
    expect(mocks.queue.on).toHaveBeenCalledWith('error', onError);
    mocks.queue.close.mockRejectedValueOnce(new Error('close failed'));
    await expect(queue.close()).rejects.toThrow('close failed');
    expect(mocks.redis.disconnect).toHaveBeenCalledOnce();
  });

  it('isolates integration namespaces only when an explicit prefix is supplied', async () => {
    const queue = new BullMqEventQueue({ ...config, QUEUE_PREFIX: 'integration_run_123' });
    expect(mocks.queueConstructor).toHaveBeenLastCalledWith('match-comment', expect.objectContaining({ prefix: 'integration_run_123' }));
    await queue.close();
    const defaultQueue = new BullMqEventQueue(config);
    const options = mocks.queueConstructor.mock.calls.at(-1)?.[1] as Record<string, unknown>;
    expect(options).not.toHaveProperty('prefix');
    await defaultQueue.close();
  });

  it('uses replay-specific stable job IDs without colliding with the original delivery', async () => {
    const queue = new BullMqEventQueue(config);
    await expect(queue.enqueueReplay({ webhookEventId: 'event-1', replayId: 'request-1' })).rejects.toThrow('not ready');
    mocks.redis.status = 'ready';
    await queue.enqueueReplay({ webhookEventId: 'event-1', replayId: 'request-1' });
    await queue.enqueueReplay({ webhookEventId: 'event-1', replayId: 'request-1' });
    expect(mocks.queue.add).toHaveBeenNthCalledWith(1, 'match-comment', { webhookEventId: 'event-1', replayId: 'request-1' }, { jobId: 'replay-request-1' });
    expect(mocks.queue.add).toHaveBeenNthCalledWith(2, 'match-comment', { webhookEventId: 'event-1', replayId: 'request-1' }, { jobId: 'replay-request-1' });
    await queue.enqueueMatch({ webhookEventId: 'event-1' });
    expect(mocks.queue.add).toHaveBeenLastCalledWith('match-comment', { webhookEventId: 'event-1' }, { jobId: 'event-1' });
    await queue.close();
  });
});
