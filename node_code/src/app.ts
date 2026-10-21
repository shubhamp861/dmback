import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import rawBody from 'fastify-raw-body';
import type { Config } from './config.js';
import type { LogController as LogControllerType } from 'fastify';
import { AuthService } from './auth.js';
import { FakeEmailProvider } from './email.js';
import { Database } from './db.js';
import { InstagramOAuthService } from './instagram/oauth.js';
import { BullMqEventQueue } from './queue.js';
import { RedisRateLimiter } from './rate-limit.js';
import { registerRoutes } from './routes.js';
import { registerHealthRoutes } from './health.js';
import { registerSafeErrorHandlers, safeError, safeLoggerOptions, withRequestId } from './logging.js';

export function buildApp(config: Config) {
  // Fastify 5.5 exposes LogController as the non-deprecated replacement for
  // disableRequestLogging. It is loaded from the installed Fastify package so
  // the runtime's instanceof check uses the same class as Fastify itself.
  const { LogController } = createRequire(import.meta.url)('fastify/lib/log-controller.js') as {
    LogController: new (options: { disableRequestLogging: boolean }) => LogControllerType;
  };
  const app = Fastify({
    logger: safeLoggerOptions(config.LOG_LEVEL),
    logController: new LogController({ disableRequestLogging: true }),
    // Generate correlation IDs locally; arbitrary client headers may contain secrets.
    requestIdHeader: false,
    genReqId: () => randomUUID(),
    bodyLimit: 1024 * 1024
  });
  const frontendRoot = path.resolve(process.cwd(), 'public');
  const frontendIndex = path.join(frontendRoot, 'index.html');
  const servesFrontend = existsSync(frontendIndex);
  const database = new Database(config.DATABASE_URL);
  const queue = new BullMqEventQueue(config, (error) => app.log.error({ err: safeError(error) }, 'Redis producer error'));
  const rateLimiter = new RedisRateLimiter(config);
  database.pool.on('error', (error) => app.log.error({ err: safeError(error) }, 'Database pool error'));
  const auth = new AuthService(database, new FakeEmailProvider());
  const instagramOAuth = new InstagramOAuthService(database, config);

  app.register(cookie);
  app.register(helmet);
  app.register(cors, { origin: config.WEB_ORIGIN, credentials: true });
  app.register(rawBody, {
    field: 'rawBody',
    global: false,
    encoding: false,
    routes: ['/v1/webhooks/instagram']
  });
  if (servesFrontend) {
    app.register(fastifyStatic, {
      root: frontendRoot,
      index: false,
      maxAge: '365d',
      immutable: true
    });
  }
  registerSafeErrorHandlers(app, servesFrontend);
  app.addHook('onSend', async (request, reply, payload) => {
    if (reply.statusCode < 400 || !payload) return payload;
    const contentType = reply.getHeader('content-type');
    if (typeof contentType !== 'string' || !contentType.toLowerCase().startsWith('application/json')) return payload;
    try {
      return JSON.stringify(withRequestId(JSON.parse(String(payload)), request.id));
    } catch {
      return payload;
    }
  });
  app.register(registerRoutes, { config, database, queue, auth, instagramOAuth, rateLimiter });
  app.register(registerHealthRoutes, { database, queue, timeoutMs: config.READINESS_TIMEOUT_MS ?? 2000 });

  if (servesFrontend) {
    app.get('/', (_request, reply) => reply.type('text/html').sendFile('index.html', { maxAge: 0, immutable: false }));
  }

  app.addHook('onClose', async () => {
    try {
      await queue.close();
    } finally {
      try {
        await rateLimiter.close();
      } finally {
        await database.close();
      }
    }
  });

  return app;
}
