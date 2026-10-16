import { differenceInMilliseconds, parseISO } from 'date-fns';

/** `Diagnostic.status` values the API returns. */
export const DIAGNOSTIC_STATUS = {
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

/** A diagnosis still processing after this long is treated as failed. */
const STUCK_AFTER_MS = 2 * 60 * 1000;

/** Poll interval for a diagnosis that is still processing. */
export const PROCESSING_POLL_MS = 3000;

export function isStuckProcessing(createdAt: string): boolean {
  return differenceInMilliseconds(new Date(), parseISO(createdAt)) >= STUCK_AFTER_MS;
}

/**
 * Day + month the free diagnosis comes back, e.g. "November 1". The reset is
 * 00:00 UTC on the 1st, so it is formatted IN UTC — in local time the Americas
 * would read "October 31".
 */
export function formatQuotaResetDate(resetDate: string, language: string): string {
  return new Intl.DateTimeFormat(language, {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(parseISO(resetDate));
}

/** Medium date in the app language, e.g. "9 Oct 2026". */
export function formatDiagnosisDate(createdAt: string, language: string): string {
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(parseISO(createdAt));
}
