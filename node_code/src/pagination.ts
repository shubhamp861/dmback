import { Buffer } from 'node:buffer';
import { z } from 'zod';

export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 100;

export type CursorResource = 'instagram-accounts' | 'automations' | 'trigger-events';

export interface PageCursor {
  v: 1;
  resource: CursorResource;
  scopeId: string;
  createdAt: string;
  id: string;
}

export interface PaginationOptions {
  limit: number;
  cursor?: PageCursor;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

const cursorSchema = z.object({
  v: z.literal(1),
  resource: z.enum(['instagram-accounts', 'automations', 'trigger-events']),
  scopeId: z.string().uuid(),
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid()
}).strict();

export function encodeCursor(cursor: PageCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeCursor(value: string, resource: CursorResource, scopeId: string): PageCursor {
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    throw new PaginationError('INVALID_CURSOR', 'The cursor is invalid');
  }
  const parsed = cursorSchema.safeParse(decoded);
  if (!parsed.success || parsed.data.resource !== resource || parsed.data.scopeId !== scopeId) {
    throw new PaginationError('INVALID_CURSOR', 'The cursor is invalid for this resource or scope');
  }
  return parsed.data;
}

export function parsePaginationQuery(
  query: unknown,
  resource: CursorResource,
  scopeId: string
): PaginationOptions {
  if (typeof query !== 'object' || query === null || Array.isArray(query)) {
    throw new PaginationError('INVALID_PAGINATION', 'Pagination query parameters are invalid');
  }
  const values = query as Record<string, unknown>;
  for (const key of Object.keys(values)) {
    if (key !== 'cursor' && key !== 'limit') {
      throw new PaginationError('INVALID_PAGINATION', `Unknown pagination parameter: ${key}`);
    }
    if (Array.isArray(values[key])) {
      throw new PaginationError('INVALID_PAGINATION', `${key} must be provided once`);
    }
  }

  const rawLimit = values.limit;
  let limit = DEFAULT_PAGE_LIMIT;
  if (rawLimit !== undefined) {
    if (typeof rawLimit !== 'string' || !/^\d+$/.test(rawLimit)) {
      throw new PaginationError('INVALID_PAGINATION', `limit must be an integer between 1 and ${MAX_PAGE_LIMIT}`);
    }
    limit = Number(rawLimit);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_PAGE_LIMIT) {
      throw new PaginationError('INVALID_PAGINATION', `limit must be an integer between 1 and ${MAX_PAGE_LIMIT}`);
    }
  }

  const rawCursor = values.cursor;
  if (rawCursor === undefined) return { limit };
  if (typeof rawCursor !== 'string') {
    throw new PaginationError('INVALID_CURSOR', 'The cursor is invalid');
  }
  return { limit, cursor: decodeCursor(rawCursor, resource, scopeId) };
}

export function pageFromRows<T>(
  rows: T[],
  options: PaginationOptions,
  resource: CursorResource,
  scopeId: string,
  createdAtField = 'created_at'
): CursorPage<T> {
  const hasMore = rows.length > options.limit;
  const items = hasMore ? rows.slice(0, options.limit) : rows;
  const last = items[items.length - 1] as Record<string, unknown> | undefined;
  const createdAt = last?.[createdAtField];
  const id = last?.id;
  const nextCursor = hasMore && (createdAt instanceof Date || typeof createdAt === 'string') && typeof id === 'string'
    ? encodeCursor({ v: 1, resource, scopeId, createdAt: new Date(createdAt).toISOString(), id })
    : null;
  return { items, nextCursor, hasMore };
}

export class PaginationError extends Error {
  constructor(readonly code: 'INVALID_CURSOR' | 'INVALID_PAGINATION', message: string) {
    super(message);
    this.name = 'PaginationError';
  }
}
