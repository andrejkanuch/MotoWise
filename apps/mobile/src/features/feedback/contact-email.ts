import {
  FEEDBACK_CONTACT_WORDING_VERSION,
  type FeedbackContact,
  FeedbackContactEmailSchema,
  FeedbackContactSchema,
  type FeedbackContactSource,
  buildFeedbackContact as sharedBuildFeedbackContact,
} from '@motovault/types';

/**
 * The rider's contact opt-in (`users.preferences.feedbackContact`) and the
 * "Email to reach me at" field, shared by the feedback form and Notifications.
 */

/** Apple "Hide My Email" relay domains. Only these count as a relay address. */
const RELAY_EMAIL_DOMAINS = ['@privaterelay.appleid.com', '@private.icloud.com'] as const;

export function isRelayEmail(email: string | null | undefined): boolean {
  const lower = email?.trim().toLowerCase() ?? '';
  return RELAY_EMAIL_DOMAINS.some((domain) => lower.endsWith(domain));
}

/** The stored opt-in, or null when the rider never decided (or the value is malformed). */
export function readFeedbackContact(preferences: unknown): FeedbackContact | null {
  if (!preferences || typeof preferences !== 'object') return null;
  const parsed = FeedbackContactSchema.safeParse(
    (preferences as { feedbackContact?: unknown }).feedbackContact,
  );
  return parsed.success ? parsed.data : null;
}

/**
 * What the email field starts with: the rider's chosen address, else the
 * account email. A relay account starts empty — the relay address is used
 * unless the rider types a personal one.
 */
export function initialContactEmailField(
  accountEmail: string | null | undefined,
  storedEmail: string | null | undefined,
): string {
  if (storedEmail) return storedEmail;
  if (!accountEmail || isRelayEmail(accountEmail)) return '';
  return accountEmail;
}

export const CONTACT_EMAIL_ERROR = {
  INVALID: 'invalid',
} as const;

export type ContactEmailResult =
  | { ok: true; email: string | null }
  | { ok: false; error: (typeof CONTACT_EMAIL_ERROR)[keyof typeof CONTACT_EMAIL_ERROR] };

/**
 * Turns the field into the stored value. Empty, or the account email itself,
 * is `null` ("use the account email"), so a later login-email change never
 * leaves a stale copy behind.
 */
export function parseContactEmailField(
  value: string,
  accountEmail: string | null | undefined,
): ContactEmailResult {
  if (value.trim() === '') return { ok: true, email: null };
  const parsed = FeedbackContactEmailSchema.safeParse(value);
  if (!parsed.success) return { ok: false, error: CONTACT_EMAIL_ERROR.INVALID };
  const sameAsAccount = parsed.data.toLowerCase() === accountEmail?.trim().toLowerCase();
  return { ok: true, email: sameAsAccount ? null : parsed.data };
}

/** The whole `feedbackContact` object, as every writer must send it. */
export function buildFeedbackContact({
  enabled,
  email,
  locale,
  source,
  now = new Date(),
}: {
  enabled: boolean;
  email: string | null;
  locale: string;
  source: FeedbackContactSource;
  now?: Date;
}): FeedbackContact {
  return sharedBuildFeedbackContact({
    enabled,
    email,
    wordingVersion: FEEDBACK_CONTACT_WORDING_VERSION,
    locale,
    source,
    now,
  });
}
