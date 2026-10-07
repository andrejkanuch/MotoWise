import * as Sentry from '@sentry/nextjs';

/**
 * Sentinel path segments the 404-contract probe (`scripts/check-404-contract.sh`)
 * requests on purpose to assert that unknown URLs return HTTP 404. They are not
 * URLs we advertise, so a soft-404 for them is the probe working, not drift.
 *
 * The probe runs on every production `deployment_status` and hits five of these
 * per run, so before this list they made up most of MOTOVAULT-WEB-P/-Q/-R (441,
 * 266 and 90 events): every one sampled from Vercel's 404 log over three days was
 * a probe URL, and it buried the real signal. The `soft-404.test.ts` suite parses
 * the script and fails if a bogus row is added there without a sentinel here.
 */
export const CONTRACT_PROBE_SENTINELS: ReadonlySet<string> = new Set([
  'zz',
  'zz-99',
  'beartooth-highway-does-not-exist',
]);

/**
 * Shape of every country / region / slug segment we generate (kebab-case
 * alphanumerics; region codes like `ME-KO` arrive in either case). A segment
 * outside it — `products.json`, `wp-login.php`, `.env` — is a vulnerability or
 * storefront scanner guessing paths, never a link of ours, so it cannot be a
 * soft-404 of an advertised URL.
 */
const ROUTE_SEGMENT_RE = /^[a-z0-9][a-z0-9-]*$/i;

/** Detail keys that are route segments (as opposed to `locale`, which is not). */
const SEGMENT_KEYS = ['country', 'region', 'slug'] as const;

/**
 * True when a soft-404 is expected traffic rather than drift between the URLs we
 * advertise and the content we can resolve: the contract probe's own sentinels,
 * or a scanner-shaped segment. Such a request still logs, but is not sent to
 * Sentry.
 */
export function isExpectedNotFound(detail: Record<string, string>): boolean {
  return SEGMENT_KEYS.some((key) => {
    const value = detail[key];
    if (value === undefined) return false;
    return CONTRACT_PROBE_SENTINELS.has(value.toLowerCase()) || !ROUTE_SEGMENT_RE.test(value);
  });
}

/**
 * Record a soft-404: a request for a URL we advertise (sitemap / internal links)
 * that resolved to `notFound()`.
 *
 * `notFound()` is normal Next.js control flow — it throws an internal
 * NEXT_HTTP_ERROR_FALLBACK signal that the framework catches to render
 * `not-found.tsx`, so it never reaches Sentry's error pipeline. Without this,
 * a sitemap URL that silently 404s leaves no trace in monitoring. Emits a
 * runtime log line plus a warning-level Sentry message so drift between the
 * URLs we advertise and the content we can actually resolve stays visible.
 *
 * Expected not-founds ({@link isExpectedNotFound}) keep the log line but skip
 * Sentry, so the issue only moves when a real URL stops resolving.
 */
export function reportSoftNotFound(scope: string, detail: Record<string, string>): void {
  const payload = { scope, ...detail };
  console.warn(`[soft-404] ${scope}`, JSON.stringify(payload));
  if (isExpectedNotFound(detail)) return;
  Sentry.captureMessage(`soft-404: ${scope}`, { level: 'warning', extra: payload });
}
