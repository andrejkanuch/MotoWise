import { NEAR_EXPIRY_BADGE_DAYS } from '@motovault/types';
import { differenceInCalendarDays, parseISO } from 'date-fns';

export type DocumentExpiryLevel = 'expired' | 'soon' | 'future';

/** Whole calendar days until expiry; negative when already expired, null when no date. */
export function daysUntilExpiry(expiryDate: string | null | undefined): number | null {
  if (!expiryDate) return null;
  return differenceInCalendarDays(parseISO(expiryDate), new Date());
}

/**
 * Classify a document's expiry against the near-expiry badge threshold.
 * Single source of truth so badges, counts, and alerts never drift.
 * (notifications.ts keeps its own multi-offset reminder scheduling and
 * intentionally does not use this.)
 */
export function documentExpiryStatus(
  expiryDate: string | null | undefined,
): { level: DocumentExpiryLevel; days: number } | null {
  const days = daysUntilExpiry(expiryDate);
  if (days === null) return null;
  if (days < 0) return { level: 'expired', days };
  if (days <= NEAR_EXPIRY_BADGE_DAYS) return { level: 'soon', days };
  return { level: 'future', days };
}

/** True when a document is expired or within the near-expiry badge window — used for counts/badges. */
export function isExpiringSoon(expiryDate: string | null | undefined): boolean {
  const status = documentExpiryStatus(expiryDate);
  return status !== null && status.level !== 'future';
}
