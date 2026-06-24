import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Article } from '../blog';

vi.mock('@/lib/constants', () => ({ BASE_URL: 'https://motovault.app' }));

// blog.ts reads from Postgres via supabase-blog; mock the reader so the
// list/fallback/body-composition LOGIC is under test (not live data).
const listPublishedArticles = vi.fn<(locale: string) => Promise<Article[]>>();
const fetchArticleBody = vi.fn<(slug: string, locale: string) => Promise<string | null>>();
vi.mock('../supabase-blog', () => ({
  listPublishedArticles: (locale: string) => listPublishedArticles(locale),
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
    listPublishedArticles.mockResolvedValueOnce([
      article({ slug: 'oil', faq: [{ question: 'Q', answer: 'A' }] }),
    ]);
    fetchArticleBody.mockResolvedValueOnce('## Body');
    const found = await getArticleBySlug('oil', 'en');
    expect(found?.content).toBe('## Body');
    expect(found?.faq).toEqual([{ question: 'Q', answer: 'A' }]);
    expect(fetchArticleBody).toHaveBeenCalledWith('oil', 'en');
  });

  it('returns undefined for a slug not in the locale set (e.g. en-only slug under es)', async () => {
    listPublishedArticles.mockResolvedValueOnce([article({ slug: 'es-only', locale: 'es' })]);
    expect(await getArticleBySlug('oil', 'es')).toBeUndefined();
    expect(fetchArticleBody).not.toHaveBeenCalled();
  });
});
