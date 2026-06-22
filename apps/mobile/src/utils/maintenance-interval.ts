/**
 * Maintenance-interval display helpers.
 *
 * OEM maintenance intervals are stored in kilometers (`intervalKm`) in the same
 * dataset that feeds the web article's spec tables. To satisfy unit parity
 * (plan U7 / audit P0-4) the mobile app must render the SAME number the article
 * renders for a given unit system — so this uses the identical imperial
 * derivation the article uses: km × 0.621371, rounded to a whole number.
 *
 * Distance is the only converted dimension; day-based intervals are unit-agnostic.
 */

import type { MeasurementSystem } from '@motovault/types';

/** Exact km→mi factor shared with the web article's interval table (audit P0-4). */
export const KM_TO_MI = 0.621371;

/**
 * Convert a kilometer interval into the user's measurement system, rounded the
 * same way the article rounds (whole number). Metric returns the km value as-is.
 */
export function convertIntervalDistance(intervalKm: number, system: MeasurementSystem): number {
  if (system === 'imperial') {
    return Math.round(intervalKm * KM_TO_MI);
  }
  return Math.round(intervalKm);
}

/** Distance unit label for a maintenance interval ('mi' imperial, 'km' metric). */
export function intervalDistanceUnit(system: MeasurementSystem): 'mi' | 'km' {
  return system === 'imperial' ? 'mi' : 'km';
}
