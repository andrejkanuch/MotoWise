import * as Sentry from '@sentry/nextjs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { CACHE_TAGS } from '@/lib/seo/cache-tags';
import type { Article } from './blog';
import type { FaqItem } from './seo/schema';

/**
 * Cookie-less anon reader for the public blog (plan U7 / KTD4 / R8).
 *
 * Uses the anon key with `persistSession:false` and NO cookie adapter — so blog
 * reads never touch `cookies()` and the routes stay statically generatable (the
 * PPR/next-intl dynamic-render trap). Public-read RLS + an explicit
 * `status='published'` filter (defense-in-depth) gate what anon can see; drafts
 * and scheduled posts are invisible here.
 *
 * Never use the service-role key in this file — it would bypass RLS on a path
 * that bundles into the public build.
 *
 * Built lazily (not at module scope): `createClient('')` throws "supabaseUrl is
 * required", so an eager client crashes `next build` page-data collection in any
 * environment without `NEXT_PUBLIC_SUPABASE_*` set (CI, env-less builds). Lazy +
 * null-on-missing-env lets the module import safely and the reads degrade to
 * empty instead of taking down the whole build.
 */
let _client: SupabaseClient | null = null;
let _warnedMissingEnv = false;

function blogClient(): SupabaseClient | null {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    if (!_warnedMissingEnv) {
      _warnedMissingEnv = true;
      console.error(
        '[supabase-blog] NEXT_PUBLIC_SUPABASE_URL/ANON_KEY missing — blog reads disabled',
      );
    }
    return null;
  }
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

// ── Raw PostgREST row shapes ──
type RawTaxonomy = { name: string; slug: string };
type RawCategoryLink = {
  is_primary: boolean | null;
  categories: RawTaxonomy | RawTaxonomy[] | null;
};
type RawKeywordLink = { keywords: RawTaxonomy | RawTaxonomy[] | null };
type RawTranslation = {
  locale: string;
  title: string;
  excerpt: string | null;
  reading_time: string | null;
  word_count: number | null;
  faq: unknown;
};
type RawListRow = {
  slug: string;
  type: string;
  author: string | null;
  cover_image: string | null;
  cover_alt: string | null;
  spec_data: boolean;
  published_at: string | null;
  updated_at: string | null;
  blog_post_translations: RawTranslation[] | null;
  blog_post_categories: RawCategoryLink[] | null;
  blog_post_keywords: RawKeywordLink[] | null;
};

function firstOf<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

/** YAML/JSON can coerce `answer: yes` → boolean; require real non-empty strings. */
function sanitizeFaq(value: unknown): FaqItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((f): f is FaqItem => {
    const item = f as Partial<FaqItem>;
    return (
      typeof item?.question === 'string' &&
      typeof item?.answer === 'string' &&
      item.question.trim() !== '' &&
      item.answer.trim() !== ''
    );
  });
  return items.length > 0 ? items : undefined;
}

/** Map a joined base+translation row to the public `Article` shape (no body). */
function toArticle(row: RawListRow, locale: string): Article {
  const tr = (row.blog_post_translations ?? [])[0];
  const categoryLinks = row.blog_post_categories ?? [];
  const primary = categoryLinks.find((c) => c.is_primary) ?? categoryLinks[0];
  const categoryName = primary ? firstOf(primary.categories)?.name : undefined;
  const categorySlugs = categoryLinks
    .map((c) => firstOf(c.categories)?.slug)
    .filter((s): s is string => Boolean(s));
  const keywordTaxonomy = (row.blog_post_keywords ?? [])
    .map((k) => firstOf(k.keywords))
    .filter((k): k is RawTaxonomy => k != null);
  return {
    slug: row.slug,
    type: row.type,
    title: tr?.title ?? '',
    excerpt: tr?.excerpt ?? '',
    content: '', // bodies are fetched on demand (detail page) via fetchArticleBody
    author: row.author ?? 'MotoVault Team',
    date: row.published_at ?? '',
    readingTime: tr?.reading_time ?? '5',
    keywords: keywordTaxonomy.map((k) => k.name),
    keywordSlugs: keywordTaxonomy.map((k) => k.slug),
    categorySlugs,
    locale,
    heroImage: row.cover_image ?? undefined,
    heroAlt: row.cover_alt ?? undefined,
    category: categoryName ?? undefined,
    wordCount: tr?.word_count ?? undefined,
    dateModified: row.updated_at ?? undefined,
    specData: row.spec_data === true,
    faq: sanitizeFaq(tr?.faq),
  };
}

const LIST_SELECT = `
  slug, type, author, cover_image, cover_alt, spec_data, published_at, updated_at,
  blog_post_translations!inner(locale, title, excerpt, reading_time, word_count, faq),
  blog_post_categories(is_primary, categories(name, slug)),
  blog_post_keywords(keywords(name, slug))
`;

/**
 * Published posts that have a translation in `locale`, newest first, WITHOUT
 * bodies (listings/sitemap/feed/related). Cached + tagged `blog` so an API
 * publish (`revalidateTag('blog')`) busts it.
 */
