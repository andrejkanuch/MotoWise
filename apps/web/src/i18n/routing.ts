import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  // Europe + Americas + Japan. pt-BR, ja, pl re-enabled 2026-06-01 (fully translated).
  // Still disabled (redirected in next.config.ts): hi, th, id, tr.
  locales: ['en', 'de', 'fr', 'es', 'it', 'ja', 'pl', 'pt-BR'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',
  // Disable Accept-Language + NEXT_LOCALE cookie detection so canonical URLs
  // never redirect based on the browser. Required for `as-needed` prefix to
  // return 200 at /features/... without 307-cascading to /en/features/...
  // See: docs/plans/2026-04-11-002-feat-seo-audit-implementation-plan.md
  localeDetection: false,
});
