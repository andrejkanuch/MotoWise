import { describe, expect, it } from 'vitest';
import {
  KM_PER_MILE,
  mileageFromDisplayUnit,
  mileageToDisplayUnit,
  mileageUnitLabel,
} from '../units';

describe('odometer km <-> display-unit helpers', () => {
  describe('mileageToDisplayUnit', () => {
    it('is identity for metric (values are already km)', () => {
      expect(mileageToDisplayUnit(10000, 'metric')).toBe(10000);
      expect(mileageToDisplayUnit(0, 'metric')).toBe(0);
    });

    it('converts km → miles for imperial', () => {
      expect(mileageToDisplayUnit(16093.44, 'imperial')).toBeCloseTo(10000, 5);
    });
  });

  describe('mileageFromDisplayUnit', () => {
    it('is identity for metric', () => {
      expect(mileageFromDisplayUnit(10000, 'metric')).toBe(10000);
    });

    it('converts miles → km for imperial', () => {
      expect(mileageFromDisplayUnit(10000, 'imperial')).toBeCloseTo(16093.44, 5);
    });
  });

  it('round-trips input → km → display for imperial (odometer-grade tolerance)', () => {
    const typedMiles = 12345;
    const km = mileageFromDisplayUnit(typedMiles, 'imperial');
    // What the app shows after storing km and converting back.
    expect(Math.round(mileageToDisplayUnit(km, 'imperial'))).toBe(typedMiles);
  });

  it('mileageUnitLabel maps system → short label', () => {
    expect(mileageUnitLabel('metric')).toBe('km');
    expect(mileageUnitLabel('imperial')).toBe('mi');
  });

  it('KM_PER_MILE constant is the statute-mile factor', () => {
    expect(KM_PER_MILE).toBeCloseTo(1.609344, 6);
  });
});
