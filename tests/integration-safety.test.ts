import { describe, expect, it } from 'vitest';
import { testConnections } from './integration/helpers.js';

describe('integration test isolation safeguards', () => {
  it('never uses developer DATABASE_URL or REDIS_URL as fallbacks', () => {
    const connections = testConnections({ DATABASE_URL: 'postgres://localhost/development', REDIS_URL: 'redis://localhost/0' });
    expect(new URL(connections.databaseUrl).pathname).toBe('/instagram_automation_test');
    expect(new URL(connections.databaseUrl).port).toBe('55432');
    expect(new URL(connections.redisUrl).port).toBe('56379');
    expect(new URL(connections.redisUrl).pathname).toBe('/15');
  });

  it.each(['postgres://localhost/instagram_automation', 'postgres://localhost/postgres', 'https://localhost/example_test'])(
    'rejects unsafe database target %s before creating a pool', (url) => {
      expect(() => testConnections({ TEST_DATABASE_URL: url })).toThrow('dedicated database ending in _test');
    });

  it.each(['redis://localhost', 'redis://localhost/0', 'redis://localhost/1'])(
    'rejects Redis targets outside test database 15: %s', (url) => {
      expect(() => testConnections({ TEST_REDIS_URL: url })).toThrow('dedicated test database /15');
    });

  it('accepts explicitly supplied dedicated CI services', () => {
    expect(testConnections({ TEST_DATABASE_URL: 'postgres://localhost/ci_test', TEST_REDIS_URL: 'redis://localhost/15' }))
      .toEqual({ databaseUrl: 'postgres://localhost/ci_test', redisUrl: 'redis://localhost/15' });
  });
});
