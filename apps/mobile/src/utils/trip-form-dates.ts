/**
 * Date rules for create/edit trip form — keep in sync with
 * `packages/types/src/validators/trip.ts` (validateTripDateRange).
 */
import { format } from 'date-fns';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PAST_DAYS = 365;
const MAX_FUTURE_DAYS = 5 * 365;
const MAX_TRIP_SPAN_DAYS = 365;

/** Migrated templates / null dates often use 1970-01-01. Treat pre-1990 as invalid for planning. */
export function isPlaceholderOrEpochTripDate(d: Date): boolean {
  if (Number.isNaN(d.getTime())) return true;
  return d.getFullYear() < 1990;
}

/** Default: tomorrow 09:00 start, day after 18:00 end (same as create-trip initial state). */
export function getDefaultNewTripDateRange(): { start: Date; end: Date } {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(9, 0, 0, 0);
  const end = new Date();
  end.setDate(end.getDate() + 2);
  end.setHours(18, 0, 0, 0);
  return { start, end };
}

/**
 * For cloning a **template** (`is_template` source): user picks real calendar dates; span follows `dayCount`.
 */
export function datesForClonedTemplate(dayCount: number | null | undefined): {
  start: Date;
  end: Date;
} {
  const days = Math.max(1, Math.min(MAX_TRIP_SPAN_DAYS, Math.floor(dayCount ?? 1)));
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + (days - 1));
  end.setHours(18, 0, 0, 0);
  return { start, end };
}

/**
 * When loading edit/clone from server strings, return safe Dates or null if unusable.
 */
export function safeTripDatesFromApi(
  startDateStr: string,
  endDateStr: string,
): { start: Date; end: Date; ok: true } | { ok: false } {
  const start = new Date(`${startDateStr}T09:00:00`);
  const end = new Date(`${endDateStr}T18:00:00`);
  if (isPlaceholderOrEpochTripDate(start) || isPlaceholderOrEpochTripDate(end)) {
    return { ok: false };
  }
  if (start.getTime() > end.getTime()) {
    return { ok: false };
  }
  return { start, end, ok: true };
}

/**
 * For save: returns an error message or null if OK. Uses calendar semantics aligned with API date fields.
 */
export function validateTripFormDateRangeForSave(start: Date, end: Date): string | null {
  if (isPlaceholderOrEpochTripDate(start) || isPlaceholderOrEpochTripDate(end)) {
    return 'Set a start and end date in the current century';
  }
  if (start.getTime() > end.getTime()) {
    return 'End date must be on or after the start date';
  }

  const now = Date.now();
  const minStart = now - MAX_PAST_DAYS * ONE_DAY_MS;
  const maxCalendar = now + MAX_FUTURE_DAYS * ONE_DAY_MS;
  if (start.getTime() < minStart) {
    return 'Start date can’t be more than a year in the past';
  }
  if (start.getTime() > maxCalendar) {
    return 'Start date is too far in the future (max 5 years)';
  }
  if (end.getTime() > maxCalendar) {
    return 'End date is too far in the future (max 5 years)';
  }

  const startDay = toISODateInput(start);
  const endDay = toISODateInput(end);
  const spanDays = calendarDaysBetweenInclusive(startDay, endDay);
  if (spanDays > MAX_TRIP_SPAN_DAYS) {
    return `Trip length can’t exceed ${MAX_TRIP_SPAN_DAYS} days`;
  }

  return null;
}

/** Format a Date as a local `YYYY-MM-DD` string for date-input fields. */
export function toISODateInput(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function calendarDaysBetweenInclusive(startIso: string, endIso: string): number {
  const a = new Date(`${startIso}T12:00:00`);
  const b = new Date(`${endIso}T12:00:00`);
  const diff = b.getTime() - a.getTime();
  if (diff < 0) return 0;
  return Math.floor(diff / ONE_DAY_MS) + 1;
}
