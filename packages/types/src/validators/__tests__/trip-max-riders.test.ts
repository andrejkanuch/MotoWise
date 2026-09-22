import { addDays, format } from 'date-fns';
import { describe, expect, it } from 'vitest';
import { TRIP_MAX_RIDERS } from '../../constants/limits';
import {
  CreateTripInputSchema,
  CreateTripWithWaypointsInputSchema,
  UpdateTripInputSchema,
} from '../trip';

/**
 * The bound that drifted. `trips_max_riders_check` was `BETWEEN 2 AND 50` while
 * Zod accepted 1, so every solo trip creation passed validation and was then
 * refused by Postgres with a 500 (MOTO-VAULT-NODE-NESTJS-K). Migration 00179
 * widened the CHECK to `BETWEEN 1 AND 50`; this pins the other two sides to the
 * same numbers.
 *
 * Asserting through the SCHEMAS rather than re-reading the constant is the point:
 * a schema that stops referencing `TRIP_MAX_RIDERS` fails here, which is exactly
 * the regression a shared constant exists to prevent.
 *
 * The fixtures are fully valid, and the MIN case asserts `success` rather than
 * merely "no maxRiders issue". A fixture that fails for an unrelated reason would
 * satisfy the weaker assertion while proving nothing about the bound.
 */
describe('trip maxRiders bounds', () => {
  // Inside the schemas' allowed start-date window, which is enforced for
  // CreateTripInputSchema and for a non-showcase CreateTripWithWaypointsInput.
  const startDate = format(addDays(new Date(), 14), 'yyyy-MM-dd');
  const endDate = format(addDays(new Date(), 16), 'yyyy-MM-dd');

  const base = {
    title: 'Coastal loop',
    description: 'Two days along the coast, easy pace, one long lunch stop.',
    startDate,
    endDate,
    difficulty: 'easy' as const,
  };

  const schemas = [
    ['CreateTripInputSchema', CreateTripInputSchema, base],
    [
      'CreateTripWithWaypointsInputSchema',
      CreateTripWithWaypointsInputSchema,
      { ...base, waypoints: [] },
    ],
  ] as const;

  it.each(schemas)('%s accepts a solo trip at MIN', (_name, schema, fixture) => {
    const result = schema.safeParse({ ...fixture, maxRiders: TRIP_MAX_RIDERS.MIN });
    expect(result.error?.issues).toBeUndefined();
    expect(result.success).toBe(true);
  });

  it.each(schemas)('%s accepts MAX', (_name, schema, fixture) => {
    expect(schema.safeParse({ ...fixture, maxRiders: TRIP_MAX_RIDERS.MAX }).success).toBe(true);
  });

  it.each(schemas)('%s rejects one below MIN', (_name, schema, fixture) => {
    const result = schema.safeParse({ ...fixture, maxRiders: TRIP_MAX_RIDERS.MIN - 1 });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes('maxRiders'))).toBe(true);
  });

  it.each(schemas)('%s rejects one above MAX', (_name, schema, fixture) => {
    const result = schema.safeParse({ ...fixture, maxRiders: TRIP_MAX_RIDERS.MAX + 1 });
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
    expect(update(TRIP_MAX_RIDERS.MAX).success).toBe(true);
    expect(update(TRIP_MAX_RIDERS.MIN - 1).success).toBe(false);
    expect(update(TRIP_MAX_RIDERS.MAX + 1).success).toBe(false);
  });
});
