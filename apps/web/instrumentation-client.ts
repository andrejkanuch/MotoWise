import posthog from 'posthog-js';

// PostHog is initialized on every page load but stays opted-out by default
// until the user grants analytics consent via the cookie banner.
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
    defaults: '2026-01-30',
    capture_pageview: false, // App Router — fired manually via <PostHogPageView />
    // Default is `if_capture_pageview`, which disables $pageleave when pageview is manual.
    capture_pageleave: true,
    capture_exceptions: true,
    opt_out_capturing_by_default: true,
    persistence: 'memory',
  });
}
