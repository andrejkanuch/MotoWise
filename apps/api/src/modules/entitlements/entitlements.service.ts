import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

/** All gated features in MotoVault */
export const FEATURES = {
  READ_ALL_REVIEWS: 'READ_ALL_REVIEWS',
  WRITE_REVIEW: 'WRITE_REVIEW',
  SAVE_ROUTE: 'SAVE_ROUTE',
  DOWNLOAD_GPX: 'DOWNLOAD_GPX',
  USE_OFFLINE_MAPS: 'USE_OFFLINE_MAPS',
  SEE_FUEL_OVERLAY: 'SEE_FUEL_OVERLAY',
  AD_FREE: 'AD_FREE',
} as const;

export type Feature = (typeof FEATURES)[keyof typeof FEATURES];

export type Tier = 'anonymous' | 'free' | 'pro';

/** Phase 1 gating matrix: which tier can access which feature */
const GATING_MATRIX: Record<Feature, Set<Tier>> = {
  [FEATURES.READ_ALL_REVIEWS]: new Set(['free', 'pro']),
  [FEATURES.WRITE_REVIEW]: new Set(['free', 'pro']),
  [FEATURES.SAVE_ROUTE]: new Set(['free', 'pro']),
  [FEATURES.DOWNLOAD_GPX]: new Set(['pro']),
  [FEATURES.USE_OFFLINE_MAPS]: new Set(['pro']),
  [FEATURES.SEE_FUEL_OVERLAY]: new Set(['pro']),
  [FEATURES.AD_FREE]: new Set(['pro']),
};

@Injectable()
export class EntitlementService {
  /** Resolve user tier. Phase 1: null -> anonymous, authenticated -> free (never pro) */
  getTier(user: AuthUser | null): Tier {
    if (!user) return 'anonymous';
    // Phase 1: all authenticated users are "free" — no subscription check yet
    return 'free';
  }

  /** Check if a user can access a feature */
  can(user: AuthUser | null, feature: Feature): boolean {
    const tier = this.getTier(user);
    const allowed = GATING_MATRIX[feature];
    return allowed ? allowed.has(tier) : false;
  }

  /** Quota stub — returns null for all features in Phase 1 */
  getQuota(_user: AuthUser | null, _feature: Feature): number | null {
    return null;
  }
}
