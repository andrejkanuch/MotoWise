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

export default withNextIntl(nextConfig);
