import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

/** Entitlement keys — use `as const` object, not enum */
export const ENTITLEMENTS = {
  READ_ALL_REVIEWS: 'READ_ALL_REVIEWS',
  READ_FULL_ROUTE: 'READ_FULL_ROUTE',
} as const;

export type EntitlementKey = (typeof ENTITLEMENTS)[keyof typeof ENTITLEMENTS];

@Injectable()
export class EntitlementService {
  /**
   * Check whether a user (or anonymous visitor) holds a given entitlement.
   * Anonymous users (user === undefined) get the free tier.
   * Any authenticated user currently gets all entitlements (premium gating can be layered later).
   */
  can(user: AuthUser | undefined, entitlement: EntitlementKey): boolean {
    // Anonymous → no premium entitlements
    if (!user) return false;

    // Authenticated → grant all for now (RevenueCat / tier checks go here later)
    return true;
  }
}
