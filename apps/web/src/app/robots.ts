import type { MetadataRoute } from 'next';
import { BASE_URL } from '@/lib/constants';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: '/admin/' },
      // Allow AI search crawlers explicitly. Google-Extended is allowed so
      // MotoVault can be grounded in Google AI Overviews + Gemini. Applebot
      // and Meta-ExternalAgent are allowed so Apple Intelligence / Meta AI
      // can reference the site.
      { userAgent: 'GPTBot', allow: '/' },
      { userAgent: 'OAI-SearchBot', allow: '/' },
      { userAgent: 'ChatGPT-User', allow: '/' },
      { userAgent: 'ClaudeBot', allow: '/' },
      { userAgent: 'PerplexityBot', allow: '/' },
      { userAgent: 'Amazonbot', allow: '/' },
      { userAgent: 'Google-Extended', allow: '/' },
      { userAgent: 'Applebot-Extended', allow: '/' },
      { userAgent: 'Meta-ExternalAgent', allow: '/' },
      // Block training-only crawlers that don't feed a search surface.
      { userAgent: 'CCBot', disallow: '/' },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
