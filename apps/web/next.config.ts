import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

// Locales removed 2026-04-11 — keep 308 redirects for 90 days (remove after 2026-07-11).
const DROPPED_LOCALES = ['pt-BR', 'ja', 'hi', 'th', 'id', 'tr', 'pl'] as const;

const nextConfig: NextConfig = {
  cacheComponents: false,
  reactCompiler: true,
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
    return DROPPED_LOCALES.flatMap((locale) => [
      { source: `/${locale}`, destination: '/', permanent: true },
      { source: `/${locale}/:path*`, destination: '/:path*', permanent: true },
    ]);
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
