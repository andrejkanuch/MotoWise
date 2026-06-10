import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RedisThrottlerStorage } from './redis-throttler.storage';

/**
 * Throttler storage (audit money guard).
 *
 * Pins the two correctness invariants the audit flagged on the Upstash-backed store:
 *  1. increment() MUST use multi() (atomic MULTI/EXEC) — a plain pipeline() is NOT
 *     atomic on Upstash, so a crash between INCR and the TTL set leaves an immortal
 *     counter that throttles the key forever.
 *  2. PEXPIRE must be set with the 'NX' option (TTL only on first hit) and the record's
 *     time fields are returned in SECONDS (Upstash PTTL is milliseconds).
 * Plus the in-memory fallback path when no redis client is injected.
 */

type MultiCalls = {
  incr: ReturnType<typeof vi.fn>;
  pexpire: ReturnType<typeof vi.fn>;
  pttl: ReturnType<typeof vi.fn>;
  exec: ReturnType<typeof vi.fn>;
};

function createRedisMock(execResult: [number, 0 | 1, number]) {
  const multiChain: MultiCalls = {
    incr: vi.fn(),
    pexpire: vi.fn(),
    pttl: vi.fn(),
    exec: vi.fn().mockResolvedValue(execResult),
  };
  // multi() returns a chainable builder; each method returns the same chain.
  multiChain.incr.mockReturnValue(multiChain);
  multiChain.pexpire.mockReturnValue(multiChain);
  multiChain.pttl.mockReturnValue(multiChain);

  const redis = {
    multi: vi.fn().mockReturnValue(multiChain),
    pipeline: vi.fn(), // present but must NOT be used
    set: vi.fn().mockResolvedValue('OK'),
    pttl: vi.fn().mockResolvedValue(5_000),
  };
  return { redis, multiChain };
}

describe('RedisThrottlerStorage', () => {
  describe('redis-backed increment', () => {
    let redis: ReturnType<typeof createRedisMock>['redis'];
    let multiChain: MultiCalls;
    let storage: RedisThrottlerStorage;

    beforeEach(() => {
      // exec → [INCR result, PEXPIRE result, PTTL ms]
      const mock = createRedisMock([1, 1, 60_000]);
      redis = mock.redis;
      multiChain = mock.multiChain;
      storage = new RedisThrottlerStorage(redis as never);
      storage.onModuleInit();
    });

    it('uses multi() (atomic) and never pipeline()', async () => {
      await storage.increment('key', 60_000, 5, 0, 'default');
      expect(redis.multi).toHaveBeenCalledTimes(1);
      expect(redis.pipeline).not.toHaveBeenCalled();
    });

    it('issues INCR, PEXPIRE ... NX, PTTL in one transaction', async () => {
      await storage.increment('key', 60_000, 5, 0, 'default');
      expect(multiChain.incr).toHaveBeenCalledWith('throttle:default:key');
      expect(multiChain.pexpire).toHaveBeenCalledWith('throttle:default:key', 60_000, 'NX');
      expect(multiChain.pttl).toHaveBeenCalledWith('throttle:default:key');
      expect(multiChain.exec).toHaveBeenCalledTimes(1);
    });

    it('returns timeToExpire in SECONDS, derived from PTTL ms', async () => {
      const record = await storage.increment('key', 60_000, 5, 0, 'default');
      // PTTL = 60_000 ms → 60 s
      expect(record.timeToExpire).toBe(60);
      expect(record.totalHits).toBe(1);
      expect(record.isBlocked).toBe(false);
    });

    it('falls back to the ttl arg (in seconds) when PTTL is unavailable (-1/-2)', async () => {
      const mock = createRedisMock([3, 0, -2]);
      const s = new RedisThrottlerStorage(mock.redis as never);
      s.onModuleInit();
      const record = await s.increment('key', 30_000, 5, 0, 'default');
      expect(record.timeToExpire).toBe(30); // 30_000 ms ttl arg → 30 s
    });

    it('marks the record blocked once hits exceed the limit, in SECONDS', async () => {
      // INCR → 6 (over limit of 5), block for 120_000 ms
      const mock = createRedisMock([6, 0, 60_000]);
      mock.redis.pttl.mockResolvedValue(120_000);
      const s = new RedisThrottlerStorage(mock.redis as never);
      s.onModuleInit();
      const record = await s.increment('key', 60_000, 5, 120_000, 'default');
      expect(record.isBlocked).toBe(true);
      expect(mock.redis.set).toHaveBeenCalledWith('throttle:default:key:blocked', '1', {
        px: 120_000,
        nx: true,
      });
      expect(record.timeToBlockExpire).toBe(120); // 120_000 ms → 120 s
    });

    it('fails OPEN to in-memory when the redis transaction throws', async () => {
      multiChain.exec.mockRejectedValueOnce(new Error('upstash down'));
      const record = await storage.increment('key', 60_000, 5, 0, 'default');
      // In-memory path: first hit returns totalHits 1, ttl in seconds.
      expect(record.totalHits).toBe(1);
      expect(record.timeToExpire).toBe(60);
      expect(record.isBlocked).toBe(false);
    });
  });

  describe('in-memory fallback (no redis client injected)', () => {
    let storage: RedisThrottlerStorage;

    beforeEach(() => {
      vi.useFakeTimers();
      storage = new RedisThrottlerStorage(null);
      storage.onModuleInit();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns a sane first-hit record with ttl in SECONDS', async () => {
      const record = await storage.increment('k', 60_000, 5, 0, 'default');
      expect(record).toEqual({
        totalHits: 1,
        timeToExpire: 60,
        isBlocked: false,
        timeToBlockExpire: 0,
      });
    });

    it('increments within the same window and blocks past the limit', async () => {
      for (let i = 0; i < 5; i++) await storage.increment('k', 60_000, 5, 30_000, 'default');
      const sixth = await storage.increment('k', 60_000, 5, 30_000, 'default');
      expect(sixth.totalHits).toBe(6);
      expect(sixth.isBlocked).toBe(true);
      expect(sixth.timeToBlockExpire).toBe(30); // 30_000 ms → 30 s
    });

    it('expires the entry after the ttl (cleanup timer is unref-scheduled, not leaked)', async () => {
      await storage.increment('k', 60_000, 5, 0, 'default');
      // Advance past the ttl: the scheduled delete runs, so the next hit is a fresh window.
      vi.advanceTimersByTime(60_001);
      const next = await storage.increment('k', 60_000, 5, 0, 'default');
      expect(next.totalHits).toBe(1);
    });
  });
});
