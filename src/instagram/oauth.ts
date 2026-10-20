import { z } from 'zod';
import type { AuthContext } from '../auth.js';
import type { Config } from '../config.js';
import type { Database, InstagramAccountRecord } from '../db.js';
import { hashToken, randomToken } from '../auth.js';
import { encryptAccessToken } from './token-crypto.js';

const AUTHORIZE_URL = 'https://www.instagram.com/oauth/authorize';
const OAUTH_STATE_TTL_SECONDS = 10 * 60;

const shortLivedTokenSchema = z.object({
  access_token: z.string().min(1),
  user_id: z.union([z.string(), z.number()]).transform(String)
}).passthrough();

const longLivedTokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive().optional()
}).passthrough();

const profileSchema = z.object({
  user_id: z.union([z.string(), z.number()]).transform(String).optional(),
  id: z.union([z.string(), z.number()]).transform(String).optional(),
  username: z.string().min(1),
  account_type: z.string().optional(),
  profile_picture_url: z.string().url().optional()
}).passthrough();

export class InstagramOAuthError extends Error {
  constructor(
    readonly code: 'META_CONFIG_MISSING' | 'INVALID_OAUTH_STATE' | 'META_TOKEN_EXCHANGE_FAILED'
      | 'META_PROFILE_FAILED' | 'INSTAGRAM_ACCOUNT_TYPE_REQUIRED' | 'INSTAGRAM_ACCOUNT_ALREADY_CONNECTED',
    message: string
  ) {
    super(message);
    this.name = 'InstagramOAuthError';
  }
}

export class InstagramOAuthService {
  constructor(private readonly database: Database, private readonly config: Config) {}

  async createAuthorizationUrl(context: AuthContext): Promise<string> {
    this.assertConfigured();
    const state = randomToken();
    await this.database.createInstagramOAuthState({
      userId: context.userId,
      workspaceId: context.workspaceId,
      sessionId: context.sessionId,
      stateHash: hashToken(state),
      redirectUri: this.config.META_REDIRECT_URI,
      expiresInSeconds: OAUTH_STATE_TTL_SECONDS
    });

    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set('client_id', this.config.META_APP_ID);
    url.searchParams.set('redirect_uri', this.config.META_REDIRECT_URI);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', this.config.META_INSTAGRAM_SCOPES);
    url.searchParams.set('state', state);
    return url.toString();
  }

  async completeAuthorization(input: {
    code: string;
    state: string;
    sessionId: string;
    workspaceId: string;
  }): Promise<InstagramAccountRecord> {
    this.assertConfigured();
    const oauthState = await this.database.consumeInstagramOAuthState(hashToken(input.state), input.sessionId);
    if (!oauthState || oauthState.workspaceId !== input.workspaceId) {
      throw new InstagramOAuthError('INVALID_OAUTH_STATE', 'The Instagram authorization state is invalid or expired');
    }

    const shortLived = await this.exchangeCode(oauthState.redirectUri, input.code);
    const longLived = await this.exchangeLongLivedToken(shortLived.access_token);
    const profile = await this.fetchProfile(longLived.access_token);
    const igUserId = profile.user_id ?? profile.id;
    if (!igUserId) {
      throw new InstagramOAuthError('META_PROFILE_FAILED', 'Instagram profile did not include an account id');
    }

    const accountType = profile.account_type ?? null;
    if (!isProfessionalAccount(accountType)) {
      throw new InstagramOAuthError(
        'INSTAGRAM_ACCOUNT_TYPE_REQUIRED',
        'A professional Instagram account is required'
      );
    }

    const expiresAt = longLived.expires_in
      ? new Date(Date.now() + longLived.expires_in * 1000)
      : null;
    const account = await this.database.upsertInstagramAccount({
      workspaceId: oauthState.workspaceId,
      igUserId,
      username: profile.username,
      accountType,
      profilePictureUrl: profile.profile_picture_url ?? null,
      tokenCiphertext: encryptAccessToken(longLived.access_token, this.config.TOKEN_ENCRYPTION_KEY),
      tokenExpiresAt: expiresAt,
      permissions: this.scopes()
    });
    if (!account) {
      throw new InstagramOAuthError(
        'INSTAGRAM_ACCOUNT_ALREADY_CONNECTED',
        'This Instagram account is already connected to another workspace'
      );
    }
    return account;
  }

  private async exchangeCode(redirectUri: string, code: string): Promise<z.infer<typeof shortLivedTokenSchema>> {
    const body = new URLSearchParams({
      client_id: this.config.META_APP_ID,
      client_secret: this.config.META_APP_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code
    });
    const response = await fetch(new URL('/oauth/access_token', this.config.META_OAUTH_BASE_URL), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) {
      throw new InstagramOAuthError('META_TOKEN_EXCHANGE_FAILED', 'Instagram authorization could not be completed');
    }
    const parsed = shortLivedTokenSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new InstagramOAuthError('META_TOKEN_EXCHANGE_FAILED', 'Instagram returned an invalid token response');
    }
    return parsed.data;
  }

  private async exchangeLongLivedToken(shortLivedToken: string): Promise<z.infer<typeof longLivedTokenSchema>> {
    const url = new URL(`/${this.config.META_API_VERSION}/access_token`, this.config.META_GRAPH_BASE_URL);
    url.searchParams.set('grant_type', 'ig_exchange_token');
    url.searchParams.set('client_secret', this.config.META_APP_SECRET);
    url.searchParams.set('access_token', shortLivedToken);
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      throw new InstagramOAuthError('META_TOKEN_EXCHANGE_FAILED', 'Instagram long-lived token exchange failed');
    }
    const parsed = longLivedTokenSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new InstagramOAuthError('META_TOKEN_EXCHANGE_FAILED', 'Instagram returned an invalid long-lived token response');
    }
    return parsed.data;
  }

  private async fetchProfile(accessToken: string): Promise<z.infer<typeof profileSchema>> {
    const url = new URL(`/${this.config.META_API_VERSION}/me`, this.config.META_GRAPH_BASE_URL);
    url.searchParams.set('fields', 'user_id,username,account_type,profile_picture_url');
    url.searchParams.set('access_token', accessToken);
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      throw new InstagramOAuthError('META_PROFILE_FAILED', 'Instagram profile could not be loaded');
    }
    const parsed = profileSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new InstagramOAuthError('META_PROFILE_FAILED', 'Instagram returned an invalid profile response');
    }
    return parsed.data;
  }

  private scopes(): string[] {
    return this.config.META_INSTAGRAM_SCOPES.split(',').map((scope) => scope.trim()).filter(Boolean);
  }

  private assertConfigured(): void {
    if (this.config.META_APP_ID.startsWith('development-') || this.config.META_APP_SECRET.startsWith('development-')) {
      throw new InstagramOAuthError('META_CONFIG_MISSING', 'Meta OAuth credentials are not configured');
    }
  }
}

function isProfessionalAccount(accountType: string | null): boolean {
  return accountType !== null && ['BUSINESS', 'CREATOR', 'MEDIA_CREATOR', 'PROFESSIONAL'].includes(accountType.toUpperCase());
}
