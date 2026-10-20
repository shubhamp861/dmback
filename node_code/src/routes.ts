import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { hashToken, type AuthContext, type AuthService } from './auth.js';
import { hasPermission, type Permission } from './authorization.js';
import { automationInputSchema } from './domain/automation.js';
import { InstagramOAuthError, type InstagramOAuthService } from './instagram/oauth.js';
import { verifyMetaSignature, sha256Hex } from './instagram/signature.js';
import { extractCommentEvents, parseInstagramWebhook } from './instagram/webhook.js';
import type { Config } from './config.js';
import type { Database } from './db.js';
import type { EventQueue } from './queue.js';
import { QUEUE_DISPATCH_FAILURE, safeError } from './logging.js';
import { fingerprintJson, isValidIdempotencyKey } from './idempotency.js';
import { NoopRateLimiter, type RateLimiter } from './rate-limit.js';

interface RouteDependencies {
  config: Config;
  database: Database;
  queue: EventQueue;
  auth: AuthService;
  instagramOAuth: InstagramOAuthService;
  rateLimiter?: RateLimiter;
}

const idParamsSchema = z.object({ id: z.string().uuid() });
const signupSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(12).max(256),
  workspaceName: z.string().trim().min(1).max(120).default('My workspace')
});
const loginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(256)
});
const resetRequestSchema = z.object({ email: z.string().trim().email().max(320) });
const resetConfirmSchema = z.object({ token: z.string().min(20).max(256), password: z.string().min(12).max(256) });
const instagramOAuthCallbackSchema = z.object({
  code: z.string().min(1).max(4096).optional(),
  state: z.string().min(20).max(256).optional(),
  error: z.string().optional(),
  error_reason: z.string().optional()
});
const AUTH_COOKIE = 'session';
const CSRF_COOKIE = 'csrf_token';
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export async function registerRoutes(app: FastifyInstance, dependencies: RouteDependencies): Promise<void> {
  const { config, database, queue, auth, instagramOAuth } = dependencies;
  const rateLimiter = dependencies.rateLimiter ?? new NoopRateLimiter();

  // JSON body endpoints reject accidental form/text submissions before handlers
  // run. The signed webhook is intentionally excluded because it authenticates
  // and parses the preserved raw body itself.
  app.addHook('preValidation', async (request, reply) => {
    if (!['POST', 'PUT', 'PATCH'].includes(request.method) || request.routeOptions.url === '/v1/webhooks/instagram') return;
    if (request.body !== undefined) {
      const contentType = request.headers['content-type'];
      if (typeof contentType !== 'string' || !contentType.toLowerCase().startsWith('application/json')) {
        return reply.code(415).send({ code: 'INVALID_CONTENT_TYPE', message: 'Content-Type must be application/json' });
      }
    }
  });

  // Liveness must remain available during dependency outages. Use /ready for
  // database and Redis checks before directing application traffic here.
  app.get('/health', async () => ({ status: 'ok' }));

  app.post('/v1/webhook-events/:id/replay', async (request, reply) => {
    const context = await requireAuth(request, reply, auth, 'webhooks:replay');
    if (!context) return;
    if (!await enforceAuthenticatedRateLimit(request, reply, rateLimiter, config, context)) return;
    if (!validateCsrf(request, reply, context)) return;
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ code: 'INVALID_ID', message: 'Invalid webhook event id' });
    // Identity and workspace come only from the authenticated session.
    const body = z.object({}).strict().safeParse(request.body ?? {});
    if (!body.success) return validationError(reply, body.error);
    const idempotency = await beginRouteIdempotency(request, reply, database, context);
    if (!idempotency) return;
    if (idempotency.kind === 'replay') return reply.code(idempotency.statusCode).send(idempotency.body);
    let replay: Awaited<ReturnType<Database['requestWebhookReplay']>>;
    try {
      replay = await database.requestWebhookReplay({
        webhookEventId: params.data.id, workspaceId: context.workspaceId, actorUserId: context.userId
      });
    } catch (error) {
      await abandonRouteIdempotency(database, idempotency.id);
      throw error;
    }
    if (!replay) {
      const responseBody = { code: 'NOT_FOUND', message: 'Replayable webhook event not found' };
      await finishRouteIdempotency(database, idempotency.id, 404, responseBody);
      return reply.code(404).send(responseBody);
    }
    // PostgreSQL contains both the audit record and replay request before acceptance.
    // The worker dispatches it; a Redis outage must not discard an accepted replay.
    const responseBody = { data: replay };
    await finishRouteIdempotency(database, idempotency.id, 202, responseBody);
    return reply.code(202).send(responseBody);
  });

  app.get('/v1/webhooks/instagram', async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    if (query['hub.mode'] !== 'subscribe' || query['hub.verify_token'] !== config.META_WEBHOOK_VERIFY_TOKEN) {
      return reply.code(403).send({ code: 'WEBHOOK_VERIFICATION_FAILED', message: 'Verification failed' });
    }
    return reply.type('text/plain').send(query['hub.challenge'] ?? '');
  });

  app.post('/v1/webhooks/instagram', async (request, reply) => {
    if (!await enforceRateLimit(request, reply, rateLimiter, config, `ip:${request.ip}`, config.RATE_LIMIT_WEBHOOK_IP_MAX ?? 120)) return;
    const rawBody = getRawBody(request);
    const signatureHeader = request.headers['x-hub-signature-256'];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    if (!verifyMetaSignature(rawBody, signature, config.META_APP_SECRET)) {
      return reply.code(401).send({ code: 'INVALID_SIGNATURE', message: 'Invalid webhook signature' });
    }

    let payload: ReturnType<typeof parseInstagramWebhook>;
    try {
      payload = parseInstagramWebhook(JSON.parse(rawBody.toString('utf8')) as unknown);
    } catch {
      return reply.code(400).send({ code: 'INVALID_PAYLOAD', message: 'Invalid webhook payload' });
    }

    const event = await database.insertWebhookEvent(payload, sha256Hex(rawBody));
    // The event and its outbox record are committed together. Immediate
    // dispatch is only an optimization; the worker retries the outbox if Redis
    // is unavailable or this request cannot dispatch it.
    try {
      await queue.enqueueMatch({ webhookEventId: event.id });
      await database.markWebhookDispatched(event.id);
    } catch (error) {
      try {
        await database.markWebhookDispatchFailed(event.id, QUEUE_DISPATCH_FAILURE);
      } catch (outboxError) {
        app.log.error({ err: safeError(outboxError), webhookEventId: event.id }, 'failed to record webhook outbox failure');
      }
      app.log.warn({ err: safeError(error), webhookEventId: event.id }, 'webhook queued for outbox retry');
    }

    return reply.code(200).send({ received: true });
  });

  app.post('/v1/auth/signup', async (request, reply) => {
    if (!await enforceRateLimit(request, reply, rateLimiter, config, `auth-ip:${request.ip}`, config.RATE_LIMIT_AUTH_IP_MAX ?? 20)) return;
    const parsed = signupSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);
    try {
      const credentials = await auth.signup(parsed.data);
      setAuthCookies(reply, config, credentials.sessionToken, credentials.csrfToken);
      return reply.code(201).send({ data: credentials.user });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return reply.code(409).send({ code: 'EMAIL_TAKEN', message: 'An account already exists for this email' });
      }
      throw error;
    }
  });

  app.post('/v1/auth/login', async (request, reply) => {
    if (!await enforceRateLimit(request, reply, rateLimiter, config, `auth-ip:${request.ip}`, config.RATE_LIMIT_AUTH_IP_MAX ?? 20)) return;
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);
    const credentials = await auth.login(parsed.data.email, parsed.data.password);
    if (!credentials) {
      return reply.code(401).send({ code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect' });
    }
    setAuthCookies(reply, config, credentials.sessionToken, credentials.csrfToken);
    return reply.send({ data: credentials.user });
  });

  app.post('/v1/auth/logout', async (request, reply) => {
    if (!await enforceRateLimit(request, reply, rateLimiter, config, `auth-ip:${request.ip}`, config.RATE_LIMIT_AUTH_IP_MAX ?? 20)) return;
    await auth.logout(request.cookies[AUTH_COOKIE]);
    clearAuthCookies(reply, config);
    return reply.send({ data: { loggedOut: true } });
  });

  app.get('/v1/auth/me', async (request, reply) => {
    const context = await requireAuth(request, reply, auth, 'accounts:read');
    if (!context) return;
    return reply.send({ data: authUser(context) });
  });

  app.post('/v1/auth/reset/request', async (request, reply) => {
    if (!await enforceRateLimit(request, reply, rateLimiter, config, `auth-ip:${request.ip}`, config.RATE_LIMIT_AUTH_IP_MAX ?? 20)) return;
    const parsed = resetRequestSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);
    await auth.requestPasswordReset(parsed.data.email);
    return reply.code(202).send({ data: { accepted: true } });
  });

  app.post('/v1/auth/reset/confirm', async (request, reply) => {
    if (!await enforceRateLimit(request, reply, rateLimiter, config, `auth-ip:${request.ip}`, config.RATE_LIMIT_AUTH_IP_MAX ?? 20)) return;
    const parsed = resetConfirmSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);
    const reset = await auth.resetPassword(parsed.data.token, parsed.data.password);
    if (!reset) return reply.code(400).send({ code: 'INVALID_RESET_TOKEN', message: 'Reset token is invalid or expired' });
    return reply.send({ data: { reset: true } });
  });

  app.get('/v1/auth/instagram/start', async (request, reply) => {
    const context = await requireAuth(request, reply, auth, 'instagram:connect');
    if (!context) return;
    if (!await enforceAuthenticatedRateLimit(request, reply, rateLimiter, config, context)) return;
    try {
      return reply.redirect(await instagramOAuth.createAuthorizationUrl(context));
    } catch (error) {
      return sendInstagramOAuthError(reply, error);
    }
  });

  app.get('/v1/auth/instagram/callback', async (request, reply) => {
    const context = await requireAuth(request, reply, auth, 'instagram:connect');
    if (!context) return;
    if (!await enforceAuthenticatedRateLimit(request, reply, rateLimiter, config, context)) return;
    const query = instagramOAuthCallbackSchema.safeParse(request.query);
    if (!query.success) return validationError(reply, query.error);
    if (query.data.error) {
      return reply.code(400).send({
        code: 'INSTAGRAM_AUTHORIZATION_DENIED',
        message: 'Instagram authorization was not completed'
      });
    }
    if (!query.data.code || !query.data.state) {
      return reply.code(400).send({ code: 'INVALID_OAUTH_CALLBACK', message: 'Instagram callback is missing required parameters' });
    }
    try {
      const account = await instagramOAuth.completeAuthorization({
        code: query.data.code,
        state: query.data.state,
        sessionId: context.sessionId,
        workspaceId: context.workspaceId
      });
      return reply.send({ data: account });
    } catch (error) {
      return sendInstagramOAuthError(reply, error);
    }
  });

  app.get('/v1/ig-accounts', async (request, reply) => {
    const context = await requireAuth(request, reply, auth, 'accounts:read');
    if (!context) return;
    if (!await enforceAuthenticatedRateLimit(request, reply, rateLimiter, config, context)) return;
    return reply.send({ data: await database.listInstagramAccounts(context.workspaceId) });
  });

  app.get('/v1/automations', async (request, reply) => {
    const context = await requireAuth(request, reply, auth, 'automations:read');
    if (!context) return;
    if (!await enforceAuthenticatedRateLimit(request, reply, rateLimiter, config, context)) return;
    return reply.send({ data: await database.listAutomations(context.workspaceId) });
  });

  app.post('/v1/automations', async (request, reply) => {
    const context = await requireAuth(request, reply, auth, 'automations:create');
    if (!context) return;
    if (!await enforceAuthenticatedRateLimit(request, reply, rateLimiter, config, context)) return;
    if (!validateCsrf(request, reply, context)) return;
    const parsed = automationInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return validationError(reply, parsed.error);
    }
    const idempotency = await beginRouteIdempotency(request, reply, database, context);
    if (!idempotency) return;
    if (idempotency.kind === 'replay') return reply.code(idempotency.statusCode).send(idempotency.body);

    let automation: Awaited<ReturnType<Database['createAutomation']>>;
    try {
      automation = await database.createAutomation({ ...parsed.data, workspaceId: context.workspaceId });
    } catch (error) {
      await abandonRouteIdempotency(database, idempotency.id);
      throw error;
    }
    if (!automation) {
      const responseBody = { code: 'ACCOUNT_NOT_FOUND', message: 'Instagram account not found' };
      await finishRouteIdempotency(database, idempotency.id, 404, responseBody);
      return reply.code(404).send(responseBody);
    }
    const responseBody = { data: automation };
    await finishRouteIdempotency(database, idempotency.id, 201, responseBody);
    return reply.code(201).send(responseBody);
  });

  app.get('/v1/automations/:id', async (request, reply) => {
    const context = await requireAuth(request, reply, auth, 'automations:read');
    if (!context) return;
    if (!await enforceAuthenticatedRateLimit(request, reply, rateLimiter, config, context)) return;
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ code: 'INVALID_ID', message: 'Invalid automation id' });
    const automation = await database.getAutomation(params.data.id, context.workspaceId);
    if (!automation) return reply.code(404).send({ code: 'NOT_FOUND', message: 'Automation not found' });
    return reply.send({ data: automation });
  });

  app.get('/v1/automations/:id/events', async (request, reply) => {
    const context = await requireAuth(request, reply, auth, 'events:read');
    if (!context) return;
    if (!await enforceAuthenticatedRateLimit(request, reply, rateLimiter, config, context)) return;
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ code: 'INVALID_ID', message: 'Invalid automation id' });
    const automation = await database.getAutomation(params.data.id, context.workspaceId);
    if (!automation) return reply.code(404).send({ code: 'NOT_FOUND', message: 'Automation not found' });
    return reply.send({ data: await database.listTriggerEvents(params.data.id, context.workspaceId) });
  });

  for (const action of ['publish', 'pause', 'resume'] as const) {
    app.post(`/v1/automations/:id/${action}`, async (request, reply) => {
      const context = await requireAuth(request, reply, auth, `automations:${action}`);
      if (!context) return;
      if (!await enforceAuthenticatedRateLimit(request, reply, rateLimiter, config, context)) return;
      if (!validateCsrf(request, reply, context)) return;
      const params = idParamsSchema.safeParse(request.params);
      if (!params.success) return reply.code(400).send({ code: 'INVALID_ID', message: 'Invalid automation id' });
      const idempotency = await beginRouteIdempotency(request, reply, database, context);
      if (!idempotency) return;
      if (idempotency.kind === 'replay') return reply.code(idempotency.statusCode).send(idempotency.body);
      const status = action === 'publish' || action === 'resume' ? 'live' : 'paused';
      let automation: Awaited<ReturnType<Database['updateAutomationStatus']>>;
      try {
        automation = await database.updateAutomationStatus(params.data.id, context.workspaceId, status);
      } catch (error) {
        await abandonRouteIdempotency(database, idempotency.id);
        throw error;
      }
      if (!automation) {
        const responseBody = { code: 'NOT_FOUND', message: 'Automation not found' };
        await finishRouteIdempotency(database, idempotency.id, 404, responseBody);
        return reply.code(404).send(responseBody);
      }
      const responseBody = { data: automation };
      await finishRouteIdempotency(database, idempotency.id, 200, responseBody);
      return reply.send(responseBody);
    });
  }
}

