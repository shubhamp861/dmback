import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config.js';
import { GoogleAuthError, GoogleIdentityService } from '../src/google-auth.js';

const config = loadConfig({
  NODE_ENV: 'test',
  GOOGLE_CLIENT_ID: '123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com'
});

describe('Google identity verification', () => {
  it('normalizes a verified Google identity', async () => {
    const verifier = vi.fn().mockResolvedValue({
      sub: 'google-user-1',
      email: ' User@Example.test ',
      email_verified: true,
      name: '  Ada Lovelace  '
    });
    const identity = await new GoogleIdentityService(config, verifier).verifyCredential('credential-value');

    expect(identity).toEqual({
      googleSub: 'google-user-1',
      email: 'user@example.test',
      displayName: 'Ada Lovelace'
    });
    expect(verifier).toHaveBeenCalledWith('credential-value', config.GOOGLE_CLIENT_ID);
  });

  it('accepts string email_verified claims', async () => {
    const verifier = vi.fn().mockResolvedValue({
      sub: 'google-user-1',
      email: 'user@example.test',
      email_verified: 'true'
    });
    await expect(new GoogleIdentityService(config, verifier).verifyCredential('credential-value'))
      .resolves.toEqual({ googleSub: 'google-user-1', email: 'user@example.test' });
  });

  it('rejects missing configuration', async () => {
    const service = new GoogleIdentityService(loadConfig({ NODE_ENV: 'test' }), vi.fn());
    await expect(service.verifyCredential('credential-value'))
      .rejects.toMatchObject({ code: 'GOOGLE_CONFIG_MISSING' });
  });

  it('rejects unverified email addresses', async () => {
    const verifier = vi.fn().mockResolvedValue({
      sub: 'google-user-1',
      email: 'user@example.test',
      email_verified: false
    });
    await expect(new GoogleIdentityService(config, verifier).verifyCredential('credential-value'))
      .rejects.toMatchObject({ code: 'GOOGLE_EMAIL_UNVERIFIED' });
  });

  it('rejects payloads without a subject or email', async () => {
    const verifier = vi.fn().mockResolvedValue({ email: 'user@example.test', email_verified: true });
    await expect(new GoogleIdentityService(config, verifier).verifyCredential('credential-value'))
      .rejects.toBeInstanceOf(GoogleAuthError);
  });

  it('rejects malformed credentials without touching the network', async () => {
    const service = new GoogleIdentityService(config);
    await expect(service.verifyCredential('not-a-google-id-token'))
      .rejects.toMatchObject({ code: 'INVALID_GOOGLE_TOKEN' });
  });
});
