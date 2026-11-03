const LONG_DATE: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
const SHORT_DATE: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };

/** Long form in the app language: `June 14, 2026 – July 2, 2026` (en), `14 de junio de 2026 – 2 de julio de 2026` (es). */
export function formatTripDateRangeLong(start: string, end: string, locale: string): string {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleDateString(locale, LONG_DATE)} – ${e.toLocaleDateString(locale, LONG_DATE)}`;
}

/** Short form in the app language: `Jun 14 – Jul 2`, or one date when start and end are equal. */
export function formatTripDateRangeShort(start: string, end: string, locale: string): string {
  const s = new Date(start);
  const e = new Date(end);
  if (start === end) return s.toLocaleDateString(locale, SHORT_DATE);
  return `${s.toLocaleDateString(locale, SHORT_DATE)} – ${e.toLocaleDateString(locale, SHORT_DATE)}`;
}
