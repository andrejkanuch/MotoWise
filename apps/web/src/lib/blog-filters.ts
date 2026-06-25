import type { Article } from './blog';

/**
 * Pure filter+rank over the in-memory article list (plan U8). When `searchSlugs`
 * is provided (a query ran), results are narrowed to those slugs and ordered by
 * the RPC rank; type/category/keyword further narrow. Lives in its own module so
 * it's unit-testable without dragging the `'use client'` search component (and
 * `next/navigation`) into the node test environment.
 */
export function applyBlogFilters(
  articles: Article[],
  opts: { searchSlugs?: string[] | null; type?: string; category?: string; keyword?: string },
): Article[] {
  let list = articles;
  if (opts.searchSlugs) {
    const rank = new Map(opts.searchSlugs.map((slug, i) => [slug, i]));
    list = articles
      .filter((a) => rank.has(a.slug))
      .sort((a, b) => (rank.get(a.slug) ?? 0) - (rank.get(b.slug) ?? 0));
  }
  if (opts.type) list = list.filter((a) => a.type === opts.type);
  if (opts.category) list = list.filter((a) => a.categorySlugs.includes(opts.category as string));
  if (opts.keyword) list = list.filter((a) => a.keywordSlugs.includes(opts.keyword as string));
  return list;
}
