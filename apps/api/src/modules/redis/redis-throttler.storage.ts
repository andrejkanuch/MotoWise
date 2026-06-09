import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler/dist/throttler-storage.interface';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import type { Redis } from '@upstash/redis';
import { REDIS } from './redis.constants';

/**
 * Redis-backed throttler storage using Upstash REST API.
 * Falls back to in-memory Map when Redis is unavailable.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleInit {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private fallbackMap = new Map<
    string,
    { record: ThrottlerStorageRecord; expiresAt: number; blockedUntil?: number }
  >();
  private useRedis = false;

  constructor(@Inject(REDIS) private readonly redis: Redis | null) {}

  onModuleInit() {
    this.useRedis = this.redis !== null;
    if (this.useRedis) {
      this.logger.log('Throttler storage: Redis (Upstash)');
    } else {
      this.logger.warn('Throttler storage: in-memory fallback (Redis not configured)');
    }
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    if (!this.useRedis || !this.redis) {
      return this.incrementInMemory(key, ttl, limit, blockDuration, throttlerName);
    }

    const redisKey = `throttle:${throttlerName}:${key}`;

    try {
      // multi() = atomic /multi-exec. A plain pipeline() is NOT atomic on Upstash:
      // a crash between INCR and EXPIRE would leave an immortal counter that blocks
      // the key forever. PEXPIRE ... NX sets the TTL only on first hit, so no
      // read-then-branch is needed.
      const [totalHits, , pttlMs] = (await this.redis
        .multi()
        .incr(redisKey)
        .pexpire(redisKey, ttl, 'NX')
        .pttl(redisKey)
        .exec()) as [number, 0 | 1, number];

      // ThrottlerStorageRecord time fields are SECONDS (inputs arrive in ms)
      const timeToExpire = Math.ceil((pttlMs > 0 ? pttlMs : ttl) / 1000);

      const isBlocked = totalHits > limit;
      let timeToBlockExpire = 0;

      if (isBlocked && blockDuration > 0) {
        const blockKey = `${redisKey}:blocked`;
        await this.redis.set(blockKey, '1', { px: blockDuration, nx: true });
        const blockPttl = await this.redis.pttl(blockKey);
        timeToBlockExpire = blockPttl > 0 ? Math.ceil(blockPttl / 1000) : 0;
      }

      return { totalHits, timeToExpire, isBlocked, timeToBlockExpire };
    } catch (err) {
      // Fail open by design: throttling is best-effort; the AI global spend cap
      // (circuit breaker) is the fail-closed financial backstop.
      this.logger.warn('Redis throttler failed, falling back to in-memory', err);
      return this.incrementInMemory(key, ttl, limit, blockDuration, throttlerName);
    }
  }

  private incrementInMemory(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): ThrottlerStorageRecord {
    const mapKey = `${throttlerName}:${key}`;
    const now = Date.now();
    const existing = this.fallbackMap.get(mapKey);

    if (existing && existing.expiresAt > now) {
      existing.record.totalHits++;
      const isBlocked = existing.record.totalHits > limit;
      if (isBlocked && blockDuration > 0 && existing.blockedUntil === undefined) {
        existing.blockedUntil = now + blockDuration;
      }
      return {
        totalHits: existing.record.totalHits,
        timeToExpire: Math.ceil((existing.expiresAt - now) / 1000),
        isBlocked,
        timeToBlockExpire: existing.blockedUntil
          ? Math.max(0, Math.ceil((existing.blockedUntil - now) / 1000))
          : 0,
      };
    }

    const record: ThrottlerStorageRecord = {
      totalHits: 1,
      timeToExpire: Math.ceil(ttl / 1000),
      isBlocked: false,
      timeToBlockExpire: 0,
    };
    this.fallbackMap.set(mapKey, { record, expiresAt: now + ttl });

    setTimeout(() => this.fallbackMap.delete(mapKey), ttl).unref();

    return record;
  }
}
