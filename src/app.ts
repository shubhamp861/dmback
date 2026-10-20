import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rawBody from 'fastify-raw-body';
import type { Config } from './config.js';
import { AuthService } from './auth.js';
import { Database } from './db.js';
import { InstagramOAuthService } from './instagram/oauth.js';
import { BullMqEventQueue } from './queue.js';
import { registerRoutes } from './routes.js';
import { registerHealthRoutes } from './health.js';
import { registerSafeErrorHandlers, safeError, safeLoggerOptions } from './logging.js';

export function buildApp(config: Config) {
  const app = Fastify({
    logger: safeLoggerOptions(config.LOG_LEVEL),
    disableRequestLogging: true,
    // Generate correlation IDs locally; arbitrary client headers may contain secrets.
    requestIdHeader: false,
    bodyLimit: 1024 * 1024
  });
  const database = new Database(config.DATABASE_URL);
  const queue = new BullMqEventQueue(config, (error) => app.log.error({ err: safeError(error) }, 'Redis producer error'));
  database.pool.on('error', (error) => app.log.error({ err: safeError(error) }, 'Database pool error'));
  const auth = new AuthService(database);
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
  registerSafeErrorHandlers(app);
  app.register(registerRoutes, { config, database, queue, auth, instagramOAuth });
  app.register(registerHealthRoutes, { database, queue, timeoutMs: config.READINESS_TIMEOUT_MS ?? 2000 });

  app.addHook('onClose', async () => {
    try {
      await queue.close();
    } finally {
      await database.close();
    }
  });

  return app;
}
