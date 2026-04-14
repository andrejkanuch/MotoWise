import { palette } from '@motovault/design-system';

const RANGE_SAFETY_FACTOR = 0.8;
export const DEFAULT_TANK_LITERS = 15;
export const DEFAULT_KM_PER_LITER = 18;

/**
 * Estimate how many fuel stops a route requires.
 * Uses 80% safety margin on theoretical range.
 */
export function computeFuelStops(
  routeDistanceKm: number,
  tankLiters = DEFAULT_TANK_LITERS,
  kmPerLiter = DEFAULT_KM_PER_LITER,
): number {
  const effectiveRange = tankLiters * kmPerLiter * RANGE_SAFETY_FACTOR;
  if (effectiveRange <= 0) return 0;
  return Math.max(0, Math.ceil(routeDistanceKm / effectiveRange) - 1);
}

export function fuelBadgeColor(stopsRequired: number): string {
  if (stopsRequired === 0) return palette.success500;
  if (stopsRequired === 1) return palette.warning500;
  return palette.danger500;
}

export function fuelBadgeLabel(stopsRequired: number): string {
  if (stopsRequired === 0) return 'No refuel';
  if (stopsRequired === 1) return '1 fuel stop';
  return `${stopsRequired} fuel stops`;
}
