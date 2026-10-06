import type { RevenueCatEvent } from './dto/revenuecat-event.dto';

/**
 * Store product identifiers that grant **lifetime** Pro. RevenueCat sends
 * NON_RENEWING_PURCHASE for every non-subscription product — lifetime SKUs, but
 * also consumables and any future time-limited pass — so the event type alone
 * must never mean "Pro forever". Source: RevenueCat product catalog
 * (project proj46e69448), all `non_consumable` / Play `one_time`:
 *  - `motovault_lifetime_v3`, `motovault_lifetime_v4` — App Store and Play
 *    Store share the same store identifier.
 *  - `lifetime` — RevenueCat Test Store (sandbox purchases only).
 * Add a new lifetime SKU here BEFORE it goes on sale, or its buyers get no Pro.
 */
export const LIFETIME_PRODUCT_IDS = [
  'motovault_lifetime_v3',
  'motovault_lifetime_v4',
  'lifetime',
] as const;

export type LifetimeProductId = (typeof LIFETIME_PRODUCT_IDS)[number];

const LIFETIME_PRODUCT_ID_SET: ReadonlySet<string> = new Set(LIFETIME_PRODUCT_IDS);

export const isLifetimeProductId = (productId: string | null | undefined): boolean =>
  productId != null && LIFETIME_PRODUCT_ID_SET.has(productId);

export const NON_RENEWING_GRANT = {
  LIFETIME: 'lifetime',
  TIME_LIMITED: 'time_limited',
  NONE: 'none',
} as const;

export type NonRenewingGrant = (typeof NON_RENEWING_GRANT)[keyof typeof NON_RENEWING_GRANT];

/**
 * What a NON_RENEWING_PURCHASE grants:
 *  - a known lifetime SKU → lifetime (expiry forced to NULL, whatever RC sent),
 *  - any other product that carries `expiration_at_ms` (an entitlement with a
 *    duration, e.g. a season pass) → Pro until that expiry,
 *  - any other product without an expiry (consumable, unknown SKU) → nothing.
 */
export function nonRenewingGrant(event: RevenueCatEvent): NonRenewingGrant {
  if (isLifetimeProductId(event.product_id)) return NON_RENEWING_GRANT.LIFETIME;
  if (event.expiration_at_ms) return NON_RENEWING_GRANT.TIME_LIMITED;
  return NON_RENEWING_GRANT.NONE;
}
