// MOT-140 / P2-109: Shared unit conversion helpers.
//
// Canonical storage contract (see docs/plans/odometer-unit-normalization.md):
// every persisted odometer/mileage integer is stored in KILOMETRES —
// `motorcycles.current_mileage`, `maintenance_tasks.target_mileage`,
// `completed_mileage`, and `interval_km`. Ride distances come from GPS in
// meters (`rides.distance_m`); fuel odometer is stored km (`fuel_logs.odometer_km`).
// The display unit is derived from the user's global `measurement_system`
// ('metric' | 'imperial'); the per-bike `motorcycles.mileage_unit` is
// deprecated and MUST NOT be used to decide a value's unit. Convert user input
// → km on write and km → display unit on read, at the edges only.
//
// Keep all magic numbers in exactly one place so the MOT-140 meters-to-km bug
// can't recur on the next sync path.
//
// The `MileageUnit`/`MeasurementSystem` types live in `./constants/enums` — we
// import them here so there's a single canonical definition across the monorepo.

import type { MeasurementSystem, MileageUnit } from './constants/enums';

export const METERS_PER_KM = 1000;
export const METERS_PER_MILE = 1609.344;
export const KM_PER_MILE = 1.609344;
export const LITRES_PER_US_GALLON = 3.785411784;

/** Convert a meters value into the motorcycle's preferred unit (km or mi). */
export function metersToUnit(meters: number, unit: MileageUnit): number {
  return unit === 'km' ? meters / METERS_PER_KM : meters / METERS_PER_MILE;
}

/** Inverse of metersToUnit. */
export function unitToMeters(value: number, unit: MileageUnit): number {
  return unit === 'km' ? value * METERS_PER_KM : value * METERS_PER_MILE;
}

/** Convert meters to kilometres (canonical odometer/ride-sync unit). */
export function metersToKm(meters: number): number {
  return meters / METERS_PER_KM;
}

// --- Odometer/mileage: canonical km <-> user display unit --------------------
// These pair with the "store km, convert at the edges" contract above and are
// keyed off the user's GLOBAL measurement system (never the per-bike unit).

/** Canonical km → the value shown to the user in their measurement system. */
export function mileageToDisplayUnit(km: number, system: MeasurementSystem): number {
  return system === 'imperial' ? kmToMiles(km) : km;
}

/** A value the user typed in their measurement system → canonical km for storage. */
export function mileageFromDisplayUnit(value: number, system: MeasurementSystem): number {
  return system === 'imperial' ? milesToKm(value) : value;
}

/** Short unit label ('mi' | 'km') for a measurement system. */
export function mileageUnitLabel(system: MeasurementSystem): MileageUnit {
  return system === 'imperial' ? 'mi' : 'km';
}

/** Convert kilometres to statute miles. */
export function kmToMiles(km: number): number {
  return km / KM_PER_MILE;
}

/** Convert statute miles to kilometres. */
export function milesToKm(miles: number): number {
  return miles * KM_PER_MILE;
}

/** Convert litres to US gallons. */
export function litresToUsGallons(litres: number): number {
  return litres / LITRES_PER_US_GALLON;
}

/** Convert US gallons to litres. */
export function usGallonsToLitres(gallons: number): number {
  return gallons * LITRES_PER_US_GALLON;
}
