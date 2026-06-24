import { beforeEach, describe, expect, it, vi } from 'vitest';

// constants.ts pulls in next-intl navigation, which can't resolve under the
// node test environment — mock it to the bare BASE_URL the helper needs.
vi.mock('@/lib/constants', () => ({ BASE_URL: 'https://motovault.app' }));

// blog.ts now reads from Postgres via supabase-blog; mock the reader so the
// canonical/hreflang LOGIC is what's under test, not live data.
const listTranslatedLocales = vi.fn<(slug: string) => Promise<string[]>>();
vi.mock('../supabase-blog', () => ({
  listPublishedArticles: vi.fn(async () => []),
  fetchArticleBody: vi.fn(async () => null),
  listTranslatedLocales: (slug: string) => listTranslatedLocales(slug),
}));

const BASE_URL = 'https://motovault.app';
const { getCanonicalArticleUrl, getArticleHreflangMap } = await import('../blog');

/**
 * Guards the fix for the GSC "Duplicate without user-selected canonical" bucket:
 * blog pages in a locale without a real translation (ja/pl/pt-BR, or an
 * untranslated slug) serve English fallback content and must canonicalize to the
 * English URL instead of self-canonicalizing.
 */
describe('getCanonicalArticleUrl', () => {
  beforeEach(() => {
    // Default: only an English translation exists for this slug.
    listTranslatedLocales.mockResolvedValue(['en']);
  });

  it('self-canonicalizes English to the unprefixed URL', async () => {
    expect(await getCanonicalArticleUrl('oil-change', 'en')).toBe(`${BASE_URL}/blog/oil-change`);
  });

  it.each([
    'ja',
    'pl',
    'pt-BR',
  ])('canonicalizes untranslated fallback locale %s to the English URL', async (locale) => {
    expect(await getCanonicalArticleUrl('oil-change', locale)).toBe(`${BASE_URL}/blog/oil-change`);
  });

  it('canonicalizes an allowed locale WITHOUT a translation to the English URL', async () => {
    // 'es' is a blog locale, but this slug has no es translation → English fallback.
    expect(await getCanonicalArticleUrl('oil-change', 'es')).toBe(`${BASE_URL}/blog/oil-change`);
  });

  it('self-canonicalizes a real translation to its locale-prefixed URL', async () => {
    listTranslatedLocales.mockResolvedValue(['en', 'es']);
    expect(await getCanonicalArticleUrl('oil-change', 'es')).toBe(`${BASE_URL}/es/blog/oil-change`);
  });
});

describe('getArticleHreflangMap', () => {
  it('includes only locales with a real translation, plus x-default', async () => {
    listTranslatedLocales.mockResolvedValue(['en', 'es', 'de']);
    expect(await getArticleHreflangMap('oil-change')).toEqual({
      en: `${BASE_URL}/blog/oil-change`,
      es: `${BASE_URL}/es/blog/oil-change`,
      de: `${BASE_URL}/de/blog/oil-change`,
      'x-default': `${BASE_URL}/blog/oil-change`,
    });
  });

  it('omits x-default when there is no English translation', async () => {
    listTranslatedLocales.mockResolvedValue(['es']);
    expect(await getArticleHreflangMap('oil-change')).toEqual({
      es: `${BASE_URL}/es/blog/oil-change`,
    });
  });
});
