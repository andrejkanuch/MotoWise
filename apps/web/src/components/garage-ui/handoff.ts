// -------------------------------------------------------------------
// Web → app handoff: pure logic shared by the rail, band, bar and the
// empty-garage hero. No React, no browser globals at import time, so it is
// unit-testable in the node test environment and importable from Server
// Components.
// -------------------------------------------------------------------

import { encode } from 'uqr';
import { GET_PATH } from '@/lib/get-link';

/**
 * Every web→app action goes here. Always the production host: a QR code scanned
 * from a preview or a local dev server must still land on the real /get page,
 * which sends a phone to its store.
 */
export const APP_HANDOFF_URL = `https://motovault.app${GET_PATH}` as const;

/** What the link field shows (no scheme), e.g. "motovault.app/get". */
export const APP_HANDOFF_DISPLAY = APP_HANDOFF_URL.replace(/^https:\/\//, '');

// ── QR code ──────────────────────────────────────────────────────────

/** Medium error correction: the spec's choice for screen-to-camera scanning. */
const QR_ECC = 'M' as const;

export type QrPath = {
  /** Modules per side (the SVG viewBox is `0 0 size size`). */
  size: number;
  /** One path covering every dark module, merged into horizontal runs. */
  d: string;
};

/**
 * Encode `data` as a QR code and return a single SVG path for its dark modules.
 * No border: the tile's padding is the quiet zone (spec: "quiet zone = tile
 * padding"). Rendered as React SVG, so no HTML string is injected.
 */
export function buildQrPath(data: string = APP_HANDOFF_URL): QrPath {
  const { size, data: matrix } = encode(data, { ecc: QR_ECC, border: 0 });
  const runs: string[] = [];
  for (let y = 0; y < size; y++) {
    const row = matrix[y];
    let x = 0;
    while (x < size) {
      if (!row[x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < size && row[x]) x++;
      runs.push(`M${start} ${y}h${x - start}v1h-${x - start}z`);
    }
  }
  return { size, d: runs.join('') };
}

// ── "Better in the app" reasons ──────────────────────────────────────

/** Things only the app can do. Each has a calm card and (some) a promoted one. */
export const HandoffReason = {
  /** An overdue service: mark it done in the app. Promoted priority 1. */
  MarkServiceDone: 'mark_service_done',
  /** Record rides with the phone's GPS. Promoted priority 2 when there are no rides. */
  RecordRides: 'record_rides',
  /** Push service reminders. Never promoted. */
  ServiceReminders: 'service_reminders',
  /** Scan receipts with the camera. Promoted priority 3 when nothing is logged this year. */
  ScanReceipts: 'scan_receipts',
} as const;
export type HandoffReason = (typeof HandoffReason)[keyof typeof HandoffReason];

/** The calm list, in display order, when nothing replaces an entry. */
export const DEFAULT_CALM_REASONS: readonly HandoffReason[] = [
  HandoffReason.RecordRides,
  HandoffReason.ServiceReminders,
  HandoffReason.ScanReceipts,
];

/** The one reason a page promotes (at most one per page). */
export type PromotedHandoff =
  | { reason: typeof HandoffReason.MarkServiceDone; taskTitle: string }
  | { reason: typeof HandoffReason.RecordRides }
  | { reason: typeof HandoffReason.ScanReceipts; year: number };

export type PromotionSignals = {
  /** Title of the most urgent overdue task for the shown bike, if any. */
  overdueTaskTitle?: string | null;
  /**
   * Whether the rider has any recorded ride. `null`/`undefined` means unknown
   * (still loading, or the query failed): never promote on an unknown, or the
   * page would claim "No rides yet" to a rider who has rides.
   */
  hasRides?: boolean | null;
  /** Whether anything is logged this calendar year. Same unknown rule. */
  hasExpensesThisYear?: boolean | null;
  /** The calendar year the spend card shows. */
  year: number;
};

/**
 * Pick the promoted reason: overdue service › no rides › no expenses this year.
 * Returns null when nothing qualifies (the bar then reads "Better in the app.").
 */
export function pickPromotedHandoff(signals: PromotionSignals): PromotedHandoff | null {
  const title = signals.overdueTaskTitle?.trim();
  if (title) return { reason: HandoffReason.MarkServiceDone, taskTitle: title };
  if (signals.hasRides === false) return { reason: HandoffReason.RecordRides };
  if (signals.hasExpensesThisYear === false) {
    return { reason: HandoffReason.ScanReceipts, year: signals.year };
  }
  return null;
}

/** The calm reasons to list under a promoted card: the promoted one is not repeated. */
export function calmReasonsFor(promoted: PromotedHandoff | null): HandoffReason[] {
  return DEFAULT_CALM_REASONS.filter((reason) => reason !== promoted?.reason);
}

// ── Sticky bar dismissal (phone, < 768) ──────────────────────────────

/** Bump the version to show the bar again to everyone who dismissed it. */
export const APP_BAR_DISMISS_KEY = 'mv_garage_app_bar_dismissed_v1';
const DISMISSED_VALUE = '1';

/** The subset of `Storage` the bar needs (injectable for tests). */
export type DismissStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** The browser's localStorage, or null when it is absent or access throws. */
export function browserStorage(): DismissStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Whether the rider dismissed the bar on this device. Any storage failure
 * (private mode, blocked site data) reads as "not dismissed": the bar shows.
 */
export function isAppBarDismissed(storage: DismissStorage | null): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(APP_BAR_DISMISS_KEY) === DISMISSED_VALUE;
  } catch {
    return false;
  }
}

/** Remember the dismissal. Failure is silent: the bar still hides for this visit. */
export function rememberAppBarDismissed(storage: DismissStorage | null): void {
  if (!storage) return;
  try {
    storage.setItem(APP_BAR_DISMISS_KEY, DISMISSED_VALUE);
  } catch {
    // Storage full or blocked: dismissal lasts for this page view only.
  }
}

// ── Account line ─────────────────────────────────────────────────────

/** How the rider signed up; decides the "sign in with the same account" line. */
export const SignInMethod = { Email: 'email', Google: 'google', Apple: 'apple' } as const;
export type SignInMethod = (typeof SignInMethod)[keyof typeof SignInMethod];

export type HandoffAccount = {
  method: SignInMethod;
  /** Shown for every method when known; the Google/Apple line names the button instead. */
  email?: string | null;
};

const KNOWN_METHODS = new Set<string>(Object.values(SignInMethod));

/**
 * Map Supabase `user.app_metadata.provider` to a sign-in method. Anything
 * unknown falls back to email, whose line simply names the address.
 */
export function signInMethodFromProvider(provider: unknown): SignInMethod {
  return typeof provider === 'string' && KNOWN_METHODS.has(provider)
    ? (provider as SignInMethod)
    : SignInMethod.Email;
}
