import { describe, expect, it } from 'vitest';
import { decryptAccessToken, encryptAccessToken } from '../src/instagram/token-crypto.js';

const key = Buffer.from('01234567890123456789012345678901').toString('base64');

describe('Instagram token encryption', () => {
  it('encrypts and decrypts access tokens', () => {
    const encrypted = encryptAccessToken('long-lived-token', key);
    expect(encrypted.toString('utf8')).not.toContain('long-lived-token');
    expect(decryptAccessToken(encrypted, key)).toBe('long-lived-token');
  });

  it('rejects the wrong encryption key', () => {
    const encrypted = encryptAccessToken('long-lived-token', key);
    const wrongKey = Buffer.from('12345678901234567890123456789012').toString('base64');
    expect(() => decryptAccessToken(encrypted, wrongKey)).toThrow();
  });
});
