import { describe, expect, it } from 'vitest';
import { hashToken, normalizeEmail, randomToken } from '../src/auth.js';

describe('auth helpers', () => {
  it('normalizes email addresses before lookup', () => {
    expect(normalizeEmail('  Developer@Example.LOCAL ')).toBe('developer@example.local');
  });

  it('hashes the same token deterministically without exposing the token', () => {
    expect(hashToken('session-token')).toBe(hashToken('session-token'));
    expect(hashToken('session-token')).not.toBe('session-token');
  });

  it('generates non-empty random tokens', () => {
    expect(randomToken()).not.toBe(randomToken());
  });
});
