import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Article } from '../blog';

vi.mock('@/lib/constants', () => ({ BASE_URL: 'https://motovault.app' }));

// blog.ts reads from Postgres via supabase-blog; mock the reader so the
// list/fallback/body-composition LOGIC is under test (not live data).
const listPublishedArticles = vi.fn<(locale: string) => Promise<Article[]>>();
const listPublishedArticlesForArticlePages = vi.fn<(locale: string) => Promise<Article[]>>();
const fetchArticleBody = vi.fn<(slug: string, locale: string) => Promise<string | null>>();
vi.mock('../supabase-blog', () => ({
  listPublishedArticles: (locale: string) => listPublishedArticles(locale),
  listPublishedArticlesForArticlePages: (locale: string) =>
    listPublishedArticlesForArticlePages(locale),
  fetchArticleBody: (slug: string, locale: string) => fetchArticleBody(slug, locale),
  listTranslatedLocales: vi.fn(async () => ['en']),
}));

const { getArticles, getArticleBySlug } = await import('../blog');

function article(over: Partial<Article> = {}): Article {
  return {
    slug: 'a',
    type: 'guide',
    title: 'A',
    excerpt: '',
    content: '',
    author: 'MotoVault Team',
    date: '2026-01-01T00:00:00.000Z',
    readingTime: '5',
    keywords: [],
    keywordSlugs: [],
    categorySlugs: [],
    locale: 'en',
    specData: false,
    ...over,
  };
}

beforeEach(() => {
  listPublishedArticles.mockReset();
  listPublishedArticlesForArticlePages.mockReset();
  fetchArticleBody.mockReset();
});

describe('getArticles locale fallback', () => {
  it('returns the locale set when the blog locale has posts', async () => {
    listPublishedArticles.mockResolvedValueOnce([article({ slug: 'es-post', locale: 'es' })]);
    const out = await getArticles('es');
    expect(out.map((a) => a.slug)).toEqual(['es-post']);
    expect(listPublishedArticles).toHaveBeenCalledWith('es');
  });

  it('falls back to English when a blog locale has zero posts', async () => {
    listPublishedArticles
      .mockResolvedValueOnce([]) // es: empty
      .mockResolvedValueOnce([article({ slug: 'en-post' })]); // en fallback
    const out = await getArticles('it');
    expect(out.map((a) => a.slug)).toEqual(['en-post']);
  });

  it('treats a non-blog locale (ja) as English directly', async () => {
    listPublishedArticles.mockResolvedValueOnce([article({ slug: 'en-post' })]);
    await getArticles('ja');
    expect(listPublishedArticles).toHaveBeenCalledWith('en');
  });
});

describe('getArticleBySlug', () => {
  it('hydrates the body for the resolved locale and carries faq through', async () => {
    listPublishedArticlesForArticlePages.mockResolvedValueOnce([
      article({ slug: 'oil', faq: [{ question: 'Q', answer: 'A' }] }),
    ]);
    fetchArticleBody.mockResolvedValueOnce('## Body');
    const found = await getArticleBySlug('oil', 'en');
    expect(found?.content).toBe('## Body');
    expect(found?.faq).toEqual([{ question: 'Q', answer: 'A' }]);
    expect(fetchArticleBody).toHaveBeenCalledWith('oil', 'en');
  });

  it('reads only the long-lived list when it has the slug', async () => {
    listPublishedArticlesForArticlePages.mockResolvedValueOnce([article({ slug: 'oil' })]);
    await getArticleBySlug('oil', 'en');
    expect(listPublishedArticles).not.toHaveBeenCalled();
  });

  it('falls back to the hourly list for a post published after the long-lived list was cached', async () => {
    listPublishedArticlesForArticlePages.mockResolvedValueOnce([article({ slug: 'old' })]);
    listPublishedArticles.mockResolvedValueOnce([
      article({ slug: 'new' }),
      article({ slug: 'old' }),
    ]);
    fetchArticleBody.mockResolvedValueOnce('## New');
    const found = await getArticleBySlug('new', 'en');
    expect(found?.slug).toBe('new');
    expect(found?.content).toBe('## New');
  });

  it('returns undefined for a slug not in the locale set (e.g. en-only slug under es)', async () => {
    listPublishedArticlesForArticlePages.mockResolvedValueOnce([
      article({ slug: 'es-only', locale: 'es' }),
    ]);
    listPublishedArticles.mockResolvedValueOnce([article({ slug: 'es-only', locale: 'es' })]);
    expect(await getArticleBySlug('oil', 'es')).toBeUndefined();
    expect(fetchArticleBody).not.toHaveBeenCalled();
  });
});
