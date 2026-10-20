import './http-test-setup.js';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

function setup() {
  return buildApp(loadConfig({ NODE_ENV: 'test' }));
}

describe('API request and error contract', () => {
  it('generates unique local request ids and ignores x-request-id', async () => {
    const app = setup();
    try {
      const headers = { 'x-request-id': 'caller-controlled-id' };
      const first = await app.inject({ url: '/missing-one', headers });
      const second = await app.inject({ url: '/missing-two', headers });
      expect(first.json()).toMatchObject({ code: 'NOT_FOUND', message: 'Route not found' });
      expect(first.json().requestId).toEqual(expect.any(String));
      expect(second.json().requestId).toEqual(expect.any(String));
      expect(first.json().requestId).not.toBe('caller-controlled-id');
      expect(first.json().requestId).not.toBe(second.json().requestId);
    } finally { await app.close(); }
  });

  it('keeps validation fields and adds the common error shape', async () => {
    const app = setup();
    try {
      const response = await app.inject({ method: 'POST', url: '/v1/auth/signup',
        headers: { 'content-type': 'application/json' }, payload: { email: 'bad' } });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR', message: expect.any(String),
        requestId: expect.any(String), fields: expect.any(Object) });
    } finally { await app.close(); }
  });

  it('uses stable errors for invalid JSON, non-JSON bodies, and body limits', async () => {
    const app = setup();
    try {
      const invalidJson = await app.inject({ method: 'POST', url: '/v1/auth/signup',
        headers: { 'content-type': 'application/json' }, payload: '{' });
      expect(invalidJson.json()).toMatchObject({ code: 'INVALID_JSON', requestId: expect.any(String) });

      const invalidType = await app.inject({ method: 'POST', url: '/v1/auth/signup',
        headers: { 'content-type': 'text/plain' }, payload: 'email=secret@example.test' });
      expect(invalidType.statusCode).toBe(415);
      expect(invalidType.json()).toMatchObject({ code: 'INVALID_CONTENT_TYPE', requestId: expect.any(String) });
      expect(invalidType.body).not.toContain('secret@example.test');

      const tooLarge = await app.inject({ method: 'POST', url: '/v1/auth/signup',
        headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ email: 'a'.repeat(1_100_000) }) });
      expect(tooLarge.statusCode).toBe(413);
      expect(tooLarge.json()).toMatchObject({ code: 'PAYLOAD_TOO_LARGE', requestId: expect.any(String) });
    } finally { await app.close(); }
  });

  it('preserves text webhook challenge responses', async () => {
    const app = setup();
    try {
      const response = await app.inject({ url: '/v1/webhooks/instagram?hub.mode=subscribe&hub.verify_token=development-verify-token&hub.challenge=challenge-value' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.body).toBe('challenge-value');
    } finally { await app.close(); }
  });
});
