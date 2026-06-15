import { describe, expect, it, vi } from 'vitest';

// constants.ts pulls in next-intl navigation, which can't resolve under the
// node test environment — mock it to the bare BASE_URL the helper needs.
vi.mock('@/lib/constants', () => ({
  BASE_URL: 'https://motovault.app',
}));

const { getArticleBySlug } = await import('../blog');

/**
 * Guards the FAQ pipeline: `faq` frontmatter must parse into structured Q&A
 * pairs (rendered as both FAQPage JSON-LD and a visible section). The
 * maintenance cluster relies on this for AI Overview / featured-snippet capture.
 */
describe('blog faq frontmatter', () => {
  const CLUSTER = [
    'yamaha-mt-r-series-maintenance-schedule',
    'harley-davidson-maintenance-schedule-costs',
    'bmw-gs-r-maintenance-schedule',
    'ducati-monster-panigale-maintenance-schedule',
    'kawasaki-ninja-z-maintenance-schedule',
    'honda-cbr-cb-maintenance-schedule',
    'motorcycle-maintenance-schedules-by-brand',
  ];

  it.each(CLUSTER)('%s parses 5+ well-formed FAQ items', (slug) => {
    const article = getArticleBySlug(slug, 'en');
    expect(article).toBeDefined();
    expect(article?.faq?.length ?? 0).toBeGreaterThanOrEqual(5);
    for (const item of article?.faq ?? []) {
      expect(item.question.trim()).not.toBe('');
      expect(item.answer.trim()).not.toBe('');
    }
  });

  it('leaves faq undefined when frontmatter has none', () => {
    const article = getArticleBySlug('best-motorcycle-app-for-beginners-2026', 'en');
    expect(article).toBeDefined();
    expect(article?.faq).toBeUndefined();
  });
});
