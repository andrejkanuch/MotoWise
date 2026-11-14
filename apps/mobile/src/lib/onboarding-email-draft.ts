import { deleteSecureItem, getSecureItem, SECURE_STORE_KEY, setSecureItem } from './secure-store';

/**
 * issue 365 T13a (FS-OB3, ruling D10): the address an onboarding email code went
 * to, and when, so a relaunch can reopen the code step instead of the form.
 *
 * Kept in SecureStore, never MMKV, and only until onboarding ends: cleared by the
 * onboarding store's reset() and resetForSignOut(), on code success and at
 * completion. Never the password (verifyOtp does not need it) or the code.
 */
export interface EmailDraft {
  email: string;
  /** Epoch ms of the send that opened the code step. */
  codeSentAt: number;
}

/** A code step younger than this reopens; an older one prefills the email form. */
export const EMAIL_DRAFT_RESTORE_WINDOW_MS = 60 * 60 * 1000;

const KEY = SECURE_STORE_KEY.ONBOARDING_EMAIL_DRAFT;

/** Writes only the two fields, whatever the caller passes. A locked keychain is skipped. */
export async function saveEmailDraft({ email, codeSentAt }: EmailDraft): Promise<void> {
  await setSecureItem(KEY, JSON.stringify({ email, codeSentAt }));
}

function isEmailDraft(value: unknown): value is EmailDraft {
  if (!value || typeof value !== 'object') return false;
  const { email, codeSentAt } = value as Record<string, unknown>;
  return (
    typeof email === 'string' &&
    email.length > 0 &&
    typeof codeSentAt === 'number' &&
    Number.isFinite(codeSentAt)
  );
}

/** The saved draft, or null when there is none, it is unreadable or the keychain is locked. */
export async function readEmailDraft(): Promise<EmailDraft | null> {
  const raw = await getSecureItem(KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isEmailDraft(parsed) ? { email: parsed.email, codeSentAt: parsed.codeSentAt } : null;
  } catch {
    return null;
  }
}

export async function clearEmailDraft(): Promise<void> {
  await deleteSecureItem(KEY);
}

/** How long ago the code was sent; never negative (a clock set back reads as "just now"). */
export function emailDraftAgeMs(draft: EmailDraft, now: number): number {
  return Math.max(0, now - draft.codeSentAt);
}

export function isEmailDraftFresh(draft: EmailDraft, now: number): boolean {
  return emailDraftAgeMs(draft, now) <= EMAIL_DRAFT_RESTORE_WINDOW_MS;
}
