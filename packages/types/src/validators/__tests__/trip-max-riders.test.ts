import { describe, expect, it } from 'vitest';
import { TRIP_MAX_RIDERS } from '../../constants/limits';
import {
  CreateTripInputSchema,
  CreateTripWithWaypointsInputSchema,
  UpdateTripInputSchema,
} from '../trip';

/**
 * The bound that drifted. `trips_max_riders_check` was `BETWEEN 2 AND 50` while
 * Zod accepted 1, so every solo trip creation passed validation and then returned
 * a 500 from Postgres (MOTO-VAULT-NODE-NESTJS-K). Migration 00179 widened the
 * CHECK to `BETWEEN 1 AND 50`; this pins the other two sides to the same numbers.
 *
 * Asserting through the SCHEMAS rather than re-reading the constant is the point:
 * a schema that stops referencing `TRIP_MAX_RIDERS` fails here, which is exactly
 * the regression a shared constant is meant to prevent.
 */
describe('trip maxRiders bounds', () => {
  const base = {
    title: 'A ride out',
    startLocation: 'Barcelona',
    endLocation: 'Girona',
    startDate: '2026-10-01T09:00:00.000Z',
    difficulty: 'easy' as const,
  };

  const schemas = [
    ['CreateTripInputSchema', CreateTripInputSchema],
    ['CreateTripWithWaypointsInputSchema', CreateTripWithWaypointsInputSchema],
  ] as const;

  it.each(schemas)('%s accepts a solo trip at MIN', (_name, schema) => {
    const result = schema.safeParse({ ...base, maxRiders: TRIP_MAX_RIDERS.MIN });
    expect(result.error?.issues.some((i) => i.path.includes('maxRiders'))).toBeFalsy();
  });

  it.each(schemas)('%s rejects one below MIN', (_name, schema) => {
    const result = schema.safeParse({ ...base, maxRiders: TRIP_MAX_RIDERS.MIN - 1 });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes('maxRiders'))).toBe(true);
  });

  it.each(schemas)('%s rejects one above MAX', (_name, schema) => {
    const result = schema.safeParse({ ...base, maxRiders: TRIP_MAX_RIDERS.MAX + 1 });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes('maxRiders'))).toBe(true);
  });

  it('UpdateTripInputSchema carries the same bounds', () => {
    const update = (maxRiders: number) =>
      UpdateTripInputSchema.safeParse({
        tripId: '3f1d9a2c-7c4e-4a5b-9f0d-2b6c8e1a4d55',
        maxRiders,
      });

    expect(update(TRIP_MAX_RIDERS.MIN).success).toBe(true);
    expect(update(TRIP_MAX_RIDERS.MIN - 1).success).toBe(false);
    expect(update(TRIP_MAX_RIDERS.MAX + 1).success).toBe(false);
  });
});
