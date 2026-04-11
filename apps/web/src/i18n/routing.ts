import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  // Europe + Americas only. Locales removed 2026-04-11: pt-BR, ja, hi, th, id, tr, pl
  // (see next.config.ts redirects() for 90-day grace period on removed prefixes).
  locales: ['en', 'de', 'fr', 'es', 'it'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',
  // Disable Accept-Language + NEXT_LOCALE cookie detection so canonical URLs
  // never redirect based on the browser. Required for `as-needed` prefix to
  // return 200 at /features/... without 307-cascading to /en/features/...
  // See: docs/plans/2026-04-11-002-feat-seo-audit-implementation-plan.md
  localeDetection: false,
});
