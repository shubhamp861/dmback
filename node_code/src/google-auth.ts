import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { Config } from './config.js';

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export interface GoogleIdentity {
  googleSub: string;
  email: string;
  displayName?: string;
}

export type GoogleTokenVerifier = (credential: string, audience: string) => Promise<JWTPayload>;

export class GoogleAuthError extends Error {
  constructor(
    readonly code: 'GOOGLE_CONFIG_MISSING' | 'INVALID_GOOGLE_TOKEN' | 'GOOGLE_EMAIL_UNVERIFIED',
    message: string
  ) {
    super(message);
    this.name = 'GoogleAuthError';
  }
}

export class GoogleIdentityService {
  constructor(
    private readonly config: Config,
    private readonly verifyToken: GoogleTokenVerifier = verifyGoogleIdToken
  ) {}

  async verifyCredential(credential: string): Promise<GoogleIdentity> {
    const clientId = this.config.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new GoogleAuthError('GOOGLE_CONFIG_MISSING', 'Google sign-in is not configured');
    }

    const payload = await this.verifyToken(credential, clientId);
    if (typeof payload.sub !== 'string' || payload.sub.length === 0 || typeof payload.email !== 'string') {
      throw new GoogleAuthError('INVALID_GOOGLE_TOKEN', 'Google did not return a usable identity');
    }
    if (payload.email_verified !== true && payload.email_verified !== 'true') {
      throw new GoogleAuthError('GOOGLE_EMAIL_UNVERIFIED', 'The Google email address is not verified');
    }

    const email = payload.email.trim().toLowerCase();
    if (!email.includes('@')) {
      throw new GoogleAuthError('INVALID_GOOGLE_TOKEN', 'Google did not return a usable email address');
    }

    const displayName = typeof payload.name === 'string' ? payload.name.trim() : '';
    return {
      googleSub: payload.sub,
      email,
      ...(displayName ? { displayName } : {})
    };
  }
}

async function verifyGoogleIdToken(credential: string, audience: string): Promise<JWTPayload> {
  try {
    const { payload } = await jwtVerify(credential, GOOGLE_JWKS, {
      algorithms: ['RS256'],
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience,
      clockTolerance: 5
    });
    return payload;
  } catch {
    throw new GoogleAuthError('INVALID_GOOGLE_TOKEN', 'Google sign-in could not be verified');
  }
}
