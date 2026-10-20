import type { FastifyInstance } from 'fastify';
import { DeadlineError, withDeadline } from './runtime.js';

export interface HealthOptions {
  database: { healthcheck(): Promise<void> };
  queue: { healthcheck(): Promise<void> };
  timeoutMs: number;
}

export function liveness() { return { status: 'ok' }; }

export async function registerHealthRoutes(app: FastifyInstance, options: HealthOptions): Promise<void> {
  app.get('/live', async () => liveness());
  app.get('/ready', async (_request, reply) => {
    const checks = await Promise.all(
      (['database', 'queue'] as const).map(async (name) => {
        try {
          await withDeadline(() => options[name].healthcheck(), options.timeoutMs);
          return [name, 'ok'] as const;
        } catch (error) {
          return [name, error instanceof DeadlineError ? 'timeout' : 'unavailable'] as const;
        }
      })
    );
    const dependencies = Object.fromEntries(checks);
    const ready = checks.every(([, status]) => status === 'ok');
    return reply.code(ready ? 200 : 503).send({ status: ready ? 'ok' : 'degraded', dependencies });
  });
}
