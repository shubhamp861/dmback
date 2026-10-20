import { Redis } from 'ioredis';
import type { Config } from './config.js';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
  close(): Promise<void>;
}

const consumeScript = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('TTL', KEYS[1])
return { count, ttl }
`;

export class RedisRateLimiter implements RateLimiter {
  private readonly connection: Redis;

  constructor(config: Config) {
    this.connection = new Redis(config.REDIS_URL, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      commandTimeout: 2000
    });
  }

  async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
    const result = await this.connection.eval(consumeScript, 1, `${key}:${bucket}`, windowSeconds) as [number | string, number | string];
    const count = Number(result[0]);
    const ttl = Math.max(1, Number(result[1]));
    return {
      allowed: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: ttl
    };
  }

  async close(): Promise<void> {
    this.connection.disconnect();
  }
}

export class NoopRateLimiter implements RateLimiter {
  async consume(_key: string, limit: number): Promise<RateLimitResult> {
    return { allowed: true, limit, remaining: limit, retryAfterSeconds: 0 };
  }

  async close(): Promise<void> {}
}
