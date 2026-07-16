import { convertIntervalDistance, intervalDistanceUnit } from '../maintenance-interval';

describe('maintenance-interval', () => {
  describe('convertIntervalDistance (display: km -> user unit)', () => {
    it('passes metric through unchanged', () => {
      expect(convertIntervalDistance(10000, 'metric')).toBe(10000);
      expect(convertIntervalDistance(500, 'metric')).toBe(500);
    });

    it('converts km to whole miles for imperial (article-parity divide form)', () => {
      expect(convertIntervalDistance(10000, 'imperial')).toBe(6214);
      expect(convertIntervalDistance(1609.344, 'imperial')).toBe(1000);
    });
  });

  describe('intervalDistanceUnit', () => {
    it('labels by system', () => {
      expect(intervalDistanceUnit('metric')).toBe('km');
      expect(intervalDistanceUnit('imperial')).toBe('mi');
    });
  });
});
