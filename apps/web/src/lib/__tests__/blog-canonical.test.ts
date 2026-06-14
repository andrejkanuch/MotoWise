import { describe, expect, it, vi } from 'vitest';

// constants.ts pulls in next-intl navigation, which can't resolve under the
// node test environment — mock it to the bare BASE_URL the helper needs.
vi.mock('@/lib/constants', () => ({
  BASE_URL: 'https://motovault.app',
}));

const BASE_URL = 'https://motovault.app';

const { getArticleSlugs, getCanonicalArticleUrl } = await import('../blog');

/**
 * Guards the fix for the GSC "Duplicate without user-selected canonical" bucket:
 * blog pages in locales without a real MDX translation (ja/pl/pt-BR, or any
 * untranslated slug) serve English fallback content and must canonicalize to the
 * English URL instead of self-canonicalizing.
 */
describe('getCanonicalArticleUrl', () => {
  const slug = getArticleSlugs('en')[0];

  it('has at least one English article to test against', () => {
    expect(slug).toBeTruthy();
  });

  it('self-canonicalizes English to the unprefixed URL', () => {
    expect(getCanonicalArticleUrl(slug, 'en')).toBe(`${BASE_URL}/blog/${slug}`);
  });

  it.each([
    'ja',
    'pl',
    'pt-BR',
  ])('canonicalizes untranslated fallback locale %s to the English URL', (locale) => {
    expect(getCanonicalArticleUrl(slug, locale)).toBe(`${BASE_URL}/blog/${slug}`);
  });
});
