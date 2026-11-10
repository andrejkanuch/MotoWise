import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONFIRMED_PRO_TTL_MS,
  clearTierCache,
  confirmPro,
  resolveTier,
  TIER_CACHE_TTL_MS,
} from './resolve-tier';

const FUTURE = '2999-01-01T00:00:00.000Z';
const PAST = '2000-01-01T00:00:00.000Z';

type UserRow = {
  subscription_tier: string;
  subscription_status: string;
  subscription_expires_at: string | null;
};

/** A service-role client whose users lookup answers `single()` with the given result. */
function adminReturning(result: { data: UserRow | null; error: { message: string } | null }) {
  const single = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { client: { from } as never, from, select, eq, single };
}

const adminWithRow = (row: UserRow) => adminReturning({ data: row, error: null });

describe('resolveTier', () => {
  beforeEach(() => {
    clearTierCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads the tier columns of the given user from users', async () => {
    const admin = adminWithRow({
      subscription_tier: 'pro',
      subscription_status: 'active',
      subscription_expires_at: FUTURE,
    });
    await resolveTier(admin.client, 'user-read');
    expect(admin.from).toHaveBeenCalledWith('users');
    expect(admin.select).toHaveBeenCalledWith(
      'subscription_tier, subscription_status, subscription_expires_at',
    );
    expect(admin.eq).toHaveBeenCalledWith('id', 'user-read');
  });

  it("resolves a lapsed subscriber (tier 'pro', past expiry) to free", async () => {
    const admin = adminWithRow({
      subscription_tier: 'pro',
      subscription_status: 'active',
      subscription_expires_at: PAST,
    });
    expect(await resolveTier(admin.client, 'user-lapsed')).toBe('free');
  });

  it('resolves a trialing user with a null expiry to pro', async () => {
    const admin = adminWithRow({
      subscription_tier: 'pro',
      subscription_status: 'trialing',
      subscription_expires_at: null,
    });
    expect(await resolveTier(admin.client, 'user-trial')).toBe('pro');
  });

  it('resolves a cancelled row paid through a future expiry to pro', async () => {
    const admin = adminWithRow({
      subscription_tier: 'pro',
      subscription_status: 'cancelled',
      subscription_expires_at: FUTURE,
    });
    expect(await resolveTier(admin.client, 'user-cancelled')).toBe('pro');
  });

  it('resolves a cancelled row with a null expiry to free', async () => {
    const admin = adminWithRow({
      subscription_tier: 'pro',
      subscription_status: 'cancelled',
      subscription_expires_at: null,
    });
    expect(await resolveTier(admin.client, 'user-cancelled-null')).toBe('free');
  });

  it('resolves an expired status to free even with a future expiry', async () => {
    const admin = adminWithRow({
      subscription_tier: 'pro',
      subscription_status: 'expired',
      subscription_expires_at: FUTURE,
    });
    expect(await resolveTier(admin.client, 'user-revoked')).toBe('free');
  });

  it('resolves a database error to free', async () => {
    const admin = adminReturning({ data: null, error: { message: 'connection reset' } });
    expect(await resolveTier(admin.client, 'user-db-error')).toBe('free');
  });

  it('resolves a thrown client error to free', async () => {
    const from = vi.fn(() => {
      throw new Error('socket hang up');
    });
    expect(await resolveTier({ from } as never, 'user-db-throw')).toBe('free');
  });

  it('serves a repeat lookup inside the cache window without a second query', async () => {
    const admin = adminWithRow({
      subscription_tier: 'pro',
      subscription_status: 'active',
      subscription_expires_at: FUTURE,
    });
    await resolveTier(admin.client, 'user-cached');
    await resolveTier(admin.client, 'user-cached');
    expect(admin.single).toHaveBeenCalledTimes(1);
  });

  it('queries again once the cache window has passed', async () => {
    vi.useFakeTimers();
    const admin = adminWithRow({
      subscription_tier: 'free',
      subscription_status: 'free',
      subscription_expires_at: null,
    });
    await resolveTier(admin.client, 'user-stale');
    vi.advanceTimersByTime(TIER_CACHE_TTL_MS + 1);
    await resolveTier(admin.client, 'user-stale');
    expect(admin.single).toHaveBeenCalledTimes(2);
  });

  describe('confirmPro', () => {
    const freeRow: UserRow = {
      subscription_tier: 'free',
      subscription_status: 'free',
      subscription_expires_at: null,
    };

    it('makes a user whose row still says free resolve to pro', async () => {
      const admin = adminWithRow(freeRow);
      confirmPro('user-just-bought');
      expect(await resolveTier(admin.client, 'user-just-bought')).toBe('pro');
      expect(admin.single).not.toHaveBeenCalled();
    });

    it('overrides an earlier free answer still inside the cache window', async () => {
      const admin = adminWithRow(freeRow);
      expect(await resolveTier(admin.client, 'user-upgraded')).toBe('free');
      confirmPro('user-upgraded');
      expect(await resolveTier(admin.client, 'user-upgraded')).toBe('pro');
    });

    it('holds for ten minutes by default, then the row decides again', async () => {
      vi.useFakeTimers();
      const admin = adminWithRow(freeRow);
      confirmPro('user-window');
      vi.advanceTimersByTime(10 * 60_000 - 1);
      expect(await resolveTier(admin.client, 'user-window')).toBe('pro');
      vi.advanceTimersByTime(2);
      expect(await resolveTier(admin.client, 'user-window')).toBe('free');
      expect(CONFIRMED_PRO_TTL_MS).toBe(10 * 60_000);
    });

    it('honours an explicit ttl', async () => {
      vi.useFakeTimers();
      const admin = adminWithRow(freeRow);
      confirmPro('user-short', 5_000);
      vi.advanceTimersByTime(5_001);
      expect(await resolveTier(admin.client, 'user-short')).toBe('free');
    });

    it('does not affect other users', async () => {
      const admin = adminWithRow(freeRow);
      confirmPro('user-a');
      expect(await resolveTier(admin.client, 'user-b')).toBe('free');
    });
  });
});
