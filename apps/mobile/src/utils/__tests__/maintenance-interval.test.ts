import {
  convertIntervalDistance,
  intervalDistanceUnit,
  intervalInputToKm,
} from '../maintenance-interval';

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

  describe('intervalInputToKm (write: user unit -> stored km)', () => {
    it('stores metric input verbatim', () => {
      expect(intervalInputToKm(10000, 'metric')).toBe(10000);
    });

    it('converts imperial miles to km on the way in', () => {
      expect(intervalInputToKm(1000, 'imperial')).toBe(1609);
      expect(intervalInputToKm(6214, 'imperial')).toBe(10000);
    });

    it('round-trips a typed imperial interval back to the same miles (±1)', () => {
      // A rider types 6000 mi; it is stored as km, then displayed back as miles.
      const storedKm = intervalInputToKm(6000, 'imperial');
      const shownMiles = convertIntervalDistance(storedKm, 'imperial');
      expect(Math.abs(shownMiles - 6000)).toBeLessThanOrEqual(1);
    });
  });
});
