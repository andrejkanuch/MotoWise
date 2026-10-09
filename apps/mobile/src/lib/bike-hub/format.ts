import type { MyMotorcyclesQuery } from '@motovault/graphql';
import { parseISO } from 'date-fns';
import { HUB_UNIT, type HubUnit, NOUN_CAPITALISING_LANGUAGES } from './constants';

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

const KEEP_NOUN_CASE: readonly string[] = NOUN_CAPITALISING_LANGUAGES;

/**
 * A name (a document category, seeded or custom) placed mid-sentence:
 * lower-cased with the locale's rules, except in languages that capitalise
 * nouns. "Insurance" → "insurance expires in 12 days"; German keeps
 * "Versicherung".
 */
export function midSentence(name: string, locale: string): string {
  const language = locale.split('-')[0]?.toLowerCase() ?? '';
  return KEEP_NOUN_CASE.includes(language) ? name : name.toLocaleLowerCase(locale);
}

/**
 * Date-only strings ("2022-06-15") are calendar dates: parse them as local days,
 * not as UTC midnight, or they slip to the previous day west of Greenwich.
 */
function toDate(value: string | Date): Date {
  return typeof value === 'string' ? parseISO(value) : value;
}

/** "June 2022"-style month and year, in the given locale. */
export function formatMonthYear(value: string | Date, locale: string): string {
  return toDate(value).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

/** "Sep 28"-style short date, in the given locale. */
export function formatShortDate(value: string | Date, locale: string): string {
  return toDate(value).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

/**
 * Whether the bike has an odometer reading to show. `null` and 0 both mean "not
 * set yet": no rider logs a note or a service at 0, and "0 km" reads as data.
 */
export function hasOdometer(value: number | null | undefined): value is number {
  return value != null && value > 0;
}

/** "Oct 9, 2026"-style date with the year, in the given locale. */
export function formatFullDate(value: string | Date, locale: string): string {
  return toDate(value).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
