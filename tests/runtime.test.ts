import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShutdown, DeadlineError, startSerialPoll } from '../src/runtime.js';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('runtime lifecycle', () => {
  afterEach(() => vi.useRealTimers());

  it('stops scheduling and drains work before closing dependencies, once', async () => {
    const events: string[] = [];
    const drain = deferred();
    const onFailure = vi.fn();
    const shutdown = createShutdown({
      stop: () => { events.push('stop'); },
      steps: [
        async () => { events.push('drain'); await drain.promise; },
        async () => { events.push('worker'); },
        async () => { events.push('queue'); },
        async () => { events.push('database'); }
      ], timeoutMs: 1000, onFailure
    });
    const first = shutdown();
    expect(shutdown()).toBe(first);
    await Promise.resolve();
    expect(events).toEqual(['stop', 'drain']);
    drain.resolve();
    await first;
    await shutdown();
    expect(events).toEqual(['stop', 'drain', 'worker', 'queue', 'database']);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('bounds stuck work without closing dependencies under a live processor', async () => {
    vi.useFakeTimers();
    const closeDatabase = vi.fn();
    const failure = vi.fn();
    const shutdown = createShutdown({
      steps: [() => new Promise<void>(() => {}), closeDatabase],
      timeoutMs: 100, onFailure: failure
    });
    const pending = shutdown();
    await vi.advanceTimersByTimeAsync(100);
    await pending;
    expect(failure).toHaveBeenCalledExactlyOnceWith(expect.any(DeadlineError));
    expect(closeDatabase).not.toHaveBeenCalled();
    await shutdown();
    expect(failure).toHaveBeenCalledOnce();
  });

  it('never overlaps slow polls and drains the last poll on stop', async () => {
    vi.useFakeTimers();
    const first = deferred();
    const second = deferred();
    const run = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const poll = startSerialPoll({ run, intervalMs: 50, onError: vi.fn() });
    await vi.advanceTimersByTimeAsync(500);
    expect(run).toHaveBeenCalledOnce();
    first.resolve();
    await vi.advanceTimersByTimeAsync(50);
    expect(run).toHaveBeenCalledTimes(2);
    poll.stop();
    let drained = false;
    const pending = poll.drain().then(() => { drained = true; });
    await vi.advanceTimersByTimeAsync(500);
    expect(drained).toBe(false);
    second.resolve();
    await pending;
    await vi.advanceTimersByTimeAsync(500);
    expect(drained).toBe(true);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('recovers from a failed poll without an unhandled rejection', async () => {
    vi.useFakeTimers();
    const error = new Error('database unavailable');
    const run = vi.fn().mockRejectedValueOnce(error).mockResolvedValue(undefined);
    const onError = vi.fn();
    const poll = startSerialPoll({ run, intervalMs: 50, onError });
    await vi.advanceTimersByTimeAsync(50);
    poll.stop();
    await poll.drain();
    expect(onError).toHaveBeenCalledWith(error);
    expect(run).toHaveBeenCalledTimes(2);
  });
});
