import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  cacheComponents: false,
  reactCompiler: true,
  // Strip the `x-powered-by: Next.js` response header to avoid fingerprinting.
  poweredByHeader: false,
  // Lock trailing-slash behavior to avoid double-redirects with localePrefix:'as-needed'.
  trailingSlash: false,
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
      {
        source: '/ingest/decide',
        destination: 'https://eu.i.posthog.com/decide',
      },
    ];
  },
};

export default withNextIntl(nextConfig);
