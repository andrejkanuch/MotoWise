import {
  SUBSCRIPTION_STATUS_REVOKED,
  SubscriptionStatus,
  SubscriptionTier,
} from '@motovault/types';
import { Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { TIERS, type Tier } from '../../modules/entitlements/entitlements.types';

/**
 * A rider's real subscription tier, read from `public.users` with the
 * service-role client. Independent of ENTITLEMENTS_ENFORCED: callers that must
 * gate on the real tier call this, never `user.tier` (which reads Pro for
 * everyone while the flag is off).
 *
 * Plain functions over module-level state, so GqlAuthGuard can call it without
 * any module gaining a provider, and every guard instance (the APP_GUARD and
 * each module's @UseGuards copy) shares one cache.
 */

/** How long a tier read from the users row is reused. */
export const TIER_CACHE_TTL_MS = 60_000;
/** How long a Pro confirmed by RevenueCat outranks the users row (until the webhook lands). */
export const CONFIRMED_PRO_TTL_MS = 10 * 60_000;
const TIER_CACHE_MAX_SIZE = 10_000;
/** Above this share of the cap after dropping expired entries, the soonest-expiring quarter goes. */
const TIER_CACHE_PRUNE_RATIO = 0.75;
const TIER_CACHE_EVICT_RATIO = 0.25;

const USERS_TABLE = 'users' as const;
const TIER_COLUMNS = 'subscription_tier, subscription_status, subscription_expires_at' as const;

/** Statuses for which a NULL expiry means "never expires" (lifetime / comped grants). */
const OPEN_ENDED_STATUSES: readonly string[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
];

const logger = new Logger('resolveTier');
const tierCache = new Map<string, { tier: Tier; expiresAt: number }>();

interface TierRow {
  subscription_tier: string;
  subscription_status: string;
  subscription_expires_at: string | null;
}

function tierFromRow(row: TierRow): Tier {
  // Status only says whether the store has already revoked access.
  // `cancelled` (auto-renew off, paid through period end) and `past_due`
  // (inside the store's grace period) both keep the entitlement alive until
  // subscription_expires_at — which is what the RC SDK tells the client, so
  // gating on active/trialing alone made the API say free while the app
  // said Pro (docs/RevenueCat-Trial-Audit-2026-09-19.md).
  const revoked = (SUBSCRIPTION_STATUS_REVOKED as readonly string[]).includes(
    row.subscription_status,
  );

  // A null expiry means no expiration (lifetime / comped grants) — but only
  // for active/trialing rows. Treating it as valid avoids `new Date(null)`
  // coercing to 1970 and ALWAYS reading as expired, which silently
  // downgraded lifetime Pro users; a cancelled/past_due row with no expiry
  // is an anomaly and stays free.
  const notExpired =
    row.subscription_expires_at == null
      ? OPEN_ENDED_STATUSES.includes(row.subscription_status)
      : new Date(row.subscription_expires_at) > new Date();

  return row.subscription_tier === SubscriptionTier.PRO && !revoked && notExpired
    ? TIERS.PRO
    : TIERS.FREE;
}

function cacheTier(userId: string, tier: Tier, ttlMs: number): void {
  if (tierCache.size >= TIER_CACHE_MAX_SIZE) {
    const now = Date.now();
    for (const [key, val] of tierCache) {
      if (val.expiresAt <= now) tierCache.delete(key);
    }
    if (tierCache.size >= TIER_CACHE_MAX_SIZE * TIER_CACHE_PRUNE_RATIO) {
      const entries = [...tierCache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
      const evictCount = Math.ceil(entries.length * TIER_CACHE_EVICT_RATIO);
      for (const [key] of entries.slice(0, evictCount)) tierCache.delete(key);
    }
  }
  tierCache.set(userId, { tier, expiresAt: Date.now() + ttlMs });
}

/**
 * The effective tier: 'pro' only when subscription_tier is pro, the status is
 * not revoked and the expiry has not passed. Fails open to 'free' on any error
 * (a transient DB issue never grants Pro). Cached per user for
 * TIER_CACHE_TTL_MS; a confirmPro entry is served until it expires.
 */
export async function resolveTier(supabaseAdmin: SupabaseClient, userId: string): Promise<Tier> {
  const cached = tierCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.tier;

  try {
    const { data, error } = await supabaseAdmin
      .from(USERS_TABLE)
      .select(TIER_COLUMNS)
      .eq('id', userId)
      .single();

    if (error || !data) {
      logger.warn(`Tier resolution failed for ${userId}: ${error?.message ?? 'no data'}`);
      cacheTier(userId, TIERS.FREE, TIER_CACHE_TTL_MS);
      return TIERS.FREE;
    }

    const tier = tierFromRow(data as TierRow);
    cacheTier(userId, tier, TIER_CACHE_TTL_MS);
    return tier;
  } catch (err) {
    logger.error(`Tier resolution error for ${userId}`, err);
    cacheTier(userId, TIERS.FREE, TIER_CACHE_TTL_MS);
    return TIERS.FREE;
  }
}

/**
 * Records that RevenueCat confirmed an active Pro entitlement, so every
 * resolveTier call (and so every guard-resolved request) reads Pro for `ttlMs`
 * even though the users row still says free until the webhook lands.
 */
export function confirmPro(userId: string, ttlMs: number = CONFIRMED_PRO_TTL_MS): void {
  cacheTier(userId, TIERS.PRO, ttlMs);
}

/** Empties the shared tier cache (tests). */
export function clearTierCache(): void {
  tierCache.clear();
}
