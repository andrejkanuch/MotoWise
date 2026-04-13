import { Injectable } from '@nestjs/common';

export const ENTITLEMENTS = {
  READ_FULL_ROUTE: 'READ_FULL_ROUTE',
  UNLIMITED_REVIEWS: 'UNLIMITED_REVIEWS',
  EXPORT_GPX: 'EXPORT_GPX',
} as const;

export type Entitlement = (typeof ENTITLEMENTS)[keyof typeof ENTITLEMENTS];

export type UserTier = 'anonymous' | 'free' | 'premium';

const TIER_ENTITLEMENTS: Record<UserTier, readonly Entitlement[]> = {
  anonymous: [],
  free: [ENTITLEMENTS.READ_FULL_ROUTE],
  premium: [
    ENTITLEMENTS.READ_FULL_ROUTE,
    ENTITLEMENTS.UNLIMITED_REVIEWS,
    ENTITLEMENTS.EXPORT_GPX,
  ],
} as const;

const ANONYMOUS_REVIEW_CAP = 3;

@Injectable()
export class EntitlementsService {
  /** Check if a user tier has a specific entitlement */
  can(tier: UserTier, entitlement: Entitlement): boolean {
    return TIER_ENTITLEMENTS[tier].includes(entitlement);
  }

  /** Gate polyline: anonymous gets null, free/premium gets the polyline */
  resolvePolyline(tier: UserTier, polyline: string): string | null {
    if (!this.can(tier, ENTITLEMENTS.READ_FULL_ROUTE)) {
      return null;
    }
    return polyline;
  }

  /** Cap reviews for anonymous users */
  capReviews<T>(tier: UserTier, reviews: T[]): T[] {
    if (tier === 'anonymous') {
      return reviews.slice(0, ANONYMOUS_REVIEW_CAP);
    }
    return reviews;
  }
}
