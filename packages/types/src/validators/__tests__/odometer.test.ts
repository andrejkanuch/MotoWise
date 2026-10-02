import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ODOMETER_FUTURE_TOLERANCE_MS, ODOMETER_MAX } from '../../constants/limits';
import { LogOdometerReadingSchema } from '../odometer';

const MOTORCYCLE_ID = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-10-02T10:00:00.000Z');

const baseInput = { motorcycleId: MOTORCYCLE_ID, value: 39407 };

describe('LogOdometerReadingSchema', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts a value without a timestamp', () => {
    expect(LogOdometerReadingSchema.parse(baseInput)).toEqual(baseInput);
  });

  it('accepts zero and the maximum', () => {
    expect(LogOdometerReadingSchema.safeParse({ ...baseInput, value: 0 }).success).toBe(true);
    expect(LogOdometerReadingSchema.safeParse({ ...baseInput, value: ODOMETER_MAX }).success).toBe(
      true,
    );
  });

  it.each([
    ['negative', -1],
    ['fractional', 39407.5],
    ['above the maximum', ODOMETER_MAX + 1],
  ])('rejects a %s value', (_label, value) => {
    expect(LogOdometerReadingSchema.safeParse({ ...baseInput, value }).success).toBe(false);
  });

  it('accepts a back-dated timestamp', () => {
    const input = { ...baseInput, recordedAt: '2026-09-28T08:30:00.000Z' };
    expect(LogOdometerReadingSchema.parse(input).recordedAt).toBe(input.recordedAt);
  });

  it('accepts a timestamp with an offset', () => {
    const input = { ...baseInput, recordedAt: '2026-09-28T10:30:00+02:00' };
    expect(LogOdometerReadingSchema.safeParse(input).success).toBe(true);
  });

  it('accepts a timestamp inside the clock-skew tolerance', () => {
    const recordedAt = new Date(NOW.getTime() + ODOMETER_FUTURE_TOLERANCE_MS).toISOString();
    expect(LogOdometerReadingSchema.safeParse({ ...baseInput, recordedAt }).success).toBe(true);
  });

  it('rejects a timestamp beyond the clock-skew tolerance', () => {
    const recordedAt = new Date(NOW.getTime() + ODOMETER_FUTURE_TOLERANCE_MS + 1000).toISOString();
    expect(LogOdometerReadingSchema.safeParse({ ...baseInput, recordedAt }).success).toBe(false);
  });

  it('rejects a date without a time', () => {
    expect(
      LogOdometerReadingSchema.safeParse({ ...baseInput, recordedAt: '2026-09-28' }).success,
    ).toBe(false);
  });
});
