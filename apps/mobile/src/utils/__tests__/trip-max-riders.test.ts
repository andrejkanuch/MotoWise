import {
  MAX_RIDERS_ISSUE,
  normalizeMaxRidersInput,
  parseMaxRiders,
  TRIP_MAX_RIDERS,
  validateMaxRidersInput,
} from '../trip-max-riders';

/**
 * Regression cover for MOTO-VAULT-NODE-NESTJS-K / MOTO-VAULT-REACT-NATIVE-3D.
 * The bound here mirrors `trips_max_riders_check` (migration 00179) and the Zod
 * schemas in `packages/types/src/validators/trip.ts`.
 */
describe('trip-max-riders', () => {
  it('pins the bound the database and Zod agree on (1..50)', () => {
    expect(TRIP_MAX_RIDERS.MIN).toBe(1);
    expect(TRIP_MAX_RIDERS.MAX).toBe(50);
  });

  describe('validateMaxRidersInput', () => {
    it('accepts a solo trip', () => {
      expect(validateMaxRidersInput('1')).toBeNull();
    });

    it('accepts the ceiling', () => {
      expect(validateMaxRidersInput('50')).toBeNull();
    });

    it('flags an empty field instead of silently defaulting', () => {
      expect(validateMaxRidersInput('')).toBe(MAX_RIDERS_ISSUE.EMPTY);
      expect(validateMaxRidersInput('   ')).toBe(MAX_RIDERS_ISSUE.EMPTY);
    });

    it('flags 0 — the value that used to become a silent 10-rider trip', () => {
      expect(validateMaxRidersInput('0')).toBe(MAX_RIDERS_ISSUE.BELOW_MIN);
    });

    it('flags above the ceiling', () => {
      expect(validateMaxRidersInput('51')).toBe(MAX_RIDERS_ISSUE.ABOVE_MAX);
      expect(validateMaxRidersInput('999')).toBe(MAX_RIDERS_ISSUE.ABOVE_MAX);
    });
  });

  describe('parseMaxRiders', () => {
    it('keeps 1 as 1 rather than falling back to the default', () => {
      expect(parseMaxRiders('1')).toBe(1);
    });

    it('clamps 0 to the minimum instead of returning 10', () => {
      expect(parseMaxRiders('0')).toBe(TRIP_MAX_RIDERS.MIN);
    });

    it('clamps above the ceiling', () => {
      expect(parseMaxRiders('999')).toBe(TRIP_MAX_RIDERS.MAX);
    });

    it('falls back to the default only when there is no number at all', () => {
      expect(parseMaxRiders('')).toBe(TRIP_MAX_RIDERS.DEFAULT);
    });
  });

  describe('normalizeMaxRidersInput', () => {
    it('writes the clamped value back so the rider sees what will be saved', () => {
      expect(normalizeMaxRidersInput('0')).toBe('1');
      expect(normalizeMaxRidersInput('999')).toBe('50');
      expect(normalizeMaxRidersInput('')).toBe('10');
      expect(normalizeMaxRidersInput('7')).toBe('7');
    });
  });
});
