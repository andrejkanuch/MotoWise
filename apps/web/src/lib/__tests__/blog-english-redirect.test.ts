import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/constants', () => ({ BASE_URL: 'https://motovault.app' }));

const englishPost = { slug: 'oil-change', locale: 'en', title: 'Oil change' };
vi.mock('../supabase-blog', () => ({
  listPublishedArticles: vi.fn(async () => []),
  listPublishedArticlesForArticlePages: vi.fn(async (locale: string) =>
    locale === 'en' ? [englishPost] : [],
  ),
  fetchArticleBody: vi.fn(async () => null),
  listTranslatedLocales: vi.fn(async () => ['en']),
}));

const { getEnglishArticlePath } = await import('../blog');

// An untranslated post under a blog locale 404'd and Google kept recrawling those
// URLs; the article page now 308s them to the English post via this helper.
describe('getEnglishArticlePath', () => {
  it.each(['de', 'es', 'fr', 'it'])('sends an untranslated %s post to English', async (locale) => {
    expect(await getEnglishArticlePath('oil-change', locale)).toBe('/blog/oil-change');
  });

  it('keeps a 404 for a slug with no English post', async () => {
    expect(await getEnglishArticlePath('no-such-post', 'de')).toBeNull();
  });

  it('never redirects the English URL to itself', async () => {
    expect(await getEnglishArticlePath('oil-change', 'en')).toBeNull();
  });
});
