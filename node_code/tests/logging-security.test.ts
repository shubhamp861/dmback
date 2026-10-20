import './http-test-setup.js';
import { Writable } from 'node:stream';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerSafeErrorHandlers, safeError, safeJobError, safeLoggerOptions, safeRequest } from '../src/logging.js';

const sentinel = 'PRIVATE_SENTINEL_DO_NOT_LOG';

describe('safe logging and public error boundaries', () => {
  it('does not persist raw processor exception text or causes in BullMQ diagnostics', () => {
    const original = Object.assign(new Error(sentinel, { cause: new Error(sentinel) }), { code: '23503', detail: sentinel });
    const sanitized = safeJobError(original);
    expect(sanitized).toBeInstanceOf(Error);
    expect(sanitized.message).toBe('WEBHOOK_PROCESSING_FAILED');
    expect(safeError(sanitized)).toEqual({ name: 'Error', code: '23503' });
    expect(sanitized.stack).not.toContain(sentinel);
    expect(sanitized.cause).toBeUndefined();
    expect(JSON.stringify(sanitized)).not.toContain(sentinel);
  });

  it('allows only reviewed exception categories, never messages/stacks/details/causes', () => {
    const error = Object.assign(new Error(sentinel, { cause: new Error(sentinel) }), {
      code: 'ECONNREFUSED', detail: sentinel, password: sentinel
    });
    expect(safeError(error)).toEqual({ name: 'Error', code: 'ECONNREFUSED' });
    expect(safeError({ name: sentinel, code: sentinel })).toEqual({ name: 'Error' });
    expect(safeError(sentinel)).toEqual({ name: 'Error' });
    expect(safeError(new Proxy({}, { get() { throw new Error(sentinel); } }))).toEqual({ name: 'Error' });
  });

  it('uses a registered route template, not raw URL, parameters or headers', () => {
    expect(safeRequest({ method: 'GET', url: `/oauth?code=${sentinel}`, headers: { authorization: sentinel },
      routeOptions: { url: '/v1/automations/:id' } }))
      .toEqual({ method: 'GET', url: '/v1/automations/:id' });
    expect(safeRequest({ method: sentinel, url: `/${sentinel}` })).toEqual({ method: 'OTHER', url: '[unmatched]' });
  });

  it('redacts structured secrets from actual Pino log output', async () => {
    const lines: string[] = [];
    const stream = new Writable({ write(chunk, _encoding, done) { lines.push(String(chunk)); done(); } });
    const app = Fastify({ logger: { ...safeLoggerOptions('info'), stream }, disableRequestLogging: true });
    app.log.error({ err: Object.assign(new Error(sentinel), { code: 'ECONNRESET' }),
      password: sentinel, body: { password: sentinel }, credentials: { accessToken: sentinel },
      req: { method: 'GET', url: `/callback?state=${sentinel}`, cookies: { session: sentinel }, routeOptions: { url: '/callback' } }
    }, 'synthetic operational failure');
    await app.close();
    const output = lines.join('');
    expect(output).not.toContain(sentinel);
    expect(output).toContain('ECONNRESET');
    expect(output).toContain('synthetic operational failure');
  });

  it('keeps exceptions, query secrets and unmatched paths out of HTTP errors and logs', async () => {
    const lines: string[] = [];
    const stream = new Writable({ write(chunk, _encoding, done) { lines.push(String(chunk)); done(); } });
    const app = Fastify({ logger: { ...safeLoggerOptions('info'), stream }, disableRequestLogging: true, requestIdHeader: false });
    registerSafeErrorHandlers(app);
    app.get('/failure/:id', async () => { throw Object.assign(new Error(sentinel), { statusCode: 400 }); });
    app.get('/server-error', async () => { throw new Error(`postgres://user:${sentinel}@host/db`); });
    try {
      for (const [url, status] of [
        [`/failure/${sentinel}?code=${sentinel}&state=${sentinel}`, 400],
        [`/server-error?access_token=${sentinel}`, 500], [`/unknown/${sentinel}`, 404]
      ] as const) {
        const response = await app.inject({ url, headers: { 'x-request-id': sentinel, authorization: `Bearer ${sentinel}`, cookie: `session=${sentinel}` } });
        expect(response.statusCode).toBe(status);
        expect(response.body).not.toContain(sentinel);
      }
      const malformed = await app.inject({ method: 'POST', url: `/unknown?reset_token=${sentinel}`,
        headers: { 'content-type': 'application/json' }, payload: `{"${sentinel}":` });
      expect(malformed.statusCode).toBeGreaterThanOrEqual(400);
      expect(malformed.body).not.toContain(sentinel);
    } finally { await app.close(); }
    expect(lines.join('')).not.toContain(sentinel);
    expect(lines.join('')).toContain('request failed');
  });
});
