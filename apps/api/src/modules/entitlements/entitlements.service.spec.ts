import { describe, expect, it } from 'vitest';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { EntitlementService, FEATURES, type Feature } from './entitlements.service';

describe('EntitlementService', () => {
  const service = new EntitlementService();

  const mockUser: AuthUser = {
    id: 'user-123',
    email: 'rider@motovault.app',
    role: 'user',
  };

  // ==========================================
  // getTier
  // ==========================================

  describe('getTier', () => {
    it('returns "anonymous" for null user', () => {
      expect(service.getTier(null)).toBe('anonymous');
    });

    it('returns "free" for authenticated user (never "pro" in Phase 1)', () => {
      const tier = service.getTier(mockUser);
      expect(tier).toBe('free');
      expect(tier).not.toBe('pro');
    });
  });

  // ==========================================
  // can — anonymous (7 features)
  // ==========================================

  describe('can (anonymous)', () => {
    it('cannot READ_ALL_REVIEWS', () => {
      expect(service.can(null, FEATURES.READ_ALL_REVIEWS)).toBe(false);
    });

    it('cannot WRITE_REVIEW', () => {
      expect(service.can(null, FEATURES.WRITE_REVIEW)).toBe(false);
    });

    it('cannot SAVE_ROUTE', () => {
      expect(service.can(null, FEATURES.SAVE_ROUTE)).toBe(false);
    });

    it('cannot DOWNLOAD_GPX', () => {
      expect(service.can(null, FEATURES.DOWNLOAD_GPX)).toBe(false);
    });

    it('cannot USE_OFFLINE_MAPS', () => {
      expect(service.can(null, FEATURES.USE_OFFLINE_MAPS)).toBe(false);
    });

    it('cannot SEE_FUEL_OVERLAY', () => {
      expect(service.can(null, FEATURES.SEE_FUEL_OVERLAY)).toBe(false);
    });

    it('cannot AD_FREE', () => {
      expect(service.can(null, FEATURES.AD_FREE)).toBe(false);
    });
  });

  // ==========================================
  // can — free tier (7 features)
  // ==========================================

  describe('can (free tier)', () => {
    it('can READ_ALL_REVIEWS', () => {
      expect(service.can(mockUser, FEATURES.READ_ALL_REVIEWS)).toBe(true);
    });

    it('can WRITE_REVIEW', () => {
      expect(service.can(mockUser, FEATURES.WRITE_REVIEW)).toBe(true);
    });

    it('can SAVE_ROUTE', () => {
      expect(service.can(mockUser, FEATURES.SAVE_ROUTE)).toBe(true);
    });

    it('cannot DOWNLOAD_GPX', () => {
      expect(service.can(mockUser, FEATURES.DOWNLOAD_GPX)).toBe(false);
    });

    it('cannot USE_OFFLINE_MAPS', () => {
      expect(service.can(mockUser, FEATURES.USE_OFFLINE_MAPS)).toBe(false);
    });

    it('cannot SEE_FUEL_OVERLAY', () => {
      expect(service.can(mockUser, FEATURES.SEE_FUEL_OVERLAY)).toBe(false);
    });

    it('cannot AD_FREE', () => {
      expect(service.can(mockUser, FEATURES.AD_FREE)).toBe(false);
    });
  });

  // ==========================================
  // getQuota — stub returns null for all
  // ==========================================

  describe('getQuota', () => {
    const allFeatures: Feature[] = Object.values(FEATURES);

    it('returns null for all features (anonymous)', () => {
      for (const feature of allFeatures) {
        expect(service.getQuota(null, feature)).toBeNull();
      }
    });

    it('returns null for all features (free tier)', () => {
      for (const feature of allFeatures) {
        expect(service.getQuota(mockUser, feature)).toBeNull();
      }
    });
  });

  // ==========================================
  // Full gating matrix — exhaustive 7x2
  // ==========================================

  describe('full gating matrix (7 features x 2 active tiers)', () => {
    const expectedMatrix: Array<{ feature: Feature; anonymous: boolean; free: boolean }> = [
      { feature: FEATURES.READ_ALL_REVIEWS, anonymous: false, free: true },
      { feature: FEATURES.WRITE_REVIEW, anonymous: false, free: true },
      { feature: FEATURES.SAVE_ROUTE, anonymous: false, free: true },
      { feature: FEATURES.DOWNLOAD_GPX, anonymous: false, free: false },
      { feature: FEATURES.USE_OFFLINE_MAPS, anonymous: false, free: false },
      { feature: FEATURES.SEE_FUEL_OVERLAY, anonymous: false, free: false },
      { feature: FEATURES.AD_FREE, anonymous: false, free: false },
    ];

    for (const { feature, anonymous, free } of expectedMatrix) {
      it(`${feature}: anonymous=${anonymous}, free=${free}`, () => {
        expect(service.can(null, feature)).toBe(anonymous);
        expect(service.can(mockUser, feature)).toBe(free);
      });
    }
  });
});
