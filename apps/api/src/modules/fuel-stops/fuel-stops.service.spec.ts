import { describe, expect, it, beforeEach } from 'vitest';
import { FuelStopsService } from './fuel-stops.service';

describe('FuelStopsService', () => {
  let service: FuelStopsService;

  beforeEach(() => {
    service = new FuelStopsService();
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
    it('returns correct text output', () => {
      const result = service.computeFuelRangeSummary(15, 25);

      expect(result.effectiveRangeKm).toBe(300);
      expect(result.text).toBe(
        'Estimated range: 300 km (15L tank, 25 km/L, 80% safety margin)',
      );
    });

    it('rounds range in text', () => {
      // 12.5L tank, 22.4 km/L => 224.0 km
      const result = service.computeFuelRangeSummary(12.5, 22.4);

      expect(result.effectiveRangeKm).toBeCloseTo(224);
      expect(result.text).toContain('224 km');
    });

    it('includes tank and efficiency in text', () => {
      const result = service.computeFuelRangeSummary(20, 18);

      expect(result.text).toContain('20L tank');
      expect(result.text).toContain('18 km/L');
      expect(result.text).toContain('80% safety margin');
    });
  });
});
