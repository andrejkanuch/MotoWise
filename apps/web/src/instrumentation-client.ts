// This file configures the initialization of Sentry and PostHog on the client.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';
import { captureCampaignParams } from '@/lib/campaign';
import { shouldDropClientEvent } from '@/lib/sentry-noise-filter';
import { shouldCreateSpanForRequest } from '@/lib/sentry-span-filter';

// Capture first-touch UTM params on the initial hard load (before the visitor
// navigates deeper and the query string is lost). Independent of analytics
// consent — this only writes to sessionStorage; PostHog stays opted-out until
// the cookie banner is accepted.
captureCampaignParams();

// ── Sentry ──────────────────────────────────────────────────────────────────
Sentry.init({
  dsn: 'https://a3cf72113ed0793fa895a40f6baa3ab1@o4510167517954048.ingest.us.sentry.io/4511299447291904',
  // Report only from production builds, like the server and edge configs.
  // MOTOVAULT-WEB-1Q was a `next dev` session on localhost:3000 (a headless
  // browser in a checkout with no .env.local) landing in the production project.
  // This uses NODE_ENV, not VERCEL_ENV like the server: VERCEL_ENV is not
  // inlined into the client bundle, and turbo.json excludes NEXT_PUBLIC_VERCEL_*.
  // Vercel builds every deployment with NODE_ENV=production, and previews are
  // off (vercel.json git.deploymentEnabled), so this keeps production reporting
  // and drops `next dev`.
  enabled: process.env.NODE_ENV === 'production',
  // Replay is not in the first-load bundle: it is added from Sentry's CDN once
  // the page is idle (below). The sample rates still apply when it lands.
  // browserTracingIntegration is already a default; passing it here replaces the
  // default instance (same name) so Mapbox's tile/glyph bursts get no spans
  // (MOTOVAULT-WEB-18, see sentry-span-filter.ts).
  integrations: [Sentry.browserTracingIntegration({ shouldCreateSpanForRequest })],
  tracesSampleRate: 0.2,
  enableLogs: true,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  sendDefaultPii: true,
  // Drop un-actionable third-party / in-app-browser noise. See
  // shouldDropClientEvent for the per-rule rationale (each is scoped so genuine
  // first-party errors still report).
  beforeSend(event) {
    return shouldDropClientEvent(event) ? null : event;
  },
});

/** Adds Session Replay once the main thread is idle. A blocked CDN fetch
 *  (CSP, ad blocker, offline) only means no replay for this page view. */
function addReplayWhenIdle() {
  if (process.env.NODE_ENV !== 'production' || typeof window === 'undefined') return;
  const add = () => {
    Sentry.lazyLoadIntegration('replayIntegration')
      .then((replayIntegration) => Sentry.addIntegration(replayIntegration()))
      .catch(() => {
        // no replay this time
      });
  };
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(add, { timeout: 4000 });
  } else {
    window.setTimeout(add, 1000);
  }
}
addReplayWhenIdle();

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

// ── PostHog ─────────────────────────────────────────────────────────────────
// Not initialised here: lib/posthog-client.ts imports and initialises the SDK
// once the cookie banner (or the automatic grant outside the EU) allows
// analytics, so a visitor who never says yes never downloads it.
