import { describe, expect, it } from 'vitest';
import type { Article } from '@/lib/blog';
import { applyBlogFilters } from '@/lib/blog-filters';

function article(over: Partial<Article> & { slug: string }): Article {
  return {
    title: over.slug,
    type: 'guide',
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

const oil = article({
  slug: 'oil',
  type: 'guide',
  categorySlugs: ['maintenance'],
  keywordSlugs: ['oil'],
});
const trip = article({ slug: 'alps', type: 'trip', categorySlugs: ['trips'] });
const gear = article({
  slug: 'helmet',
  type: 'gear',
  categorySlugs: ['gear'],
  keywordSlugs: ['oil'],
});
const all = [oil, trip, gear];

describe('applyBlogFilters', () => {
  it('returns the full list when nothing is active', () => {
    expect(applyBlogFilters(all, {}).map((a) => a.slug)).toEqual(['oil', 'alps', 'helmet']);
  });

  it('narrows to search slugs and preserves RPC rank order', () => {
    expect(applyBlogFilters(all, { searchSlugs: ['helmet', 'oil'] }).map((a) => a.slug)).toEqual([
      'helmet',
      'oil',
    ]);
  });

  it('filters by type', () => {
    expect(applyBlogFilters(all, { type: 'trip' }).map((a) => a.slug)).toEqual(['alps']);
  });

  it('filters by category', () => {
    expect(applyBlogFilters(all, { category: 'gear' }).map((a) => a.slug)).toEqual(['helmet']);
  });

  it('combines a query with a category filter (narrows the search results)', () => {
    // search returns oil+helmet; category 'gear' keeps only helmet.
    const out = applyBlogFilters(all, { searchSlugs: ['oil', 'helmet'], category: 'gear' });
    expect(out.map((a) => a.slug)).toEqual(['helmet']);
  });

  it('filters by keyword slug', () => {
    expect(applyBlogFilters(all, { keyword: 'oil' }).map((a) => a.slug)).toEqual(['oil', 'helmet']);
  });

  it('yields an empty list when filters match nothing', () => {
    expect(applyBlogFilters(all, { type: 'maintenance' })).toEqual([]);
  });
});
