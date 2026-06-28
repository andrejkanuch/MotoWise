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
const NETWORK_ERROR_MESSAGES = [
  'Network request failed',
  'Failed to fetch',
  'internet connection appears to be offline',
  'The request timed out',
  'The network connection was lost',
  // RevenueCat surfaces transient connectivity failures with this generic
  // message; the SDK retries them. (Sentry MOTO-VAULT-REACT-NATIVE-M)
  'Error performing request',
] as const;

export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message === 'Network request failed') return true;
  const msg = error instanceof Error ? error.message : String(error);
  return NETWORK_ERROR_MESSAGES.some((needle) => msg.includes(needle));
}
