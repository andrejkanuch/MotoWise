import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/constants', () => ({ BASE_URL: 'https://motovault.app' }));
vi.mock('@/lib/graphql-server', () => ({
  gqlServerFetcher: vi.fn(async () => ({ sitemapPublishedTrips: [] })),
}));
vi.mock('@/lib/guides', () => ({ getGuides: vi.fn(() => []) }));

const englishPost = { slug: 'oil-change', locale: 'en', date: '2026-10-01', title: 'Oil change' };
// What the real helpers return: getArticles('ja') falls back to the English list,
// while the hreflang map lists only the post's real translations (en + es).
vi.mock('@/lib/blog', () => ({
  getArticles: vi.fn(async () => [englishPost]),
  getArticleHreflangMap: vi.fn(async () => ({
    en: 'https://motovault.app/blog/oil-change',
    es: 'https://motovault.app/es/blog/oil-change',
    'x-default': 'https://motovault.app/blog/oil-change',
  })),
}));

const { default: sitemap } = await import('../sitemap');

// The sitemap used to read getArticles(locale) as a translation check, so it
// advertised ja/pl/pt-BR alternates for every post — pages that canonicalize to
// English (2026-11-02 coverage audit). It must list real translations only.
describe('sitemap blog entries', () => {
  it('lists only the hreflang alternates of real translations', async () => {
    const entry = (await sitemap()).find((e) => e.url.endsWith('/blog/oil-change'));
    expect(Object.keys(entry?.alternates?.languages ?? {}).sort()).toEqual([
      'en',
      'es',
      'x-default',
    ]);
  });
});
