import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createServer, connect, type Socket } from 'node:net';
import pg from 'pg';
import { Queue } from 'bullmq';
import { loadMigrations } from '../../scripts/migration-utils.js';
import { Database } from '../../src/db.js';
import { loadConfig } from '../../src/config.js';
import { MATCH_COMMENT_QUEUE } from '../../src/queue.js';

export async function eventually(check: () => Promise<void>, timeoutMs = 10000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try { await check(); return; } catch (error) {
      if (Date.now() >= deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

/** This proxy simulates a real dropped Redis transport without stopping any server. */
export async function redisProxy(targetUrl: string) {
  const target = new URL(targetUrl);
  const sockets = new Set<Socket>();
  let offline = false;
  const server = createServer((client) => {
    if (offline) { client.destroy(); return; }
    const upstream = connect(Number(target.port || 6379), target.hostname);
    for (const socket of [client, upstream]) {
      sockets.add(socket);
      socket.on('error', () => { client.destroy(); upstream.destroy(); });
      socket.on('close', () => { sockets.delete(socket); client.destroy(); upstream.destroy(); });
    }
    client.pipe(upstream).pipe(client);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test proxy failed to bind');
  const url = new URL(targetUrl);
  url.hostname = '127.0.0.1';
  url.port = String(address.port);
  return {
    url: url.toString(),
    setOffline(value: boolean) {
      offline = value;
      if (offline) for (const socket of sockets) socket.destroy();
    },
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  };
}

export function testConnections(environment: NodeJS.ProcessEnv = process.env) {
  // Never fall back to DATABASE_URL/REDIS_URL from the developer's .env.
  const testPostgresPort = environment.TEST_POSTGRES_PORT ?? '15432';
  const databaseUrl = environment.TEST_DATABASE_URL
    ?? `postgres://integration:integration-only@127.0.0.1:${testPostgresPort}/instagram_automation_test`;
  const redisUrl = environment.TEST_REDIS_URL ?? 'redis://127.0.0.1:56379/15';
  const parsedDb = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(parsedDb.protocol) || !/^\/[a-zA-Z0-9_]+_test$/.test(parsedDb.pathname)) {
    throw new Error('TEST_DATABASE_URL must name a dedicated database ending in _test');
  }
  const parsedRedis = new URL(redisUrl);
  if (parsedRedis.protocol !== 'redis:' || parsedRedis.pathname !== '/15') {
    throw new Error('TEST_REDIS_URL must use redis:// and the dedicated test database /15');
  }
  return { databaseUrl, redisUrl };
}

export async function createIntegrationContext() {
  const { databaseUrl, redisUrl } = testConnections();
  const schema = `integration_${randomUUID().replaceAll('-', '')}`;
  const prefix = schema;
  const admin = new pg.Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 2000 });
  let database: Database | undefined;
  let cleanupQueue: Queue | undefined;
  let queueReady = false;
  let proxy: Awaited<ReturnType<typeof redisProxy>> | undefined;
  let schemaCreated = false;
  const close = async () => {
    try {
      if (cleanupQueue && queueReady) {
        await cleanupQueue.obliterate({ force: true }); // Only this run's random prefix.
      }
    } finally {
      // Attempt every cleanup even when a failed preflight left Redis unreachable.
      const cleanup = await Promise.allSettled([
        cleanupQueue?.close(), proxy?.close(), database?.close()
      ]);
      try {
        if (schemaCreated) await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      } finally { await admin.end(); }
      const failure = cleanup.find((result) => result.status === 'rejected');
      if (failure?.status === 'rejected') throw failure.reason;
    }
  };
  try {
    try { await admin.query('SELECT 1'); }
    catch (error) {
      throw new Error('Cannot reach integration PostgreSQL. Run npm run test:infra:up on Windows, or configure a dedicated TEST_DATABASE_URL.', { cause: error });
    }
    await admin.query('CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public');
    await admin.query(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    const scopedUrl = new URL(databaseUrl);
    // No public fallback: IF NOT EXISTS must never pick up another schema's tables.
    scopedUrl.searchParams.set('options', `-csearch_path=${schema}`);
    database = new Database(scopedUrl.toString());
    for (const migration of await loadMigrations(fileURLToPath(new URL('../../migrations/', import.meta.url)))) {
      const client = await database.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(migration.sql);
        await client.query('INSERT INTO schema_migrations(name, checksum) VALUES ($1, $2)', [migration.name, migration.checksum]);
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    }
    cleanupQueue = new Queue(MATCH_COMMENT_QUEUE, {
      prefix, connection: { url: redisUrl, maxRetriesPerRequest: 1, connectTimeout: 2000, retryStrategy: () => null }
    });
    cleanupQueue.on('error', () => {});
    try { await cleanupQueue.getJobCounts('wait'); }
    catch (error) {
      throw new Error('Cannot reach integration Redis. Run npm run test:infra:up on Windows, or configure TEST_REDIS_URL with database /15.', { cause: error });
    }
    queueReady = true;
    proxy = await redisProxy(redisUrl);
    const config = loadConfig({
      NODE_ENV: 'test', LOG_LEVEL: 'fatal', DATABASE_URL: scopedUrl.toString(),
      REDIS_URL: proxy.url, QUEUE_PREFIX: prefix, READINESS_TIMEOUT_MS: '250',
      META_APP_SECRET: 'integration-only-signing-secret'
    });
    return { database, config, redisUrl, prefix, proxy, queue: cleanupQueue, close };
  } catch (error) { await close(); throw error; }
}
