import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  cacheComponents: false,
  reactCompiler: true,
  transpilePackages: ['@motovault/types', '@motovault/graphql', '@motovault/design-system'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'tpsoneenbrmdwvzcbifw.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  headers: async () => [
    {
      source: '/images/:path*',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    },
  ],
};

export default withNextIntl(nextConfig);
