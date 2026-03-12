/**
 * Base URL for the site — used in sitemap, robots.txt, JSON-LD, and Open Graph metadata.
 * Falls back to the production URL when the env var is not set.
 */
export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://motovault.app';
