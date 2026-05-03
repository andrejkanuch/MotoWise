import { describe, expect, it } from 'vitest';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { EntitlementsService } from './entitlements.service';
import { FEATURES, GATING_MATRIX } from './entitlements.types';

describe('EntitlementsService', () => {
  // `can()` is a pure method — only needs `this` for the class shape.
  // Supabase is only used by getGPXQuotaStatus (tested via integration/e2e).
  const service = new EntitlementsService(null as never);

  const anonymousUser = null;
  const freeUser: AuthUser = {
    id: 'user-free',
    email: 'free@motovault.app',
    role: 'user',
    tier: 'free',
  };
  const proUser: AuthUser = {
    id: 'user-pro',
    email: 'pro@motovault.app',
    role: 'user',
    tier: 'pro',
  };
  const userWithoutTier: AuthUser = {
    id: 'user-legacy',
    email: 'legacy@motovault.app',
    role: 'user',
    tier: 'free', // defaults to free
  };

  // ==========================================
  // can — anonymous (null user)
  // ==========================================

  describe('can (anonymous)', () => {
    it('denies all features for null user', () => {
      for (const feature of Object.values(FEATURES)) {
        expect(service.can(anonymousUser, feature)).toBe(false);
      }
    });
  });

  // ==========================================
  // can — free tier
  // ==========================================

  describe('can (free tier)', () => {
    it('grants free-tier features', () => {
      expect(service.can(freeUser, FEATURES.READ_ALL_REVIEWS)).toBe(true);
      expect(service.can(freeUser, FEATURES.WRITE_REVIEW)).toBe(true);
      expect(service.can(freeUser, FEATURES.SAVE_ROUTE)).toBe(true);
      expect(service.can(freeUser, FEATURES.DOWNLOAD_GPX)).toBe(true); // metered, not blocked
    });

    it('denies Pro-only features', () => {
      expect(service.can(freeUser, FEATURES.BUILDER_ACCESS)).toBe(false);
      expect(service.can(freeUser, FEATURES.EXPORT_DEVICE)).toBe(false);
      expect(service.can(freeUser, FEATURES.USE_OFFLINE_MAPS)).toBe(false);
      expect(service.can(freeUser, FEATURES.SEE_FUEL_OVERLAY)).toBe(false);
      expect(service.can(freeUser, FEATURES.AD_FREE)).toBe(false);
    });
  });

  // ==========================================
  // can — Pro tier
  // ==========================================

  describe('can (Pro tier)', () => {
    it('grants all features for Pro user', () => {
      for (const feature of Object.values(FEATURES)) {
        expect(service.can(proUser, feature)).toBe(true);
      }
    });
  });

  // ==========================================
  // can — user without explicit tier defaults to free
  // ==========================================

  describe('can (legacy user without tier)', () => {
    it('defaults to free tier behavior', () => {
      expect(service.can(userWithoutTier, FEATURES.SAVE_ROUTE)).toBe(true);
      expect(service.can(userWithoutTier, FEATURES.BUILDER_ACCESS)).toBe(false);
    });
  });

  // ==========================================
  // Full gating matrix — exhaustive
  // ==========================================

  describe('full gating matrix matches GATING_MATRIX constant', () => {
    const tiers = [
      { label: 'anonymous', user: anonymousUser, tierKey: 'anonymous' as const },
      { label: 'free', user: freeUser, tierKey: 'free' as const },
      { label: 'pro', user: proUser, tierKey: 'pro' as const },
    ];

    for (const { label, user, tierKey } of tiers) {
      for (const feature of Object.values(FEATURES)) {
        const expected = GATING_MATRIX[tierKey][feature];
        it(`${label} + ${feature} = ${expected}`, () => {
          expect(service.can(user, feature)).toBe(expected);
        });
      }
    }
  });
});
