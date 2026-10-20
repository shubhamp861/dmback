import './http-test-setup.js';
import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerHealthRoutes } from '../src/health.js';

describe('runtime health endpoints', () => {
  afterEach(() => vi.useRealTimers());

  it('reports healthy database and Redis readiness', async () => {
    const app = Fastify();
    app.register(registerHealthRoutes, {
      database: { healthcheck: vi.fn().mockResolvedValue(undefined) },
      queue: { healthcheck: vi.fn().mockResolvedValue(undefined) }, timeoutMs: 50
    });
    const response = await app.inject('/ready');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', dependencies: { database: 'ok', queue: 'ok' } });
    await app.close();
  });

  it('keeps liveness independent of failed dependencies and redacts failures', async () => {
    const app = Fastify();
    const database = { healthcheck: vi.fn().mockRejectedValue(new Error('secret connection URL')) };
    const queue = { healthcheck: vi.fn().mockResolvedValue(undefined) };
    app.register(registerHealthRoutes, { database, queue, timeoutMs: 50 });
    expect((await app.inject('/live')).statusCode).toBe(200);
    expect(database.healthcheck).not.toHaveBeenCalled();
    expect(queue.healthcheck).not.toHaveBeenCalled();
    const response = await app.inject('/ready');
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: 'degraded', dependencies: { database: 'unavailable', queue: 'ok' } });
    expect(response.body).not.toContain('secret');
    await app.close();
  });

  it('bounds hanging dependency checks concurrently', async () => {
    vi.useFakeTimers();
    const app = Fastify();
    const database = { healthcheck: vi.fn(() => new Promise<void>(() => {})) };
    const queue = { healthcheck: vi.fn(() => new Promise<void>(() => {})) };
    app.register(registerHealthRoutes, { database, queue, timeoutMs: 50 });
    await app.ready();
    const pending = app.inject('/ready');
    // Injection is scheduled by Fastify on the real next-tick queue.
    await new Promise<void>((resolve) => process.nextTick(resolve));
    await vi.advanceTimersByTimeAsync(50);
    const response = await pending;
    expect(response.statusCode).toBe(503);
    expect(response.json().dependencies).toEqual({ database: 'timeout', queue: 'timeout' });
    expect(database.healthcheck).toHaveBeenCalledOnce();
    expect(queue.healthcheck).toHaveBeenCalledOnce();
    await app.close();
  });
});
