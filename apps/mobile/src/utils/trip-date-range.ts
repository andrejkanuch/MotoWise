import { parseISO } from 'date-fns';

const LONG_DATE: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
const SHORT_DATE: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };

/**
 * A trip date as a local calendar day. Trips store date-only `YYYY-MM-DD`, which `new Date()`
 * reads as UTC midnight, so riders west of UTC saw the previous day; date-fns `parseISO` reads a
 * date-only string as local midnight (and keeps full timestamps as they are).
 */
export function calendarDate(value: string): Date {
  const d = parseISO(value);
  return Number.isNaN(d.getTime()) ? new Date(value) : d;
}

/** Long form in the app language: `June 14, 2026 – July 2, 2026` (en), `14 de junio de 2026 – 2 de julio de 2026` (es). */
export function formatTripDateRangeLong(start: string, end: string, locale: string): string {
  const s = calendarDate(start);
  const e = calendarDate(end);
  return `${s.toLocaleDateString(locale, LONG_DATE)} – ${e.toLocaleDateString(locale, LONG_DATE)}`;
}

/** Short form in the app language: `Jun 14 – Jul 2`, or one date when start and end are equal. */
export function formatTripDateRangeShort(start: string, end: string, locale: string): string {
  const s = calendarDate(start);
  const e = calendarDate(end);
  if (start === end) return s.toLocaleDateString(locale, SHORT_DATE);
  return `${s.toLocaleDateString(locale, SHORT_DATE)} – ${e.toLocaleDateString(locale, SHORT_DATE)}`;
}
