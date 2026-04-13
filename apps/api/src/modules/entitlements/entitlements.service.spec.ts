import { describe, expect, it, beforeEach } from 'vitest';
import { EntitlementsService, ENTITLEMENTS } from './entitlements.service';

describe('EntitlementsService', () => {
  let service: EntitlementsService;

  beforeEach(() => {
    service = new EntitlementsService();
  });

  describe('resolvePolyline', () => {
    it('returns null for anonymous users', () => {
      const result = service.resolvePolyline('anonymous', 'encoded_polyline_data');
      expect(result).toBeNull();
    });

    it('returns the polyline for free users', () => {
      const polyline = 'encoded_polyline_data';
      const result = service.resolvePolyline('free', polyline);
      expect(result).toBe(polyline);
    });

    it('returns the polyline for premium users', () => {
      const polyline = 'encoded_polyline_data';
      const result = service.resolvePolyline('premium', polyline);
      expect(result).toBe(polyline);
    });
  });

  describe('capReviews', () => {
    const reviews = [
      { id: '1', rating: 5 },
      { id: '2', rating: 4 },
      { id: '3', rating: 3 },
      { id: '4', rating: 2 },
      { id: '5', rating: 1 },
    ];

    it('caps anonymous users to 3 reviews', () => {
      const result = service.capReviews('anonymous', reviews);
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('1');
      expect(result[2].id).toBe('3');
    });

    it('returns all reviews for free users', () => {
      const result = service.capReviews('free', reviews);
      expect(result).toHaveLength(5);
    });

    it('returns all reviews for premium users', () => {
      const result = service.capReviews('premium', reviews);
      expect(result).toHaveLength(5);
    });

    it('returns empty array for anonymous with no reviews', () => {
      const result = service.capReviews('anonymous', []);
      expect(result).toHaveLength(0);
    });
  });

  describe('can', () => {
    it('anonymous cannot READ_FULL_ROUTE', () => {
      expect(service.can('anonymous', ENTITLEMENTS.READ_FULL_ROUTE)).toBe(false);
    });

    it('free can READ_FULL_ROUTE', () => {
      expect(service.can('free', ENTITLEMENTS.READ_FULL_ROUTE)).toBe(true);
    });

    it('premium can READ_FULL_ROUTE', () => {
      expect(service.can('premium', ENTITLEMENTS.READ_FULL_ROUTE)).toBe(true);
    });

    it('free cannot EXPORT_GPX', () => {
      expect(service.can('free', ENTITLEMENTS.EXPORT_GPX)).toBe(false);
    });

    it('premium can EXPORT_GPX', () => {
      expect(service.can('premium', ENTITLEMENTS.EXPORT_GPX)).toBe(true);
    });

    it('premium can UNLIMITED_REVIEWS', () => {
      expect(service.can('premium', ENTITLEMENTS.UNLIMITED_REVIEWS)).toBe(true);
    });
  });
});
