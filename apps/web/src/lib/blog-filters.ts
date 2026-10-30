import type { BlogListItem } from './blog';

/** What a filter needs from an article; the full `Article` and the list item both satisfy it. */
type Filterable = Pick<BlogListItem, 'slug' | 'type' | 'categorySlugs' | 'keywordSlugs'>;

/**
 * Pure filter+rank over the in-memory article list (plan U8). When `searchSlugs`
 * is provided (a query ran), results are narrowed to those slugs and ordered by
 * the RPC rank; type/category/keyword further narrow. Lives in its own module so
 * it's unit-testable without dragging the `'use client'` search component (and
 * `next/navigation`) into the node test environment.
 */
export function applyBlogFilters<T extends Filterable>(
  articles: T[],
  opts: { searchSlugs?: string[] | null; type?: string; category?: string; keyword?: string },
): T[] {
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

/**
 * Reading time as "{n} {label}". Stored values arrive as "8", "8 min" or
 * "8 min read"; only the figure is kept so the locale's own label (e.g.
 * "min read", "Min. Lesezeit") is the one and only unit in the line.
 */
export function formatReadingTime(value: string, label: string): string {
  const minutes = /\d+/.exec(value)?.[0];
  return minutes ? `${minutes} ${label}` : value.trim();
}

/** Lower-case words that stay upper-case when a tag slug is humanised. */
const TAG_ACRONYMS: Readonly<Record<string, string>> = {
  abs: 'ABS',
  diy: 'DIY',
  gpx: 'GPX',
  ev: 'EV',
};

/** "brand-guide" → "Brand guide", "diy" → "DIY": sentence case, never raw slugs. */
export function humaniseTag(value: string): string {
  const words = value.trim().replace(/[-_]+/g, ' ').toLowerCase().split(/\s+/).filter(Boolean);
  return words
    .map(
      (word, i) => TAG_ACRONYMS[word] ?? (i === 0 ? word[0].toUpperCase() + word.slice(1) : word),
    )
    .join(' ');
}

/**
 * Drops facets whose humanised label repeats one already shown, compared
 * case-insensitively and ignoring a plural "s" ("guides" repeats "Guide");
 * `taken` holds labels rendered before these (the type chips).
 */
export function dedupeFacets<T extends { name: string }>(
  facets: readonly T[],
  taken: readonly string[] = [],
): T[] {
  const facetKey = (label: string) => label.toLowerCase().replace(/s$/, '');
  const seen = new Set(taken.map(facetKey));
  return facets.filter((facet) => {
    const key = facetKey(humaniseTag(facet.name));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
