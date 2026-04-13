import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { type Feature, GATING_MATRIX, TIERS, type Tier } from './entitlements.types';

@Injectable()
export class EntitlementsService {
  /**
   * Resolve the user's subscription tier.
   * Phase 1: always 'free' for authenticated users, 'anonymous' for null.
   */
  getTier(user: AuthUser | null): Tier {
    if (!user) return TIERS.ANONYMOUS;

    // TODO: Phase 3 — check subscription status in DB / RevenueCat
    // and return TIERS.PRO when the user has an active pro subscription.
    return TIERS.FREE;
  }

  /** Check whether a user is allowed to use a specific feature. */
  can(user: AuthUser | null, feature: Feature): boolean {
    const tier = this.getTier(user);
    return GATING_MATRIX[tier][feature];
  }

  /**
   * Return quota usage for a feature, or null if no quota applies.
   * Stub — will be implemented when usage-based limits are added.
   */
  getQuota(
    _user: AuthUser | null,
    _feature: Feature,
  ): { used: number; limit: number } | null {
    return null;
  }
}
