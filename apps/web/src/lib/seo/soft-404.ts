import * as Sentry from '@sentry/nextjs';

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
 */
export function reportSoftNotFound(scope: string, detail: Record<string, string>): void {
  const payload = { scope, ...detail };
  console.warn(`[soft-404] ${scope}`, JSON.stringify(payload));
  Sentry.captureMessage(`soft-404: ${scope}`, { level: 'warning', extra: payload });
}
