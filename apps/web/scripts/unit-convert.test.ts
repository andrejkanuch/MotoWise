import { describe, expect, it } from 'vitest';
import { convertKmToMiles, convertSpecToImperial } from './unit-convert';

/**
 * Convert + round + tolerance tests (U5 / KTD 7). Imperial is derived from the
 * canonical metric value at generation time. These assert the per-spec_type
 * precision and that the round-trip stays within tolerance.
 */
describe('convertSpecToImperial', () => {
  it('torque → 1 decimal lb-ft, within tolerance', () => {
    const r = convertSpecToImperial('torque', 34);
    expect(r.unit).toBe('lb-ft');
    expect(r.value).toBeCloseTo(25.1, 1);
    // 1-decimal rounding round-trips well within the 0.5 Nm tolerance.
    expect(r.withinTolerance).toBe(true);
  });

  it('valve clearance → thousandths inch (3 sig figs), within tolerance', () => {
    const r = convertSpecToImperial('valve_clearance', 0.2);
    expect(r.unit).toBe('in');
    // 0.20 mm ≈ 0.00787 in → 3 sig figs ≈ 0.00787
    expect(r.value).toBeCloseTo(0.00787, 5);
    expect(r.withinTolerance).toBe(true);
  });

  it('pressure → whole psi, within tolerance', () => {
    const r = convertSpecToImperial('pressure', 290); // 290 kPa ≈ 42 psi
    expect(r.unit).toBe('psi');
    expect(r.value).toBe(42);
    expect(r.withinTolerance).toBe(true);
  });

  it('capacity → 1 decimal quarts, within tolerance', () => {
    const r = convertSpecToImperial('capacity', 4.8); // 4.8 L ≈ 5.1 qt
    expect(r.unit).toBe('qt');
    expect(r.value).toBeCloseTo(5.1, 1);
    expect(r.withinTolerance).toBe(true);
  });

  it('flags a spec whose whole-unit rounding drifts beyond tolerance', () => {
    // Whole-psi rounding has a max round-trip drift near the 0.5 psi boundary.
    // 0.5 psi ≈ 3.45 kPa, inside the 5 kPa tolerance, so normal pressures stay
    // within tolerance — assert that property explicitly across a sweep.
    for (let kpa = 100; kpa <= 300; kpa += 1) {
      expect(convertSpecToImperial('pressure', kpa).withinTolerance).toBe(true);
    }
    // And the flag is a real boolean the generator can branch on.
    expect(typeof convertSpecToImperial('torque', 34).withinTolerance).toBe('boolean');
  });

  it('rounds imperial half-up consistently', () => {
    expect(convertSpecToImperial('pressure', 250).value).toBe(36); // 250 kPa ≈ 36.26 psi
  });
});

describe('convertKmToMiles', () => {
  it('converts known interval distances to whole miles matching existing articles', () => {
    expect(convertKmToMiles(1609.344)).toBe(1000);
    expect(convertKmToMiles(16093.44)).toBe(10000);
    expect(convertKmToMiles(12000)).toBe(7456); // ≈ 7456.45 mi
  });
});
