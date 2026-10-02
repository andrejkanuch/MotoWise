import type { MyMotorcyclesQuery } from '@motovault/graphql';
import { HUB_UNIT, type HubUnit } from './constants';

type Motorcycle = MyMotorcyclesQuery['myMotorcycles'][number];

const DEFAULT_NUMBER_LOCALE = 'en-US';

/**
 * An odometer or distance value with the grouping separator ("38,167"). The
 * value is shown as stored — never converted between units.
 */
export function formatOdometer(value: number, locale: string = DEFAULT_NUMBER_LOCALE): string {
  return Math.round(value).toLocaleString(locale, { maximumFractionDigits: 0 });
}

/** The bike's nickname in typographic quotes when set, else its model. */
export function bikeDisplayName(bike: Pick<Motorcycle, 'nickname' | 'model'>): string {
  const nickname = bike.nickname?.trim();
  return nickname ? `“${nickname}”` : bike.model;
}

/**
 * `motorcycles.distance_unit` as a typed unit. The column is constrained to
 * km | mi; anything else (an older API without the field) reads as km.
 */
export function toHubUnit(distanceUnit: string | null | undefined): HubUnit {
  return distanceUnit === HUB_UNIT.MI ? HUB_UNIT.MI : HUB_UNIT.KM;
}
