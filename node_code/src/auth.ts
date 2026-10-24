import argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { Database } from './db.js';
import { FakeEmailProvider, type EmailProvider } from './email.js';
import {
  generateSignupOtp,
  hashSignupOtp,
  SIGNUP_OTP_EXPIRY_MINUTES,
  SIGNUP_OTP_MAX_ATTEMPTS,
  SIGNUP_OTP_RESEND_COOLDOWN_SECONDS,
  SIGNUP_VERIFICATION_TOKEN_MINUTES
} from './email-verification.js';

const SESSION_DAYS = 30;
const RESET_TOKEN_MINUTES = 30;

export interface AuthContext {
  sessionId: string;
  userId: string;
  email: string;
  workspaceId: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  csrfTokenHash: string;
}

export interface SessionCredentials {
  sessionToken: string;
  csrfToken: string;
  user: {
    id: string;
    email: string;
    workspaceId: string;
    role: AuthContext['role'];
  };
}

export type GoogleSignInResult =
  | { kind: 'session'; credentials: SessionCredentials }
  | { kind: 'conflict' };

export class AuthService {
  constructor(
    private readonly database: Database,
    private readonly emailProvider: EmailProvider = new FakeEmailProvider()
  ) {}

  async signup(input: { email: string; password: string; workspaceName: string }): Promise<SessionCredentials> {
    const email = normalizeEmail(input.email);
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const client = await this.database.pool.connect();

    try {
      await client.query('BEGIN');
      const userResult = await client.query<{ id: string }>(
        `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
        [email, passwordHash]
      );
      const user = userResult.rows[0];
      if (!user) throw new Error('User was not created');

      const workspaceResult = await client.query<{ id: string }>(
        `INSERT INTO workspaces (name) VALUES ($1) RETURNING id`,
        [input.workspaceName.trim()]
      );
      const workspace = workspaceResult.rows[0];
      if (!workspace) throw new Error('Workspace was not created');

      await client.query(
        `INSERT INTO memberships (workspace_id, user_id, role) VALUES ($1, $2, 'owner')`,
        [workspace.id, user.id]
      );
      const credentials = await this.createSessionWithClient(client, {
        userId: user.id,
        email,
        workspaceId: workspace.id,
        role: 'owner'
      });
      await client.query('COMMIT');
      return credentials;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async login(emailInput: string, password: string): Promise<SessionCredentials | undefined> {
    const email = normalizeEmail(emailInput);
    const result = await this.database.pool.query<{
      user_id: string;
      email: string;
      workspace_id: string;
      role: AuthContext['role'];
      password_hash: string | null;
    }>(
      `SELECT u.id AS user_id, u.email, m.workspace_id, m.role, u.password_hash
       FROM users u
       JOIN memberships m ON m.user_id = u.id
       WHERE u.email = $1
       ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END
       LIMIT 1`,
      [email]
    );
    const row = result.rows[0];
    if (!row?.password_hash || !(await argon2.verify(row.password_hash, password))) {
      return undefined;
    }

    return this.createSession({
      userId: row.user_id,
      email: row.email,
      workspaceId: row.workspace_id,
      role: row.role
    });
  }

  async signInWithGoogle(input: { googleSub: string; email: string; displayName?: string }): Promise<GoogleSignInResult> {
    try {
      return await this.signInWithGoogleTransaction(input);
    } catch (error) {
      if (isUniqueViolation(error)) {
        return this.signInWithGoogleTransaction(input);
      }
      throw error;
    }
  }

  private async signInWithGoogleTransaction(input: {
    googleSub: string;
    email: string;
    displayName?: string;
  }): Promise<GoogleSignInResult> {
    const email = normalizeEmail(input.email);
    const client = await this.database.pool.connect();

    try {
      await client.query('BEGIN');
      let user = (await client.query<{ id: string; email: string }>(
        `SELECT id, email FROM users WHERE google_sub = $1 FOR UPDATE`,
        [input.googleSub]
      )).rows[0];

      if (!user) {
        const linked = await client.query<{ id: string; email: string; google_linked: boolean }>(
          `INSERT INTO users (email, google_sub, email_verified_at)
           VALUES ($1, $2, now())
           ON CONFLICT (email) DO UPDATE
             SET google_sub = COALESCE(users.google_sub, EXCLUDED.google_sub),
                 email_verified_at = COALESCE(users.email_verified_at, now())
           RETURNING id, email, (google_sub = $2) AS google_linked`,
          [email, input.googleSub]
        );
        const row = linked.rows[0];
        if (!row) throw new Error('Google user was not created');
        if (!row.google_linked) {
          await client.query('ROLLBACK');
          return { kind: 'conflict' };
        }
        user = { id: row.id, email: row.email };
      }
      if (!user) throw new Error('Google user was not resolved');

      const membership = (await client.query<{ workspace_id: string; role: AuthContext['role'] }>(
        `SELECT workspace_id, role
         FROM memberships
         WHERE user_id = $1
         ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END
         LIMIT 1`,
        [user.id]
      )).rows[0];

      let workspaceId: string;
      let role: AuthContext['role'];
      if (membership) {
        workspaceId = membership.workspace_id;
        role = membership.role;
      } else {
        const workspace = (await client.query<{ id: string }>(
          'INSERT INTO workspaces (name) VALUES ($1) RETURNING id',
          [workspaceNameForGoogleUser(input.displayName, email)]
        )).rows[0];
        if (!workspace) throw new Error('Workspace was not created');
        await client.query(
          `INSERT INTO memberships (workspace_id, user_id, role) VALUES ($1, $2, 'owner')`,
          [workspace.id, user.id]
        );
        workspaceId = workspace.id;
        role = 'owner';
      }

      const credentials = await this.createSessionWithClient(client, {
        userId: user.id,
        email: user.email,
        workspaceId,
        role
      });
      await client.query('COMMIT');
      return { kind: 'session', credentials };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async requestSignupOtp(emailInput: string): Promise<void> {
    const email = normalizeEmail(emailInput);
    const otp = generateSignupOtp();
    const challengeId = randomUUID();
    const result = await this.database.createSignupOtpChallenge({
      email,
      challengeId,
      otpHash: hashSignupOtp(otp, challengeId),
      expiresInMinutes: SIGNUP_OTP_EXPIRY_MINUTES,
      resendCooldownSeconds: SIGNUP_OTP_RESEND_COOLDOWN_SECONDS,
      maxAttempts: SIGNUP_OTP_MAX_ATTEMPTS
    });
    if (result.kind === 'created') {
      await this.emailProvider.sendSignupOtp({ to: email, otp, expiresInMinutes: SIGNUP_OTP_EXPIRY_MINUTES });
    }
  }

  async verifySignupOtp(emailInput: string, otp: string): Promise<string | undefined> {
    const email = normalizeEmail(emailInput);
    const verificationToken = randomToken();
    const result = await this.database.verifySignupOtp({
      email,
      otp,
      verificationTokenHash: hashToken(verificationToken),
      verificationTokenMinutes: SIGNUP_VERIFICATION_TOKEN_MINUTES
    });
    return result.kind === 'verified' ? verificationToken : undefined;
  }

  async completeSignup(input: {
    verificationToken: string;
    password: string;
    workspaceName: string;
  }): Promise<SessionCredentials | 'duplicate' | undefined> {
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const client = await this.database.pool.connect();
    try {
      await client.query('BEGIN');
      const challengeResult = await client.query<{ email: string }>(
        `SELECT email
         FROM email_verification_challenges
         WHERE verification_token_hash = $1
           AND verification_token_consumed_at IS NULL
           AND verification_token_expires_at > now()
         FOR UPDATE`,
        [hashToken(input.verificationToken)]
      );
      const challenge = challengeResult.rows[0];
      if (!challenge) {
        await client.query('ROLLBACK');
        return undefined;
      }

      const existing = await client.query<{ id: string }>('SELECT id FROM users WHERE email = $1 FOR UPDATE', [challenge.email]);
      if (existing.rows[0]) {
        await client.query(
          'UPDATE email_verification_challenges SET verification_token_consumed_at = now() WHERE verification_token_hash = $1',
          [hashToken(input.verificationToken)]
        );
        await client.query('COMMIT');
        return 'duplicate';
      }

      const userResult = await client.query<{ id: string }>(
        `INSERT INTO users (email, password_hash, email_verified_at)
         VALUES ($1, $2, now()) RETURNING id`,
        [challenge.email, passwordHash]
      );
      const user = userResult.rows[0];
      if (!user) throw new Error('User was not created');
      const workspaceResult = await client.query<{ id: string }>(
        'INSERT INTO workspaces (name) VALUES ($1) RETURNING id',
        [input.workspaceName.trim()]
      );
      const workspace = workspaceResult.rows[0];
      if (!workspace) throw new Error('Workspace was not created');
      await client.query(
        `INSERT INTO memberships (workspace_id, user_id, role) VALUES ($1, $2, 'owner')`,
        [workspace.id, user.id]
      );
      const credentials = await this.createSessionWithClient(client, {
        userId: user.id,
        email: challenge.email,
        workspaceId: workspace.id,
        role: 'owner'
      });
      await client.query(
        'UPDATE email_verification_challenges SET verification_token_consumed_at = now() WHERE verification_token_hash = $1',
        [hashToken(input.verificationToken)]
      );
      await client.query('COMMIT');
      return credentials;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async createSession(user: {
    userId: string;
    email: string;
    workspaceId: string;
    role: AuthContext['role'];
  }): Promise<SessionCredentials> {
    return this.createSessionWithPool(user);
  }

  async authenticate(sessionToken: string | undefined): Promise<AuthContext | undefined> {
    if (!sessionToken) return undefined;
    const result = await this.database.pool.query<AuthContext>(
      `SELECT s.id AS "sessionId", u.id AS "userId", u.email,
              m.workspace_id AS "workspaceId", m.role, s.csrf_token_hash AS "csrfTokenHash"
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
       JOIN memberships m ON m.user_id = u.id AND m.workspace_id = s.workspace_id
       WHERE s.token_hash = $1 AND s.expires_at > now()
       ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END
       LIMIT 1`,
      [hashToken(sessionToken)]
    );
    const context = result.rows[0];
    if (!context) return undefined;
    await this.database.pool.query('UPDATE user_sessions SET last_seen_at = now() WHERE id = $1', [context.sessionId]);
    return context;
  }

  async logout(sessionToken: string | undefined): Promise<void> {
    if (!sessionToken) return;
    await this.database.pool.query('DELETE FROM user_sessions WHERE token_hash = $1', [hashToken(sessionToken)]);
  }

  async requestPasswordReset(emailInput: string): Promise<void> {
    const email = normalizeEmail(emailInput);
    const result = await this.database.pool.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) return;
    const token = randomToken();
    await this.database.pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + ($3::text || ' minutes')::interval)`,
      [user.id, hashToken(token), RESET_TOKEN_MINUTES]
    );
    // Delivery is intentionally not implemented yet. Do not return this token
    // from the HTTP API; an email/provider integration will deliver it later.
    console.info('Password reset requested');
  }

  async resetPassword(token: string, password: string): Promise<boolean> {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const client = await this.database.pool.connect();
    try {
      await client.query('BEGIN');
      const tokenResult = await client.query<{ user_id: string }>(
        `SELECT user_id FROM password_reset_tokens
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
         FOR UPDATE`,
        [hashToken(token)]
      );
      const reset = tokenResult.rows[0];
      if (!reset) {
        await client.query('ROLLBACK');
        return false;
      }
      await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, reset.user_id]);
      await client.query('UPDATE password_reset_tokens SET used_at = now() WHERE token_hash = $1', [hashToken(token)]);
      await client.query('DELETE FROM user_sessions WHERE user_id = $1', [reset.user_id]);
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async createSessionWithPool(user: {
    userId: string;
    email: string;
    workspaceId: string;
    role: AuthContext['role'];
  }): Promise<SessionCredentials> {
    const client = await this.database.pool.connect();
    try {
      return await this.createSessionWithClient(client, user);
    } finally {
      client.release();
    }
  }

  private async createSessionWithClient(
    client: PoolClient,
    user: { userId: string; email: string; workspaceId: string; role: AuthContext['role'] }
  ): Promise<SessionCredentials> {
    const sessionToken = randomToken();
    const csrfToken = randomToken();
    const result = await client.query<{ id: string }>(
      `INSERT INTO user_sessions (user_id, workspace_id, token_hash, csrf_token_hash, expires_at)
       VALUES ($1, $2, $3, $4, now() + ($5::text || ' days')::interval)
       RETURNING id`,
      [user.userId, user.workspaceId, hashToken(sessionToken), hashToken(csrfToken), SESSION_DAYS]
    );
    const session = result.rows[0];
    if (!session) throw new Error('Session was not created');
    return {
      sessionToken,
      csrfToken,
      user: { id: user.userId, email: user.email, workspaceId: user.workspaceId, role: user.role }
    };
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

function workspaceNameForGoogleUser(displayName: string | undefined, email: string): string {
  const fallback = email.split('@')[0] ?? 'My';
  const base = (displayName?.trim() || fallback).replace(/\s+/g, ' ').slice(0, 100).trim();
  return `${base || 'My'}'s workspace`;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
