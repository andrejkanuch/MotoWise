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
  private fallbackMap = new Map<string, { record: ThrottlerStorageRecord; expiresAt: number }>();
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
    const ttlSeconds = Math.ceil(ttl / 1000);

    try {
      const totalHits = await this.redis.incr(redisKey);

      if (totalHits === 1) {
        await this.redis.expire(redisKey, ttlSeconds);
      }

      const pttl = await this.redis.pttl(redisKey);
      const timeToExpire = pttl > 0 ? pttl : ttl;

      const isBlocked = totalHits > limit;
      let timeToBlockExpire = 0;

      if (isBlocked && blockDuration > 0) {
        const blockKey = `${redisKey}:blocked`;
        const blockSeconds = Math.ceil(blockDuration / 1000);
        await this.redis.set(blockKey, '1', { ex: blockSeconds, nx: true });
        const blockPttl = await this.redis.pttl(blockKey);
        timeToBlockExpire = blockPttl > 0 ? blockPttl : 0;
      }

      return { totalHits, timeToExpire, isBlocked, timeToBlockExpire };
    } catch (err) {
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
      return {
        totalHits: existing.record.totalHits,
        timeToExpire: existing.expiresAt - now,
        isBlocked,
        timeToBlockExpire: isBlocked ? blockDuration : 0,
      };
    }

    const record: ThrottlerStorageRecord = {
      totalHits: 1,
      timeToExpire: ttl,
      isBlocked: false,
      timeToBlockExpire: 0,
    };
    this.fallbackMap.set(mapKey, { record, expiresAt: now + ttl });

    setTimeout(() => this.fallbackMap.delete(mapKey), ttl);

    return record;
  }
}