function getRawBody(request: FastifyRequest): Buffer {
  const rawBody = (request as FastifyRequest & { rawBody?: Buffer }).rawBody;
  if (!rawBody) throw new Error('Raw request body was not configured');
  return rawBody;
}

async function enforceAuthenticatedRateLimit(
  request: FastifyRequest,
  reply: { header: (name: string, value: string | number) => unknown; code: (status: number) => { send: (body: unknown) => unknown } },
  limiter: RateLimiter,
  config: Config,
  context: AuthContext
): Promise<boolean> {
  const user = await consumeRateLimit(limiter, config, `user:${context.userId}`, config.RATE_LIMIT_USER_MAX ?? 120);
  const workspace = await consumeRateLimit(limiter, config, `workspace:${context.workspaceId}`, config.RATE_LIMIT_WORKSPACE_MAX ?? 300);
  const result = !user.allowed ? user : !workspace.allowed ? workspace : user;
  return sendRateLimitResult(reply, result);
}

async function enforceRateLimit(
  request: FastifyRequest,
  reply: { header: (name: string, value: string | number) => unknown; code: (status: number) => { send: (body: unknown) => unknown } },
  limiter: RateLimiter,
  config: Config,
  key: string,
  limit: number
): Promise<boolean> {
  return sendRateLimitResult(reply, await consumeRateLimit(limiter, config, key, limit));
}

