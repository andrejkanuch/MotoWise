/**
 * Shared detector for transient connectivity failures.
 *
 * These messages are emitted by fetch, the GraphQL transport, and SDKs like
 * RevenueCat when the device is offline/backgrounded or a request times out.
 * They are non-actionable: the originating layer (offline sync queue, RC SDK,
 * TanStack Query) already retries them, so callers should downgrade rather than
 * report them to Sentry.
 *
 * Kept as a single source of truth so the substring list is never duplicated
 * (repo rule: no duplicated magic strings).
 */
// Entries are matched against the lowercased message. Strings match as
// substrings; RegExp entries let a needle assert word boundaries so a bare
// substring can't misclassify an unrelated error.
const NETWORK_ERROR_MESSAGES: readonly (string | RegExp)[] = [
  'network request failed',
  'failed to fetch',
  // expo/fetch (the global fetch in Expo SDK 52+) wraps EVERY transport-level
  // failure as `FetchError: fetch failed: <native reason>` — offline, DNS,
  // cancelled-in-background, TLS handshake. Server responses (4xx/5xx) resolve
  // normally and never carry this prefix, so the prefix exactly identifies the
  // non-actionable transport class. The native reason is OS-localized (e.g.
  // French "La connexion réseau a été perdue"), so matching the reason text is
  // unreliable — match the stable prefix instead. The leading \b word boundary
  // plus the trailing colon anchors to the `fetch failed: <reason>` format so an
  // embedded-word error like "prefetch failed: …" (or one that merely contains
  // the words "fetch failed") is not silently dropped from Sentry. No `i` flag
  // is needed because the message is lowercased before matching.
  // (Sentry MOTO-VAULT-REACT-NATIVE-22 / -23 / -26 / -1Y)
  /\bfetch failed:/,
  'internet connection appears to be offline',
  'the request timed out',
  'the network connection was lost',
  // Android DNS resolution failure (java.net.UnknownHostException).
  'unable to resolve host',
  // RevenueCat surfaces transient connectivity failures with this generic
  // message; the SDK retries them. (Sentry MOTO-VAULT-REACT-NATIVE-M)
  'error performing request',
];

/**
 * Accepts an Error or a raw message string. Matching is case-insensitive —
 * iOS capitalizes "The Internet connection appears to be offline" while the
 * needle list is lowercase, which previously let those events through.
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message === 'Network request failed') return true;
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return NETWORK_ERROR_MESSAGES.some((needle) =>
    typeof needle === 'string' ? msg.includes(needle) : needle.test(msg),
  );
}
