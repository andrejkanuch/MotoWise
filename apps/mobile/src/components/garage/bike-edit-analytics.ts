import type { MotorcycleVariant } from '@motovault/types';
import type { JsonType } from '@posthog/core';
import { BIKE_EDIT_SOURCE } from '@/config/routes';

/** The bike editor's form, as strings where the inputs hold strings. */
export interface BikeFormValues {
  nickname: string;
  year: string;
  make: string;
  model: string;
  mileage: string;
  isPrimary: boolean;
  photoUrl: string | null;
  purchasePrice: string;
  vin: string;
  variant: MotorcycleVariant | null;
}

/** Field names in `garage_bike_edited.changed_fields` — names only, never values. */
export const BIKE_EDIT_FIELD = {
  NICKNAME: 'nickname',
  YEAR: 'year',
  MAKE: 'make',
  MODEL: 'model',
  MILEAGE: 'mileage',
  PRIMARY: 'is_primary',
  PHOTO: 'photo',
  PURCHASE_PRICE: 'purchase_price',
  VIN: 'vin',
  VARIANT: 'variant',
} as const;
export type BikeEditField = (typeof BIKE_EDIT_FIELD)[keyof typeof BIKE_EDIT_FIELD];

/** The form key behind each reported field, in the order the form shows them. */
const FIELD_KEYS: readonly (readonly [keyof BikeFormValues, BikeEditField])[] = [
  ['nickname', BIKE_EDIT_FIELD.NICKNAME],
  ['year', BIKE_EDIT_FIELD.YEAR],
  ['make', BIKE_EDIT_FIELD.MAKE],
  ['model', BIKE_EDIT_FIELD.MODEL],
  ['mileage', BIKE_EDIT_FIELD.MILEAGE],
  ['isPrimary', BIKE_EDIT_FIELD.PRIMARY],
  ['photoUrl', BIKE_EDIT_FIELD.PHOTO],
  ['purchasePrice', BIKE_EDIT_FIELD.PURCHASE_PRICE],
  ['vin', BIKE_EDIT_FIELD.VIN],
  ['variant', BIKE_EDIT_FIELD.VARIANT],
];

/** How much of the bike was known before the edit, as `bike_added.capture_level`. */
export const BIKE_CAPTURE_LEVEL = {
  MODEL: 'model',
  MAKE: 'make',
} as const;

/** The fields that differ from the loaded bike; empty means the form is clean. */
export function changedBikeFields(initial: BikeFormValues, current: BikeFormValues) {
  return FIELD_KEYS.filter(([key]) => initial[key] !== current[key]).map(([, field]) => field);
}

const KNOWN_SOURCES: ReadonlySet<string> = new Set(Object.values(BIKE_EDIT_SOURCE));

/**
 * `garage_bike_edited` (issue 365 T05d, FS-R2-3). `schedule_refreshed_count`
 * stays null until the API reports how many tasks a make/model/year change
 * refreshed (T23).
 */
export function bikeEditedProperties({
  initial,
  changed,
  source,
}: {
  initial: BikeFormValues;
  changed: readonly BikeEditField[];
  source: string | undefined;
}): Record<string, JsonType> {
  return {
    changed_fields: changed.join(','),
    from_capture_level: initial.model ? BIKE_CAPTURE_LEVEL.MODEL : BIKE_CAPTURE_LEVEL.MAKE,
    source: source && KNOWN_SOURCES.has(source) ? source : BIKE_EDIT_SOURCE.OTHER,
    schedule_refreshed_count: null,
  };
}
