import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/constants', () => ({ BASE_URL: 'https://motovault.app' }));

const post = (slug: string, locale: string) => ({ slug, locale, title: slug });
// Each blog locale has posts of its own (so no locale falls back to the English
// list), just not `oil-change`; `fresh-post` is only in the hourly English list,
// as right after pg_cron publishes it.
const longLived = (locale: string) =>
  locale === 'en' ? [post('oil-change', 'en')] : [post('translated-post', locale)];
const hourly = (locale: string) =>
  locale === 'en' ? [...longLived('en'), post('fresh-post', 'en')] : longLived(locale);
vi.mock('../supabase-blog', () => ({
  listPublishedArticles: vi.fn(async (locale: string) => hourly(locale)),
  listPublishedArticlesForArticlePages: vi.fn(async (locale: string) => longLived(locale)),
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

  it('sends a post published after the long-lived list was cached', async () => {
    expect(await getEnglishArticlePath('fresh-post', 'de')).toBe('/blog/fresh-post');
  });

  it('keeps a 404 for a slug with no English post', async () => {
    expect(await getEnglishArticlePath('no-such-post', 'de')).toBeNull();
  });

  it('never redirects the English URL to itself', async () => {
    expect(await getEnglishArticlePath('oil-change', 'en')).toBeNull();
  });
});
