import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { decodeTokenEncryptionKey } from '../src/token-encryption-key.js';
import { encryptAccessToken } from '../src/instagram/token-crypto.js';

// Synthetic, fixed fixtures only. Never copy a developer's .env into tests.
const key = Buffer.from(Array.from({ length: 32 }, (_, index) => index + 17)).toString('base64');
const deployment = {
  NODE_ENV: 'production', DATABASE_URL: 'postgres://app:8aa48720a3f64438@pg.dmlink.internal/app',
  REDIS_URL: 'rediss://app:2289561f8d704359@cache.dmlink.internal:6380',
  META_APP_ID: '123456789012345', META_APP_SECRET: '831f864d7abb88b6433b3b1011d25e01',
  META_WEBHOOK_VERIFY_TOKEN: 'aec428eddd871f01bf8d59f99f3d412e', TOKEN_ENCRYPTION_KEY: key,
  GOOGLE_CLIENT_ID: '123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com',
  META_REDIRECT_URI: 'https://api.dmlink.test/v1/auth/instagram/callback',
  META_API_VERSION: 'v23.0', WEB_ORIGIN: 'https://app.dmlink.test'
};

describe('configuration security', () => {
  it('preserves local development and test defaults', () => {
    expect(loadConfig({}).NODE_ENV).toBe('development');
    expect(loadConfig({ NODE_ENV: 'test' }).DATABASE_URL).toContain('localhost');
  });

  it.each(['production', 'staging'])('accepts explicit nonplaceholder settings for %s', (NODE_ENV) => {
    expect(loadConfig({ ...deployment, NODE_ENV }).TOKEN_ENCRYPTION_KEY).toBe(key);
  });

  it.each([
    'DATABASE_URL', 'REDIS_URL', 'META_APP_ID', 'META_APP_SECRET', 'META_REDIRECT_URI',
    'META_API_VERSION', 'META_WEBHOOK_VERIFY_TOKEN', 'GOOGLE_CLIENT_ID', 'TOKEN_ENCRYPTION_KEY', 'WEB_ORIGIN'
  ])('requires explicit deployment configuration: %s', (field) => {
    const environment: NodeJS.ProcessEnv = { ...deployment };
    delete environment[field];
    expect(() => loadConfig(environment)).toThrow(`${field}: must be explicitly supplied`);
  });

  it.each([
    ['META_APP_ID', 'development-app-id'], ['META_APP_SECRET', 'development-app-secret'],
    ['META_APP_SECRET', 'replace-with-a-long-production-app-secret'],
    ['META_WEBHOOK_VERIFY_TOKEN', 'change-me-to-a-long-production-token'],
    ['GOOGLE_CLIENT_ID', 'development-google-client-id.apps.googleusercontent.com'],
    ['DATABASE_URL', 'postgres://instagram:instagram@pg.dmlink.internal/app'],
    ['REDIS_URL', 'redis://localhost:6379'],
    ['TOKEN_ENCRYPTION_KEY', loadConfig({}).TOKEN_ENCRYPTION_KEY],
    ['TOKEN_ENCRYPTION_KEY', Buffer.alloc(32, 4).toString('base64')]
  ])('rejects deployment defaults/placeholders: %s', (field, value) => {
    expect(() => loadConfig({ ...deployment, [field]: value })).toThrow(field);
  });

  it.each(['META_APP_SECRET', 'META_WEBHOOK_VERIFY_TOKEN'])('rejects short deployment secrets: %s', (field) => {
    expect(() => loadConfig({ ...deployment, [field]: '94a63ef0157c' })).toThrow('at least 32');
  });

  it.each([
    ['DATABASE_URL', 'https://pg.dmlink.internal/app'], ['REDIS_URL', 'https://cache.dmlink.internal'],
    ['META_REDIRECT_URI', 'http://api.dmlink.test/callback'],
    ['WEB_ORIGIN', 'http://app.dmlink.test'], ['WEB_ORIGIN', 'https://app.dmlink.test/path'],
    ['WEB_ORIGIN', 'https://app.dmlink.test?token=hidden'],
    ['WEB_ORIGIN', 'https://app.dmlink.test#fragment'],
    ['WEB_ORIGIN', 'https://user:password@app.dmlink.test'],
    ['META_GRAPH_BASE_URL', 'http://graph.instagram.com'],
    ['META_OAUTH_BASE_URL', 'https://user:password@api.instagram.com']
  ])('rejects unsafe deployment URL configuration: %s', (field, value) => {
    expect(() => loadConfig({ ...deployment, [field]: value })).toThrow(field);
  });

  it('reports invalid fields without echoing input values', () => {
    const sentinel = 'PRIVATE_SENTINEL_DO_NOT_LOG';
    try {
      loadConfig({ ...deployment, LOG_LEVEL: sentinel, TOKEN_ENCRYPTION_KEY: sentinel, DATABASE_URL: sentinel });
      expect.fail('Expected validation failure');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('LOG_LEVEL');
      expect(message).toContain('TOKEN_ENCRYPTION_KEY');
      expect(message).toContain('DATABASE_URL');
      expect(message).not.toContain(sentinel);
    }
  });

  it.each([key.trimEnd().slice(0, -1), `${key}\n`, `${key}!!!!`, Buffer.alloc(31).toString('base64')])(
    'rejects noncanonical or incorrect-length keys in config and encryption', (invalid) => {
      expect(() => loadConfig({ TOKEN_ENCRYPTION_KEY: invalid })).toThrow('TOKEN_ENCRYPTION_KEY');
      expect(() => decodeTokenEncryptionKey(invalid)).toThrow('TOKEN_ENCRYPTION_KEY');
      expect(() => encryptAccessToken('synthetic-token', invalid)).toThrow('TOKEN_ENCRYPTION_KEY');
    });
});
