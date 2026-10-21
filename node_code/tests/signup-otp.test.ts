import './http-test-setup.js';
import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { AuthService, hashToken } from '../src/auth.js';
import type { Config } from '../src/config.js';
import { FakeEmailProvider } from '../src/email.js';
import {
  hashSignupOtp,
  SIGNUP_OTP_EXPIRY_MINUTES,
  SIGNUP_OTP_MAX_ATTEMPTS,
  SIGNUP_OTP_RESEND_COOLDOWN_SECONDS,
  SIGNUP_VERIFICATION_TOKEN_MINUTES
} from '../src/email-verification.js';
import { registerRoutes } from '../src/routes.js';

describe('signup OTP primitives and service', () => {
  it('passes a six-digit OTP only to the provider and stores a challenge-bound hash', async () => {
    const database = {
      createSignupOtpChallenge: vi.fn().mockResolvedValue({ kind: 'created', challengeId: 'challenge-id' }),
      verifySignupOtp: vi.fn().mockResolvedValue({ kind: 'invalid' })
    };
    const provider = new FakeEmailProvider();
    const service = new AuthService({ ...database } as never, provider);

    await service.requestSignupOtp(' NewUser@Example.test ');
    const message = provider.signupOtpMessages[0];
    expect(message).toMatchObject({ to: 'newuser@example.test', expiresInMinutes: SIGNUP_OTP_EXPIRY_MINUTES });
    expect(message?.otp).toMatch(/^\d{6}$/);
    const challengeInput = database.createSignupOtpChallenge.mock.calls[0]?.[0] as {
      challengeId: string; otpHash: string;
    };
    expect(database.createSignupOtpChallenge).toHaveBeenCalledWith(expect.objectContaining({
      email: 'newuser@example.test', challengeId: challengeInput.challengeId,
      otpHash: hashSignupOtp(message!.otp, challengeInput.challengeId),
      expiresInMinutes: SIGNUP_OTP_EXPIRY_MINUTES,
      resendCooldownSeconds: SIGNUP_OTP_RESEND_COOLDOWN_SECONDS,
      maxAttempts: SIGNUP_OTP_MAX_ATTEMPTS
    }));
    expect(hashSignupOtp(message!.otp, 'challenge-id')).not.toBe(message!.otp);
  });

  it.each([{ kind: 'user_exists' }, { kind: 'cooldown' }])('does not send mail for $kind', async (result) => {
    const database = {
      createSignupOtpChallenge: vi.fn().mockResolvedValue(result),
      verifySignupOtp: vi.fn()
    };
    const provider = new FakeEmailProvider();
    await new AuthService(database as never, provider).requestSignupOtp('user@example.test');
    expect(provider.signupOtpMessages).toEqual([]);
  });

  it('hashes verification tokens and keeps OTP policy bounded', async () => {
    const database = {
      createSignupOtpChallenge: vi.fn(),
      verifySignupOtp: vi.fn().mockResolvedValue({ kind: 'verified' })
    };
    const token = await new AuthService(database as never).verifySignupOtp('user@example.test', '123456');
    expect(token).toEqual(expect.any(String));
    expect(database.verifySignupOtp).toHaveBeenCalledWith({
      email: 'user@example.test', otp: '123456', verificationTokenHash: hashToken(token!),
      verificationTokenMinutes: SIGNUP_VERIFICATION_TOKEN_MINUTES
    });
  });
});

describe('signup OTP HTTP contract', () => {
  async function setup() {
    const auth = {
      requestSignupOtp: vi.fn().mockResolvedValue(undefined),
      verifySignupOtp: vi.fn().mockResolvedValue(undefined),
      completeSignup: vi.fn()
    };
    const app = Fastify();
    await app.register(cookie);
    await registerRoutes(app, {
      config: { NODE_ENV: 'test', RATE_LIMIT_ENABLED: false } as Config,
      database: {} as Parameters<typeof registerRoutes>[1]['database'],
      queue: {} as Parameters<typeof registerRoutes>[1]['queue'],
      auth: auth as unknown as Parameters<typeof registerRoutes>[1]['auth'],
      instagramOAuth: {} as Parameters<typeof registerRoutes>[1]['instagramOAuth']
    });
    return { app, auth };
  }

  it('accepts OTP requests without disclosing duplicate or unknown emails', async () => {
    const { app, auth } = await setup();
    try {
      const first = await app.inject({ method: 'POST', url: '/v1/auth/signup/request-otp', payload: { email: 'new@example.test' } });
      const second = await app.inject({ method: 'POST', url: '/v1/auth/signup/request-otp', payload: { email: 'existing@example.test' } });
      expect(first.statusCode).toBe(202);
      expect(second.statusCode).toBe(202);
      expect(first.json()).toEqual({ data: { accepted: true } });
      expect(second.json()).toEqual({ data: { accepted: true } });
    } finally { await app.close(); }
    expect(auth.requestSignupOtp).toHaveBeenCalledTimes(2);
  });

  it.each(['expired', 'max-attempts', 'replay', 'duplicate-email'])('maps %s to the same generic OTP error', async () => {
    const { app, auth } = await setup();
    try {
      const response = await app.inject({ method: 'POST', url: '/v1/auth/signup/verify-otp', payload: {
        email: 'user@example.test', otp: '123456'
      } });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'INVALID_SIGNUP_OTP' });
    } finally { await app.close(); }
    expect(auth.verifySignupOtp).toHaveBeenCalledWith('user@example.test', '123456');
  });

  it('returns a verification token and creates the existing cookie session on completion', async () => {
    const { app, auth } = await setup();
    auth.verifySignupOtp.mockResolvedValue('verification-token-value');
    auth.completeSignup.mockResolvedValue({
      sessionToken: 'session-value', csrfToken: 'csrf-value',
      user: { id: 'user-id', email: 'user@example.test', workspaceId: 'workspace-id', role: 'owner' }
    });
    try {
      const verified = await app.inject({ method: 'POST', url: '/v1/auth/signup/verify-otp', payload: {
        email: 'USER@example.test', otp: '123456'
      } });
      expect(verified.statusCode).toBe(200);
      expect(verified.json()).toEqual({ data: { verificationToken: 'verification-token-value' } });

      const completed = await app.inject({ method: 'POST', url: '/v1/auth/signup/complete', payload: {
        verificationToken: 'verification-token-value', password: 'a-secure-password', workspaceName: 'Workspace'
      } });
      expect(completed.statusCode).toBe(201);
      expect(completed.json()).toEqual({ data: { id: 'user-id', email: 'user@example.test', workspaceId: 'workspace-id', role: 'owner' } });
      expect(completed.headers['set-cookie']).toEqual(expect.arrayContaining([
        expect.stringContaining('session=session-value'), expect.stringContaining('csrf_token=csrf-value')
      ]));
    } finally { await app.close(); }
  });

  it('rejects a duplicate email at completion without creating a session', async () => {
    const { app, auth } = await setup();
    auth.completeSignup.mockResolvedValue('duplicate');
    try {
      const response = await app.inject({ method: 'POST', url: '/v1/auth/signup/complete', payload: {
        verificationToken: 'verification-token-value', password: 'a-secure-password'
      } });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ code: 'EMAIL_TAKEN' });
      expect(response.headers['set-cookie']).toBeUndefined();
    } finally { await app.close(); }
  });
});
