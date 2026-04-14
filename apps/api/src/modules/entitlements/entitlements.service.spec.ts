import { describe, expect, it } from 'vitest';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { ENTITLEMENTS, EntitlementsService } from './entitlements.service';

describe('EntitlementsService', () => {
  // `can()` is a pure method — only needs `this` for the class shape.
  // Supabase is only used by getGPXQuotaStatus (tested via integration/e2e).
  const service = new EntitlementsService(null as never);

  const mockUser: AuthUser = {
    id: 'user-123',
    email: 'rider@motovault.app',
    role: 'user',
  };

  // ==========================================
  // can — anonymous (null user)
  // ==========================================

  describe('can (anonymous)', () => {
    it('denies all entitlements for null user', () => {
      for (const entitlement of Object.values(ENTITLEMENTS)) {
        expect(service.can(null, entitlement)).toBe(false);
      }
    });
  });

  // ==========================================
  // can — authenticated user (Phase 1: all true)
  // ==========================================

  describe('can (authenticated — Phase 1)', () => {
    it('grants all entitlements for authenticated user', () => {
      for (const entitlement of Object.values(ENTITLEMENTS)) {
        expect(service.can(mockUser, entitlement)).toBe(true);
      }
    });
  });

  // ==========================================
  // Full gating matrix — exhaustive
  // ==========================================

  describe('full gating matrix', () => {
    const expectedMatrix: Array<{
      entitlement: (typeof ENTITLEMENTS)[keyof typeof ENTITLEMENTS];
      anonymous: boolean;
      authenticated: boolean;
    }> = [
      { entitlement: ENTITLEMENTS.READ_FULL_ROUTE, anonymous: false, authenticated: true },
      { entitlement: ENTITLEMENTS.READ_ALL_REVIEWS, anonymous: false, authenticated: true },
      { entitlement: ENTITLEMENTS.DOWNLOAD_GPX, anonymous: false, authenticated: true },
      { entitlement: ENTITLEMENTS.SAVE_ROUTE, anonymous: false, authenticated: true },
    ];

    for (const { entitlement, anonymous, authenticated } of expectedMatrix) {
      it(`${entitlement}: anonymous=${anonymous}, authenticated=${authenticated}`, () => {
        expect(service.can(null, entitlement)).toBe(anonymous);
        expect(service.can(mockUser, entitlement)).toBe(authenticated);
      });
    }
  });
});
