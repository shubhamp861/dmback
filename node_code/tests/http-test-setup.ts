import Fastify from 'fastify';
import { beforeAll } from 'vitest';

// Fastify lazily loads its injection engine on the first request. On a shared
// Windows filesystem that cold module load can exceed a functional test's 5s
// budget. Initialize it in a bounded setup hook, not inside a role/CSRF assertion.
// Actual endpoint tests keep their original timeout and run without retries.
beforeAll(async () => {
  const app = Fastify();
  app.get('/injection-warmup', async () => ({ ok: true }));
  try { await app.inject('/injection-warmup'); }
  finally { await app.close(); }
}, 30000);
