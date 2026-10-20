import type { FastifyInstance } from 'fastify';

// Only literal, reviewed categories may cross a logging boundary. Never stringify
// an exception: messages, stacks, causes and driver details can contain secrets.
const errorNames = new Set(['Error', 'TypeError', 'RangeError', 'SyntaxError', 'AbortError', 'TimeoutError', 'ZodError', 'InstagramOAuthError']);
const errorCodes = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE',
  '23505', '23503', '23502', '08001', '08006', '53300', '57P01',
  'FST_ERR_CTP_INVALID_JSON_BODY', 'FST_ERR_CTP_EMPTY_JSON_BODY',
  'FST_ERR_CTP_INVALID_MEDIA_TYPE', 'FST_ERR_CTP_BODY_TOO_LARGE', 'FST_ERR_VALIDATION',
  'META_CONFIG_MISSING', 'INVALID_OAUTH_STATE', 'META_TOKEN_EXCHANGE_FAILED',
  'META_PROFILE_FAILED', 'INSTAGRAM_ACCOUNT_TYPE_REQUIRED', 'INSTAGRAM_ACCOUNT_ALREADY_CONNECTED'
]);

function property(value: unknown, key: string): unknown {
  try {
    return value !== null && typeof value === 'object' ? Reflect.get(value, key) : undefined;
  } catch {
    return undefined;
  }
}

export function safeError(error: unknown): { name: string; code?: string } {
  const name = property(error, 'name');
  const code = property(error, 'code');
  return {
    name: typeof name === 'string' && errorNames.has(name) ? name : 'Error',
    ...(typeof code === 'string' && errorCodes.has(code) ? { code } : {})
  };
}

/** BullMQ persists thrown messages/stacks; never give it the original driver error. */
export function safeJobError(error: unknown): Error {
  return Object.assign(new Error('WEBHOOK_PROCESSING_FAILED'), safeError(error));
}

export function safeRequest(request: unknown) {
  // A registered route template never contains caller-controlled path segments.
  // In particular, do not fall back to raw.url for early failures or 404s.
  const method = property(request, 'method');
  const route = property(property(request, 'routeOptions'), 'url');
  return {
    method: typeof method === 'string' && ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE', 'CONNECT'].includes(method) ? method : 'OTHER',
    url: typeof route === 'string' ? route.split(/[?#]/, 1)[0] : '[unmatched]'
  };
}

export const QUEUE_DISPATCH_FAILURE = 'QUEUE_DISPATCH_FAILED';

export function registerSafeErrorHandlers(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const value = property(error, 'statusCode');
    const status = typeof value === 'number' && Number.isInteger(value) && value >= 400 && value <= 599 ? value : 500;
    request.log.error({ err: safeError(error) }, 'request failed');
    return reply.code(status).send({
      code: status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
      message: status >= 500 ? 'An internal error occurred' : 'The request could not be completed',
      requestId: request.id
    });
  });
  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ code: 'NOT_FOUND', message: 'Route not found' }));
}

export function safeLoggerOptions(level: string) {
  // Fastify's named `err` type describes its default serializer (including a
  // mandatory stack). Pino accepts a dictionary of custom serializers instead.
  const serializers: Record<string, (value: unknown) => unknown> = {
    err: safeError,
    error: safeError,
    req: safeRequest,
    res: (reply) => {
      const statusCode = property(reply, 'statusCode');
      return { statusCode: typeof statusCode === 'number' ? statusCode : undefined };
    }
  };
  return {
    level,
    serializers,
    // Defense in depth for structured records added in future. The serializers
    // and fixed log messages above are the primary boundary, not key redaction.
    redact: {
      paths: [
        'headers', 'body', 'payload', 'rawBody', 'query', 'cookies',
        'req.headers', 'req.body', 'req.payload', 'req.rawBody', 'req.query', 'req.cookies',
        'res.headers', 'res.body', 'res.cookies',
        'authorization', 'cookie', 'password', 'token', 'session', 'csrf_token',
        'access_token', 'reset_token', 'sessionToken', 'csrfToken', 'accessToken', 'resetToken',
        '*.authorization', '*.cookie', '*.password', '*.token', '*.session', '*.csrf_token',
        '*.access_token', '*.reset_token', '*.sessionToken', '*.csrfToken', '*.accessToken', '*.resetToken'
      ],
      remove: true
    }
  };
}
