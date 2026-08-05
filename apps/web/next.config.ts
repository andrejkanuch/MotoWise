import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

// Still-disabled locales — keep 308 redirects to default. (pt-BR, ja, pl were
// re-enabled 2026-06-01 after full translation; hi/th/id/tr remain out of scope.)
const DROPPED_LOCALES = ['hi', 'th', 'id', 'tr'] as const;

// Active non-default locales (default 'en' is unprefixed). Kept in sync with
// src/i18n/routing.ts. Used to strip stray locale prefixes off routes that only
// exist in the non-localized root tree (see NON_LOCALIZED_ROUTE_SECTIONS).
const ACTIVE_NON_DEFAULT_LOCALES = ['de', 'fr', 'es', 'it', 'ja', 'pl', 'pt-BR'] as const;

// Top-level sections that live ONLY in the non-localized root app tree — they do
// NOT exist under [locale]/(marketing). A locale-prefixed request (e.g.
// /de/trips/... or /de/pro) therefore 404s. These 404s were a large share of
// Google Search Console's "Not found (404)" bucket. Redirect them to the
// canonical, unprefixed URL so crawl signals consolidate instead of dead-ending.
// `pro` is included because the marketing navbar links it via the locale-aware
// <Link> (components/marketing/navbar.tsx), so every localized page emits
// /{locale}/pro. `explore` is deliberately excluded — it exists in BOTH trees
// and localizes correctly.
// NOTE: keep this aligned with the skip-locale branch in src/proxy.ts — both
// encode "this section is root-only, not under [locale]".
const NON_LOCALIZED_ROUTE_SECTIONS = [
  'trips',
  'route',
  'routes',
  'ride',
  'rider',
  'pro',
  'piel',
] as const;

/**
 * Trip slugs that changed and still have inbound links / index entries.
 * Kept here rather than in the page because only a config-level redirect runs
 * before rendering, which is what a genuine 308 requires — see redirects() below.
 */
const LEGACY_TRIP_REDIRECTS = [
  { from: '/trips/us/ca/pacific-coast-highway', to: '/trips/us/ca/pacific-coast-highway-big-sur' },
] as const;

const ACTIVE_LOCALE_REGEX_GROUP = ACTIVE_NON_DEFAULT_LOCALES.join('|');
const NON_LOCALIZED_SECTION_REGEX_GROUP = NON_LOCALIZED_ROUTE_SECTIONS.join('|');

