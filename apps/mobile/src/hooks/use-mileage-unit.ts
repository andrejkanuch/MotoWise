import { distanceUnitLabel } from '../utils/ride-formatters';
import { useMeasurementSystem } from './use-measurement-system';

/**
 * Bike mileage unit ('km' | 'mi') derived from the user's global
 * measurement-system preference.
 *
 * This is the single source of truth for every mileage label in the mobile UI.
 * The per-bike `motorcycle.mileageUnit` field is deprecated: it froze the unit
 * at creation time and drifted from the user's profile preference, which caused
 * bikes to show miles while the rest of the app was metric.
 */
export function useMileageUnit(): 'km' | 'mi' {
  return distanceUnitLabel(useMeasurementSystem()) as 'km' | 'mi';
}
