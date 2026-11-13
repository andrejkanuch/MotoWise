import { DIAGNOSTIC_ENTRY, type DiagnosticEntry } from '@/config/diagnostic-entry';
import { AnalyticsEvent, trackEvent } from '@/lib/analytics';
import {
  GqlRequestTimeoutError,
  GRAPHQL_ERROR_CODE,
  REQUEST_TIMEOUT_MESSAGE,
} from '@/lib/graphql-error-classification';
import { hasGraphQLCode } from '@/lib/graphql-errors';
import { MetaAnalytics } from '@/lib/meta-analytics';
import { isNetworkError } from '@/lib/network-error';

// Issue 365 T05b (FS-PO2a/b/d): where a diagnosis started and why one failed.

const DIAGNOSTIC_ENTRIES: readonly string[] = Object.values(DIAGNOSTIC_ENTRY);

/** A route param back to a known entry; anything else (a stray deep link) is undefined. */
export function parseDiagnosticEntry(value: unknown): DiagnosticEntry | undefined {
  return typeof value === 'string' && DIAGNOSTIC_ENTRIES.includes(value)
    ? (value as DiagnosticEntry)
    : undefined;
}

/** The list's Start is `home_tool` when the Home tool opened the list, else `list`. */
export function diagnoseListEntry(listParam: unknown): DiagnosticEntry {
  return parseDiagnosticEntry(listParam) === DIAGNOSTIC_ENTRY.HOME_TOOL
    ? DIAGNOSTIC_ENTRY.HOME_TOOL
    : DIAGNOSTIC_ENTRY.LIST;
}

/** One per entry into the form, never on a refocus of it. */
export function trackDiagnosticStarted(entry: DiagnosticEntry): void {
  trackEvent(AnalyticsEvent.DIAGNOSTIC_STARTED, { entry });
  MetaAnalytics.trackStartDiagnostic();
}

/** `diagnostic_failed.reason` — a closed set, never the server's text. */
export const DIAGNOSTIC_FAILURE_REASON = {
  /** No connection, or it dropped before the answer arrived. */
  OFFLINE: 'offline',
  /** The client deadline or the OS request timeout ran out. */
  TIMEOUT: 'timeout',
  /** The API rate limit (`TOO_MANY_REQUESTS`). */
  THROTTLED: 'throttled',
  /** The server refused on the monthly limit for a rider the client took for Pro. */
  LIMIT: 'limit',
  /** Anything else the server answered with. */
  SERVER: 'server',
} as const;

export type DiagnosticFailureReason =
  (typeof DIAGNOSTIC_FAILURE_REASON)[keyof typeof DIAGNOSTIC_FAILURE_REASON];

const TIMEOUT_MESSAGE = REQUEST_TIMEOUT_MESSAGE.toLowerCase();

// Anywhere in the message: expo/fetch wraps the OS timeout as `fetch failed: The
// request timed out.`, and the submit's long client deadline outlasts the OS one.
function isTimeout(error: unknown): boolean {
  if (error instanceof GqlRequestTimeoutError) return true;
  return error instanceof Error && error.message.toLowerCase().includes(TIMEOUT_MESSAGE);
}

/** Ordered: the first matching rule names the reason (dispatch, not if/else). */
const FAILURE_RULES: readonly (readonly [DiagnosticFailureReason, (error: unknown) => boolean])[] =
  [
    [DIAGNOSTIC_FAILURE_REASON.TIMEOUT, isTimeout],
    [DIAGNOSTIC_FAILURE_REASON.OFFLINE, isNetworkError],
    [
      DIAGNOSTIC_FAILURE_REASON.THROTTLED,
      (error) => hasGraphQLCode(error, GRAPHQL_ERROR_CODE.TOO_MANY_REQUESTS),
    ],
    [
      DIAGNOSTIC_FAILURE_REASON.LIMIT,
      (error) => hasGraphQLCode(error, GRAPHQL_ERROR_CODE.FORBIDDEN),
    ],
  ];

export function classifyDiagnosticFailure(error: unknown): DiagnosticFailureReason {
  return (
    FAILURE_RULES.find(([, matches]) => matches(error))?.[0] ?? DIAGNOSTIC_FAILURE_REASON.SERVER
  );
}

const MS_PER_SECOND = 1000;
const ELAPSED_DECIMALS = 10;

/** Seconds from the submit tap to the failure, to one decimal. */
export function elapsedSeconds(startedAtMs: number, nowMs: number = Date.now()): number {
  return Math.round(((nowMs - startedAtMs) / MS_PER_SECOND) * ELAPSED_DECIMALS) / ELAPSED_DECIMALS;
}

export function trackDiagnosticFailed(error: unknown, submittedAtMs: number): void {
  const reason = classifyDiagnosticFailure(error);
  trackEvent(AnalyticsEvent.DIAGNOSTIC_FAILED, {
    reason,
    elapsed_s: elapsedSeconds(submittedAtMs),
    // The pre-3.29 boolean, unchanged (a timeout also counts), for existing insights.
    offline: isNetworkError(error),
    // Issue 365 T17: the request was sent (FS-PO2b counts post-send offline failures).
    precheck: false,
  });
}

/** Issue 365 T17: the offline pre-check stopped the submit; nothing was sent. */
export function trackDiagnosticOfflinePrecheck(): void {
  trackEvent(AnalyticsEvent.DIAGNOSTIC_FAILED, {
    reason: DIAGNOSTIC_FAILURE_REASON.OFFLINE,
    elapsed_s: 0,
    offline: true,
    precheck: true,
  });
}