async function consumeRateLimit(limiter: RateLimiter, config: Config, key: string, limit: number) {
  if (config.RATE_LIMIT_ENABLED === false) {
    return { allowed: true, limit, remaining: limit, retryAfterSeconds: 0 };
  }
  try {
    return await limiter.consume(`ratelimit:${key}`, limit, config.RATE_LIMIT_WINDOW_SECONDS ?? 60);
  } catch {
    // Rate limiting is fail-open so Redis outages cannot turn durable webhook
    // persistence or normal application traffic into data loss.
    return { allowed: true, limit, remaining: limit, retryAfterSeconds: 0 };
  }
}

function sendRateLimitResult(
  reply: { header: (name: string, value: string | number) => unknown; code: (status: number) => { send: (body: unknown) => unknown } },
  result: { allowed: boolean; limit: number; remaining: number; retryAfterSeconds: number }
): boolean {
  reply.header('RateLimit-Limit', result.limit);
  reply.header('RateLimit-Remaining', result.remaining);
  if (!result.allowed) {
    reply.header('Retry-After', result.retryAfterSeconds);
    reply.code(429).send({ code: 'RATE_LIMITED', message: 'Too many requests' });
    return false;
  }
  return true;
}

type RouteIdempotency =
  | { kind: 'new'; id: string }
  | { kind: 'replay'; statusCode: number; body: unknown };

