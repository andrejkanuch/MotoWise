/**
 * Which browser fetch/XHR requests get an `http.client` span in Sentry tracing.
 *
 * mapbox-gl (the interactive maps on trip detail and /explore) loads its style,
 * sprites, glyph ranges and vector tiles as bursts of parallel GETs, plus
 * telemetry POSTs to events.mapbox.com. Every one of those URLs carries our
 * public `access_token`, so Sentry's server-side scrubber replaces the whole
 * `http.url` with `[Filtered]`. The N+1 API Call detector then sees N identical
 * `[Filtered]` GETs under the pageload and opens an issue with the pattern `*`
 * (MOTOVAULT-WEB-18, culprit `/trips/:country/:region/:slug`). The requests are
 * the map library's own tile loading, which we cannot batch, so they are left
 * out of tracing instead. Our own requests (RSC, GraphQL, Supabase, PostHog
 * proxy) still get spans.
 */
const UNTRACED_HOST_SUFFIXES = ['mapbox.com'] as const;

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    // Relative URLs ("/ingest/e/") are same-origin, so first-party.
    return null;
  }
}

function isUntracedHost(host: string): boolean {
  return UNTRACED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

/** `browserTracingIntegration({ shouldCreateSpanForRequest })`: false drops the span. */
export function shouldCreateSpanForRequest(url: string): boolean {
  const host = hostOf(url);
  return host === null || !isUntracedHost(host);
}
