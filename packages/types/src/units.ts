// MOT-140 / P2-109: Shared unit conversion helpers.
//
// The motorcycles.mileage_unit column stores 'km' or 'mi'. Distances from
// GPS rides come in meters. Fuel volume in the DB is litres; imperial users
// see gallons. Keep all magic numbers in exactly one place so the MOT-140
// meters-to-km bug can't recur on the next sync path.
//
// The `MileageUnit` type itself lives in `./constants/enums` — we import it
// here so there's a single canonical definition across the monorepo.

import type { MileageUnit } from './constants/enums';

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
