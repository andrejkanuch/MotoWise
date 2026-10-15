import { differenceInCalendarDays, parseISO } from 'date-fns';

/**
 * Whole calendar days from `today` to `date` in the rider's time zone:
 * 0 for today, 1 for tomorrow, −1 for yesterday, at any hour of the day.
 *
 * A date-only string (`YYYY-MM-DD`, the shape `due_date` arrives in) is read
 * as local midnight, so it never slips to the previous day west of Greenwich.
 * A full ISO timestamp is read as its instant. An unparseable string gives
 * `NaN`; callers keep their own null and `NaN` handling.
 */
export function daysUntil(date: string, today: Date = new Date()): number {
  return differenceInCalendarDays(parseISO(date), today);
}