async function beginRouteIdempotency(
  request: FastifyRequest,
  reply: { code: (status: number) => { send: (body: unknown) => unknown } },
  database: Database,
  context: AuthContext
): Promise<RouteIdempotency | undefined> {
  const header = request.headers['idempotency-key'];
  const key = Array.isArray(header) ? header[0] : header;
  if (key === undefined) return { kind: 'new', id: '' };
  if (!isValidIdempotencyKey(key)) {
    reply.code(400).send({ code: 'INVALID_IDEMPOTENCY_KEY', message: 'Idempotency-Key is invalid' });
    return undefined;
  }
  const fingerprint = fingerprintJson({
    method: request.method,
    route: request.routeOptions.url,
    params: request.params,
    body: request.body
  });
  const result = await database.beginIdempotency({
    workspaceId: context.workspaceId,
    userId: context.userId,
    key,
    fingerprint
  });
  if (result.kind === 'replay') return result;
  if (result.kind === 'conflict') {
    reply.code(409).send({ code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency-Key was already used for a different or incomplete request' });
    return undefined;
  }
  return result;
}

async function finishRouteIdempotency(database: Database, id: string, statusCode: number, body: unknown): Promise<void> {
  if (id) await database.completeIdempotency(id, statusCode, body);
}

async function abandonRouteIdempotency(database: Database, id: string): Promise<void> {
  if (!id) return;
  try { await database.abandonIdempotency(id); } catch { /* preserve the original handler failure */ }
}

async function requireAuth(request: FastifyRequest, reply: { code: (status: number) => { send: (body: unknown) => unknown } }, auth: AuthService, permission: Permission): Promise<AuthContext | undefined> {
  const context = await auth.authenticate(request.cookies[AUTH_COOKIE]);
  if (!context) {
    reply.code(401).send({ code: 'UNAUTHENTICATED', message: 'Authentication is required' });
    return undefined;
  }
  if (!hasPermission(context.role, permission)) {
    reply.code(403).send({ code: 'FORBIDDEN', message: 'You do not have permission to perform this action' });
    return undefined;
  }
  return context;
}

function validateCsrf(request: FastifyRequest, reply: { code: (status: number) => { send: (body: unknown) => unknown } }, context: AuthContext): boolean {
  const header = request.headers['x-csrf-token'];
  const token = Array.isArray(header) ? header[0] : header;
  if (!token || request.cookies[CSRF_COOKIE] !== token || hashToken(token) !== context.csrfTokenHash) {
    reply.code(403).send({ code: 'CSRF_INVALID', message: 'CSRF token is missing or invalid' });
    return false;
  }
  return true;
}

function setAuthCookies(reply: { setCookie: (...args: any[]) => unknown }, config: Config, sessionToken: string, csrfToken: string): void {
  const cookieOptions = {
    path: '/',
    sameSite: 'lax' as const,
    secure: config.NODE_ENV === 'production' || config.NODE_ENV === 'staging',
    maxAge: SESSION_MAX_AGE_SECONDS
  };
  reply.setCookie(AUTH_COOKIE, sessionToken, { ...cookieOptions, httpOnly: true });
  reply.setCookie(CSRF_COOKIE, csrfToken, { ...cookieOptions, httpOnly: false });
}

function clearAuthCookies(reply: { clearCookie: (...args: any[]) => unknown }, config: Config): void {
  const options = { path: '/', sameSite: 'lax' as const, secure: config.NODE_ENV === 'production' || config.NODE_ENV === 'staging' };
  reply.clearCookie(AUTH_COOKIE, options);
  reply.clearCookie(CSRF_COOKIE, options);
}

function authUser(context: AuthContext) {
  return { id: context.userId, email: context.email, workspaceId: context.workspaceId, role: context.role };
}

function validationError(reply: { code: (status: number) => { send: (body: unknown) => unknown } }, error: z.ZodError) {
  return reply.code(400).send({
    code: 'VALIDATION_ERROR',
    message: 'The request payload is invalid',
    fields: error.flatten().fieldErrors
  });
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

function sendInstagramOAuthError(reply: { code: (status: number) => { send: (body: unknown) => unknown } }, error: unknown) {
  if (error instanceof InstagramOAuthError) {
    const status = error.code === 'META_CONFIG_MISSING' ? 503 : 400;
    const messages = {
      META_CONFIG_MISSING: 'Meta OAuth credentials are not configured',
      INVALID_OAUTH_STATE: 'The Instagram authorization state is invalid or expired',
      META_TOKEN_EXCHANGE_FAILED: 'Instagram authorization could not be completed',
      META_PROFILE_FAILED: 'Instagram profile could not be loaded',
      INSTAGRAM_ACCOUNT_TYPE_REQUIRED: 'A professional Instagram account is required',
      INSTAGRAM_ACCOUNT_ALREADY_CONNECTED: 'This Instagram account is already connected to another workspace'
    } as const;
    if (!Object.hasOwn(messages, error.code)) throw error;
    return reply.code(status).send({ code: error.code, message: messages[error.code] });
  }
  throw error;
}
