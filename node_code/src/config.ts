import 'dotenv/config';
import { z } from 'zod';
import { decodeTokenEncryptionKey, isValidTokenEncryptionKey } from './token-encryption-key.js';

const DEFAULT_ENCRYPTION_KEY = 'MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=';

function hasProtocol(value: string, protocols: string[]): boolean {
  try {
    return protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().url().refine(value => hasProtocol(value, ['postgres:', 'postgresql:'])).default('postgres://instagram:instagram@localhost:5432/instagram_automation'),
  REDIS_URL: z.string().url().refine(value => hasProtocol(value, ['redis:', 'rediss:'])).default('redis://localhost:6379'),
  QUEUE_PREFIX: z.string().min(1).optional(),
  READINESS_TIMEOUT_MS: z.coerce.number().int().positive().max(30000).optional(),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().max(300000).optional(),
  RATE_LIMIT_ENABLED: z.enum(['true', 'false']).transform(value => value === 'true').optional(),
  RATE_LIMIT_AUTH_IP_MAX: z.coerce.number().int().positive().max(100000).optional(),
  RATE_LIMIT_WEBHOOK_IP_MAX: z.coerce.number().int().positive().max(100000).optional(),
  RATE_LIMIT_USER_MAX: z.coerce.number().int().positive().max(100000).optional(),
  RATE_LIMIT_WORKSPACE_MAX: z.coerce.number().int().positive().max(100000).optional(),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().max(86400).optional(),
  IDEMPOTENCY_RETENTION_HOURS: z.coerce.number().int().positive().max(8760).optional(),
  META_APP_ID: z.string().min(1).default('development-app-id'),
  META_APP_SECRET: z.string().min(1).default('development-app-secret'),
  META_REDIRECT_URI: z.string().url().default('http://localhost:3000/v1/auth/instagram/callback'),
  META_API_VERSION: z.string().regex(/^v\d+\.\d+$/).default('v26.0'),
  META_GRAPH_BASE_URL: z.string().url().default('https://graph.instagram.com'),
  META_OAUTH_BASE_URL: z.string().url().default('https://api.instagram.com'),
  META_INSTAGRAM_SCOPES: z.string().default('instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages'),
  META_WEBHOOK_VERIFY_TOKEN: z.string().min(1).default('development-verify-token'),
  GOOGLE_CLIENT_ID: z.preprocess(
    value => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().min(1).regex(/\.apps\.googleusercontent\.com$/i).optional()
  ),
  TOKEN_ENCRYPTION_KEY: z.string().refine(isValidTokenEncryptionKey).default(DEFAULT_ENCRYPTION_KEY),
  WEB_ORIGIN: z.string().url().default('http://localhost:3001'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info')
});

export type Config = z.infer<typeof envSchema>;

const deploymentFields = [
  'DATABASE_URL', 'REDIS_URL', 'META_APP_ID', 'META_APP_SECRET', 'META_REDIRECT_URI',
  'META_API_VERSION', 'META_WEBHOOK_VERIFY_TOKEN', 'GOOGLE_CLIENT_ID',
  'TOKEN_ENCRYPTION_KEY', 'WEB_ORIGIN'
] as const;

// Deliberately recognize known placeholder vocabulary, not arbitrary low-entropy guesses.
function isPlaceholder(value: string): boolean {
  return /(?:development|default|example|replace[\s_-]*(?:with|me)|change[\s_-]*me|your[\s_-]*(?:app|secret|token|key|password)|placeholder|dummy|sample)/i.test(value)
    || /^(?:dev|test)[\s_-]/i.test(value.trim())
    || /^(?:secret|password|token|test|dev|instagram|postgres|redis)$/i.test(value.trim());
}

function isPlaceholderHost(hostname: string): boolean {
  return /^(?:localhost|127(?:\.\d+){3}|\[::1\])$/i.test(hostname)
    || /(?:^|\.)(?:localhost|example\.(?:com|org|net)|example|invalid)$/i.test(hostname)
    || isPlaceholder(hostname);
}

function hasPlaceholderUrl(value: string): boolean {
  const url = new URL(value);
  return isPlaceholderHost(url.hostname)
    || [url.username, url.password].some(part => {
      try {
        return isPlaceholder(decodeURIComponent(part));
      } catch {
        return true;
      }
    });
}

function isSecureEndpoint(value: string): boolean {
  const url = new URL(value);
  const authority = /^https:\/\/([^/?#\\\s]+)/i.exec(value)?.[1];
  return url.protocol === 'https:' && !url.username && !url.password
    && authority !== undefined && !authority.includes('@') && !/[\\\s]/.test(value)
    && !isPlaceholderHost(url.hostname);
}

const fieldReasons: Partial<Record<keyof Config, string>> = {
  DATABASE_URL: 'must be a valid postgres or postgresql URL',
  REDIS_URL: 'must be a valid redis or rediss URL',
  TOKEN_ENCRYPTION_KEY: 'must be canonical base64-encoded 32-byte key material'
};

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): Config {
  const errors: string[] = [];
  const deployment = environment.NODE_ENV === 'staging' || environment.NODE_ENV === 'production';
  if (deployment) {
    for (const field of deploymentFields) {
      if (!environment[field]?.trim()) errors.push(`${field}: must be explicitly supplied`);
    }
  }
  const result = envSchema.safeParse(environment);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof Config;
      // Never expose Zod messages or values: they may contain credentials.
      const name = Object.hasOwn(envSchema.shape, field) ? field : 'configuration';
      errors.push(`${name}: ${fieldReasons[field] ?? 'invalid value'}`);
    }
  } else if (deployment) {
    const config = result.data;
    for (const field of deploymentFields) {
      const value = config[field];
      if (value !== undefined && isPlaceholder(value)) errors.push(`${field}: must not use a placeholder value`);
    }
    for (const field of ['DATABASE_URL', 'REDIS_URL'] as const) {
      if (hasPlaceholderUrl(config[field])) errors.push(`${field}: must not use a development or placeholder endpoint or credential`);
    }
    for (const field of ['META_APP_SECRET', 'META_WEBHOOK_VERIFY_TOKEN'] as const) {
      if (config[field].trim().length < 32) errors.push(`${field}: must contain at least 32 characters`);
    }
    if (config.GOOGLE_CLIENT_ID && isPlaceholder(config.GOOGLE_CLIENT_ID)) {
      errors.push('GOOGLE_CLIENT_ID: must not use a placeholder value');
    }
    for (const field of ['META_REDIRECT_URI', 'WEB_ORIGIN', 'META_GRAPH_BASE_URL', 'META_OAUTH_BASE_URL'] as const) {
      if (!isSecureEndpoint(config[field])) errors.push(`${field}: must use HTTPS without credentials or placeholder hosts`);
    }
    // Check the original spelling too: URL parsing normalizes paths such as /a/.. .
    if (!/^https:\/\/[^/?#\\\s]+\/?$/i.test(config.WEB_ORIGIN)) {
      errors.push('WEB_ORIGIN: must be an origin without a path, query, or fragment');
    }
    const key = decodeTokenEncryptionKey(config.TOKEN_ENCRYPTION_KEY);
    if (key.equals(decodeTokenEncryptionKey(DEFAULT_ENCRYPTION_KEY))
      || key.every(byte => byte === key[0]) || isPlaceholder(key.toString('utf8'))) {
      errors.push('TOKEN_ENCRYPTION_KEY: must not use development, placeholder, or repeated-byte key material');
    }
  }
  if (errors.length || !result.success) {
    throw new Error(`Invalid environment configuration: ${[...new Set(errors)].join('; ')}`);
  }
  return result.data;
}
