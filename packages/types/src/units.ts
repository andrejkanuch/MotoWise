// MOT-140 / P2-109: Shared unit conversion helpers.
//
// Storage contract (see docs/plans/odometer-unit-normalization.md): odometer
// integers — `motorcycles.current_mileage`, `maintenance_tasks.target_mileage`,
// `completed_mileage` — are stored RAW in the user's global `measurement_system`
// unit (mi for imperial, km for metric), NOT normalized. `interval_km` is km for
// OEM-seeded tasks and raw user-unit for user-entered tasks. Ride distances come
// from GPS in meters (`rides.distance_m`). The display LABEL derives from `measurement_system`;
// the per-bike `motorcycles.mileage_unit` is deprecated and MUST NOT be read to
// decide a value's unit (it defaults 'mi' and is unreliable). Convert only at the
// arithmetic EDGES where a km value (OEM interval, ride meters) meets a raw
// odometer — never store a converted odometer.
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

// --- Odometer/mileage: km <-> user display unit ------------------------------
// Keyed off the user's GLOBAL measurement system (never the per-bike unit). Used
// at the arithmetic edges only — e.g. converting an OEM `interval_km` (km) to the
// user's unit before adding it to a raw odometer value.

/** A km value (e.g. an OEM interval) → the user's measurement-system unit. */
export function mileageToDisplayUnit(km: number, system: MeasurementSystem): number {
  return system === 'imperial' ? kmToMiles(km) : km;
}

/** A value in the user's measurement-system unit → km. */
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
