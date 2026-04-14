import { beforeEach, describe, expect, it } from 'vitest';
import { FuelStopsService } from './fuel-stops.service';

describe('FuelStopsService', () => {
  let service: FuelStopsService;

  beforeEach(() => {
    // Pass null for DI deps — unit tests don't hit DB or Redis
    service = new FuelStopsService(null as never, null);
  });

  describe('calculateEffectiveRange', () => {
    it('calculates tank * efficiency * 0.8', () => {
      // 15L tank, 25 km/L => 15 * 25 * 0.8 = 300
      const result = service.calculateEffectiveRange(15, 25);
      expect(result).toBe(300);
    });

    it('handles small tank sizes', () => {
      // 8L tank, 30 km/L => 8 * 30 * 0.8 = 192
      const result = service.calculateEffectiveRange(8, 30);
      expect(result).toBe(192);
    });

    it('handles zero tank', () => {
      const result = service.calculateEffectiveRange(0, 25);
      expect(result).toBe(0);
    });

    it('handles zero efficiency', () => {
      const result = service.calculateEffectiveRange(15, 0);
      expect(result).toBe(0);
    });

    it('handles decimal values', () => {
      // 12.5L tank, 22.4 km/L => 12.5 * 22.4 * 0.8 = 224
      const result = service.calculateEffectiveRange(12.5, 22.4);
      expect(result).toBeCloseTo(224);
    });
  });

  describe('computeFuelRangeSummary', () => {
    it('returns no refuel needed when range exceeds distance', () => {
      // Route: 100 km, range: 300 km — no stops
      const result = service.computeFuelRangeSummary(100, 300);

      expect(result.effectiveRangeKm).toBe(300);
      expect(result.stopsRequired).toBe(0);
      expect(result.summary).toBe('You can complete this route without refueling.');
    });

    it('returns 1 stop when distance is up to 2x range', () => {
      // Route: 500 km, range: 300 km — ceil(500/300)-1 = 1
      const result = service.computeFuelRangeSummary(500, 300);

      expect(result.stopsRequired).toBe(1);
      expect(result.summary).toContain('refuel 1 time');
    });

    it('returns multiple stops for long routes', () => {
      // Route: 1000 km, range: 300 km — ceil(1000/300)-1 = 3
      const result = service.computeFuelRangeSummary(1000, 300);

      expect(result.stopsRequired).toBe(3);
      expect(result.summary).toContain('refuel 3 times');
    });

    it('handles zero effective range gracefully', () => {
      const result = service.computeFuelRangeSummary(100, 0);

      expect(result.stopsRequired).toBe(0);
    });
  });
});
