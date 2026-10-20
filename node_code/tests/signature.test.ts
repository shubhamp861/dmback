import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyMetaSignature } from '../src/instagram/signature.js';

describe('verifyMetaSignature', () => {
  const body = Buffer.from('{"object":"instagram"}');
  const secret = 'test-secret';
  const signature = createHmac('sha256', secret).update(body).digest('hex');

  it('accepts a valid signature', () => {
    expect(verifyMetaSignature(body, `sha256=${signature}`, secret)).toBe(true);
  });

  it('rejects a modified body', () => {
    expect(verifyMetaSignature(Buffer.from('{"object":"modified"}'), `sha256=${signature}`, secret)).toBe(false);
  });

  it('rejects a missing or malformed header', () => {
    expect(verifyMetaSignature(body, undefined, secret)).toBe(false);
    expect(verifyMetaSignature(body, 'sha1=abc', secret)).toBe(false);
  });
});