export const listPublishedArticles = unstable_cache(
  async (locale: string): Promise<Article[]> => {
    const supabase = blogClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('blog_posts')
      .select(LIST_SELECT)
      .eq('status', 'published')
      .eq('blog_post_translations.locale', locale)
      .order('published_at', { ascending: false });
    if (error) {
      // Surface a monitoring signal — an empty array would otherwise render a blank
      // blog that's indistinguishable from "no posts yet" / a DB outage.
      Sentry.captureException(error, {
        tags: { area: 'blog', op: 'listPublishedArticles', locale },
      });
      console.error(`[supabase-blog] listPublishedArticles(${locale}) failed: ${error.message}`);
      return [];
    }
    return ((data ?? []) as unknown as RawListRow[]).map((row) => toArticle(row, locale));
  },
  ['blog-list'],
  // Shorter window than the rarely-changing detail/taxonomy reads: pg_cron flips
  // scheduled -> published in SQL with no on-demand revalidation, so bound how long
  // a freshly-published scheduled post can be missing from the listing.
  { revalidate: 3600, tags: [CACHE_TAGS.blog] },
);

/** Body MDX (`body_raw`) for one post in one locale. Cached + tagged `blog`. */
export const fetchArticleBody = unstable_cache(
  async (slug: string, locale: string): Promise<string | null> => {
    const supabase = blogClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('blog_posts')
      .select('blog_post_translations!inner(body_raw)')
      .eq('status', 'published')
      .eq('slug', slug)
      .eq('blog_post_translations.locale', locale)
      .maybeSingle();
    if (error) {
      Sentry.captureException(error, { tags: { area: 'blog', op: 'fetchArticleBody', slug } });
      console.error(`[supabase-blog] fetchArticleBody(${slug}/${locale}) failed: ${error.message}`);
      return null;
    }
    const tr = firstOf(
      (data as { blog_post_translations: { body_raw: string }[] | null } | null)
        ?.blog_post_translations,
    );
    return tr?.body_raw ?? null;
  },
  ['blog-body'],
  { revalidate: 604800, tags: [CACHE_TAGS.blog] },
);

/**
 * Full-text reader search via the `search_blog_posts` RPC (FTS + trigram +
 * recency, published-only). Returns post slugs in rank order. NOT cached —
 * search is inherently dynamic (per-query) and runs only when a user submits a
 * query, so the base listing stays statically generated (R8). Throws on RPC
 * error so the caller can surface the "search unavailable" state.
 */
export async function searchArticleSlugs(query: string, locale: string): Promise<string[]> {
  const supabase = blogClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('search_blog_posts', { query, loc: locale });
  if (error) throw new Error(`search_blog_posts failed: ${error.message}`);
  const rows = (data ?? []) as { post_id: string; slug?: string | null }[];
  if (rows.length === 0) return [];
  // Migration 00158: the RPC returns slug directly (rank order preserved), so no
  // hydration round-trip is needed.
  if (rows.every((r) => typeof r.slug === 'string')) {
    return rows.map((r) => r.slug as string);
  }
  // Fallback for environments where 00158 isn't applied yet (RPC returns post_id only):
  // hydrate ids -> slugs, preserving the RPC's rank order.
  const ids = rows.map((r) => r.post_id);
  const { data: hydrated, error: rowsErr } = await supabase
    .from('blog_posts')
    .select('id, slug')
    .eq('status', 'published')
    .in('id', ids);
  if (rowsErr) throw new Error(`search hydrate failed: ${rowsErr.message}`);
  const slugById = new Map(
    ((hydrated ?? []) as { id: string; slug: string }[]).map((r) => [r.id, r.slug]),
  );
  return ids.map((id) => slugById.get(id)).filter((s): s is string => Boolean(s));
}

/** Categories used as reader-facing filter facets ({slug,name}). Cached + tagged `blog`. */
export const listBlogCategories = unstable_cache(
  async (): Promise<{ slug: string; name: string }[]> => {
    const supabase = blogClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('categories')
      .select('slug, name')
      .order('name', { ascending: true });
    if (error) {
      Sentry.captureException(error, { tags: { area: 'blog', op: 'listBlogCategories' } });
      console.error(`[supabase-blog] listBlogCategories failed: ${error.message}`);
      return [];
    }
    return (data ?? []) as { slug: string; name: string }[];
  },
  ['blog-categories'],
  { revalidate: 604800, tags: [CACHE_TAGS.blog] },
);

/** Locales with a real published translation for `slug` (drives hreflang + canonical). */
export const listTranslatedLocales = unstable_cache(
  async (slug: string): Promise<string[]> => {
    const supabase = blogClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('blog_posts')
      .select('blog_post_translations(locale)')
      .eq('status', 'published')
      .eq('slug', slug)
      .maybeSingle();
    if (error) {
      Sentry.captureException(error, { tags: { area: 'blog', op: 'listTranslatedLocales', slug } });
      console.error(`[supabase-blog] listTranslatedLocales(${slug}) failed: ${error.message}`);
      return [];
    }
    const rows =
      (data as { blog_post_translations: { locale: string }[] | null } | null)
        ?.blog_post_translations ?? [];
    return rows.map((r) => r.locale);
  },
  ['blog-translated-locales'],
  { revalidate: 604800, tags: [CACHE_TAGS.blog] },
);
