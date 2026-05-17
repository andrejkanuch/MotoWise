// This file configures the initialization of Sentry and PostHog on the client.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';
import posthog from 'posthog-js';

// ── Sentry ──────────────────────────────────────────────────────────────────
Sentry.init({
  dsn: 'https://a3cf72113ed0793fa895a40f6baa3ab1@o4510167517954048.ingest.us.sentry.io/4511299447291904',
  integrations: [Sentry.replayIntegration()],
  tracesSampleRate: 1,
  enableLogs: true,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  sendDefaultPii: true,
  beforeSend(event) {
    if (event.exception?.values?.some((e) => e.value?.includes('ResizeObserver loop'))) {
      return null;
    }
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

// ── PostHog ─────────────────────────────────────────────────────────────────
// Initialized on every page load but stays opted-out by default until the user
// grants analytics consent via the cookie banner.
// See apps/web/src/components/cookie-consent.tsx — accept()/deny() toggles
// posthog.opt_in_capturing() / opt_out_capturing() at runtime.
//
// GDPR: `opt_out_capturing_by_default: true` means no events (including
// pageviews and $exception) are sent until the user opts in. We use
// `persistence: 'memory'` pre-consent so we never write a `ph_` cookie
// before the user has agreed.
if (process.env.NODE_ENV === 'production') {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN ?? '', {
    api_host: '/ingest',
    ui_host: 'https://eu.posthog.com',
    capture_pageview: 'history_change',
    capture_exceptions: true,
    opt_out_capturing_by_default: true,
    persistence: 'memory',
    // Must match the persistence layer that opt_in_capturing() writes to.
    // CookieConsentProvider switches persistence to 'localStorage+cookie'
    // before calling opt_in_capturing(), so the opt-out flag lives in
    // localStorage. Without this, the SDK defaults to checking a cookie
    // that never gets written, and stays opted-out on every page load.
    opt_out_capturing_persistence_type: 'localStorage',
  });
}
