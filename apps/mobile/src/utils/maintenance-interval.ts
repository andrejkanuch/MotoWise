/**
 * Maintenance-interval display helpers.
 *
 * OEM maintenance intervals are stored in kilometers (`intervalKm`) in the same
 * dataset that feeds the web article's spec tables. To satisfy unit parity
 * (plan U7 / audit P0-4) the mobile app must render the SAME number the article
 * renders for a given unit system — so this uses the article's EXACT operation
 * (`generate-maintenance-article` / `unit-convert.ts`): Math.round(km / 1.609344).
 * (A `km × 0.621371` form rounds to a different whole mile at some intervals, so the
 * divide form is mirrored verbatim to keep parity exact.)
 *
 * Distance is the only converted dimension; day-based intervals are unit-agnostic.
 */

import type { MeasurementSystem } from '@motovault/types';

/** Exact km-per-mile divisor, identical to the web article's `unit-convert.ts` (audit P0-4). */
export const KM_PER_MILE = 1.609_344;

/**
 * Convert a kilometer interval into the user's measurement system, rounded the
 * same way the article rounds (whole number). Metric returns the km value as-is.
 */
export function convertIntervalDistance(intervalKm: number, system: MeasurementSystem): number {
  if (system === 'imperial') {
    return Math.round(intervalKm / KM_PER_MILE);
  }
  return Math.round(intervalKm);
}

/** Distance unit label for a maintenance interval ('mi' imperial, 'km' metric). */
export function intervalDistanceUnit(system: MeasurementSystem): 'mi' | 'km' {
  return system === 'imperial' ? 'mi' : 'km';
}

/**
 * Convert an interval the user typed (in their display unit) into the canonical
 * kilometer value stored in `interval_km`. This is the write-side inverse of
 * `convertIntervalDistance`: an imperial user types miles, so multiply by the
 * same KM_PER_MILE divisor to store km. Metric is stored verbatim.
 */
export function intervalInputToKm(value: number, system: MeasurementSystem): number {
  if (system === 'imperial') {
    return Math.round(value * KM_PER_MILE);
  }
  return Math.round(value);
}