const nextConfig: NextConfig = {
  cacheComponents: false,
  reactCompiler: true,
  // Inline stylesheets as <style> tags instead of render-blocking <link>s.
  // Removes the 3 render-blocking CSS requests from the critical path (~623ms
  // FCP savings measured via Lighthouse on the homepage). Production builds only.
  experimental: {
    inlineCss: true,
  },
  // Strip the `x-powered-by: Next.js` response header to avoid fingerprinting.
  poweredByHeader: false,
  // Lock trailing-slash behavior to avoid double-redirects with localePrefix:'as-needed'.
  trailingSlash: false,
  // Prevent Next.js from stripping trailing slashes on PostHog API requests
  // (e.g. /ingest/decide/) — required for the reverse proxy to work correctly.
  skipTrailingSlashRedirect: true,
  transpilePackages: ['@motovault/types', '@motovault/graphql', '@motovault/design-system'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'tpsoneenbrmdwvzcbifw.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'api.mapbox.com',
        pathname: '/**',
      },
    ],
  },
  headers: async () => [
    {
      source: '/images/:path*',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    },
    {
      source: '/screenshots/:path*',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    },
  ],
  async redirects() {
    // Graceful 308 redirects for the 7 locales removed on 2026-04-11.
    // Config-level redirects run before the next-intl middleware, so these
    // take precedence over any downstream locale handling.
    return [
      // Trips renamed since the `/route/` era. These slugs have no row, so the
      // page can only `notFound()` — and under the route's static prerendering a
      // `permanentRedirect()` inside the page is baked as a 200 "Trip Not Found"
      // instead of emitting a 308 (verified in production: /trips/us/ca/
      // pacific-coast-highway returned 200 with not-found content). A redirect
      // has to run BEFORE rendering to produce a real 308, so it belongs here,
      // not in the page.
      ...LEGACY_TRIP_REDIRECTS.map(({ from, to }) => ({
        source: from,
        destination: to,
        permanent: true,
      })),
      ...DROPPED_LOCALES.flatMap((locale) => [
        { source: `/${locale}`, destination: '/', permanent: true },
        { source: `/${locale}/:path*`, destination: '/:path*', permanent: true },
      ]),
      // Strip active-locale prefixes off root-only sections (trips/route/…) that
      // have no [locale] route and would otherwise 404. Consolidates to the
      // canonical unprefixed URL. Config redirects run before the next-intl
      // middleware, so these win over locale handling.
      {
        source: `/:locale(${ACTIVE_LOCALE_REGEX_GROUP})/:section(${NON_LOCALIZED_SECTION_REGEX_GROUP})`,
        destination: '/:section',
        permanent: true,
      },
      {
        source: `/:locale(${ACTIVE_LOCALE_REGEX_GROUP})/:section(${NON_LOCALIZED_SECTION_REGEX_GROUP})/:path*`,
        destination: '/:section/:path*',
        permanent: true,
      },
      // Recover the ~1k "Not found (404)" trip-detail URLs Google already
      // indexed. The localized explore RouteCard used to link trip detail as
      // /explore/{country}/{region}/{slug} — a 3-level path that has NO route
      // (trip detail lives at /trips/{country}/{region}/{slug}). PR #177 fixed
      // the links, but the already-crawled dead URLs keep 404ing; 301 them to
      // the real trip page so their crawl signal consolidates instead of
      // dropping. Only the 3-segment form matches — the 2-level region hub
      // (/explore/{country}/{region}) and /explore/search are untouched. The
      // trips route accepts mixed-case region codes (e.g. JP-14) and
      // self-canonicalizes to lowercase, so no case transform is needed here.
      {
        source: '/explore/:country/:region/:slug',
        destination: '/trips/:country/:region/:slug',
        permanent: true,
      },
      // Same dead pattern under an active-locale prefix (via hreflang/history);
      // strip the locale and map to the canonical unprefixed trip URL.
      {
        source: `/:locale(${ACTIVE_LOCALE_REGEX_GROUP})/explore/:country/:region/:slug`,
        destination: '/trips/:country/:region/:slug',
        permanent: true,
      },
      // Blog post consolidation redirects (2026-05-27 SEO cluster architecture).
      // Warning lights merged into check engine light guide.
      {
        source: '/blog/motorcycle-warning-lights-guide',
        destination: '/blog/motorcycle-check-engine-light-guide',
        permanent: true,
      },
      {
        source: '/:locale/blog/motorcycle-warning-lights-guide',
        destination: '/:locale/blog/motorcycle-check-engine-light-guide',
        permanent: true,
      },
      // Battery dying merged into won't-start troubleshooting guide.
      {
        source: '/blog/motorcycle-battery-keeps-dying-fix',
        destination: '/blog/motorcycle-wont-start-troubleshooting-guide',
        permanent: true,
      },
      {
        source: '/:locale/blog/motorcycle-battery-keeps-dying-fix',
        destination: '/:locale/blog/motorcycle-wont-start-troubleshooting-guide',
        permanent: true,
      },
      {
        source: '/features/progress-tracking',
        destination: '/features/ride-tracking',
        permanent: true,
      },
      {
        source: '/:locale/features/progress-tracking',
        destination: '/:locale/features/ride-tracking',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://eu-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://eu.i.posthog.com/:path*',
      },
      // NOTE: the bare-root /apple-app-site-association is served by a real route
      // handler (src/app/apple-app-site-association/route.ts), NOT a rewrite —
      // afterFiles rewrites don't fire for the App Router not-found path, so a
      // rewrite here returned 404 in production.
    ];
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: 'lominic',

  project: 'motovault-web',

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
