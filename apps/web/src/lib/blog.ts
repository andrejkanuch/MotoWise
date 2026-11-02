import { BASE_URL } from './constants';
import type { FaqItem } from './seo/schema';
import {
  fetchArticleBody,
  listBlogCategories,
  listPublishedArticles,
  listPublishedArticlesForArticlePages,
  listTranslatedLocales,
  searchArticleSlugs,
} from './supabase-blog';

export interface Article {
  slug: string;
  /** Content type — guide | maintenance | trip | gear (powers reader type filters). */
  type: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  date: string;
  readingTime: string;
  keywords: string[];
  /** Assigned-keyword slugs (for reader `?keyword=` filtering). */
  keywordSlugs: string[];
  /** Assigned-category slugs (for reader `?category=` filtering). */
  categorySlugs: string[];
  locale: string;
  heroImage?: string;
  heroAlt?: string;
  /** Primary category name (display + related-article matching). */
  category?: string;
  wordCount?: number;
  dateModified?: string;
  /**
   * When `true`, the article asserts spec-bearing maintenance data and must
   * carry the release-blocking "informative only / verify against official
   * sources" disclaimer (see blog article page).
   */
  specData?: boolean;
  /** Optional Q&A pairs surfaced as FAQPage structured data (AI Overviews / PAA). */
  faq?: FaqItem[];
}

/**
 * The fields the /blog index needs per article: what the feed renders and what
 * the reader filters match on. Everything else on {@link Article} (the empty
 * `content`, `faq`, `keywords`, `author`, …) stays server-side so the client
 * props — serialized into the HTML of every /blog locale — carry only the list.
 */
export type BlogListItem = Pick<
  Article,
  | 'slug'
  | 'type'
  | 'title'
  | 'excerpt'
  | 'date'
  | 'readingTime'
  | 'heroImage'
  | 'heroAlt'
  | 'categorySlugs'
  | 'keywordSlugs'
>;

export function toBlogListItem(article: Article): BlogListItem {
  return {
    slug: article.slug,
    type: article.type,
    title: article.title,
    excerpt: article.excerpt,
    date: article.date,
    readingTime: article.readingTime,
    heroImage: article.heroImage,
    heroAlt: article.heroAlt,
    categorySlugs: article.categorySlugs,
    keywordSlugs: article.keywordSlugs,
  };
}

// Locales the blog is authored in (matches BLOG_LOCALES). The 8-locale site
// routing keeps its en-fallback for the rest (plan KTD10).
const ALLOWED_LOCALES = ['en', 'es', 'de', 'fr', 'it'] as const;

function isAllowed(locale: string): locale is (typeof ALLOWED_LOCALES)[number] {
  return ALLOWED_LOCALES.includes(locale as (typeof ALLOWED_LOCALES)[number]);
}

/**
 * Published posts for `locale` (metadata only — bodies load on demand in the
 * detail page). A non-blog locale (e.g. ja/pl) and a blog locale with zero
 * posts both fall back to the full English set — mirrors the former
 * file-pipeline behaviour where a missing/empty locale dir served English.
 */
export async function getArticles(locale: string = 'en'): Promise<Article[]> {
  return articlesWithFallback(listPublishedArticles, locale);
}

/**
 * {@link getArticles} for article pages: same posts, long-lived cache. See
 * `listPublishedArticlesForArticlePages` for why article pages must not read the
 * hourly listing cache.
 */
function getArticlesForArticlePages(locale: string): Promise<Article[]> {
  return articlesWithFallback(listPublishedArticlesForArticlePages, locale);
}

async function articlesWithFallback(
  list: (locale: string) => Promise<Article[]>,
  locale: string,
): Promise<Article[]> {
  const effLocale = isAllowed(locale) ? locale : 'en';
  const articles = await list(effLocale);
  if (articles.length === 0 && effLocale !== 'en') {
    return list('en');
  }
  return articles;
}

/**
 * One article (with body) for the detail page. Existence + locale fallback
 * follow {@link getArticles} exactly (e.g. an en-only slug under `/es` 404s,
 * matching the file pipeline), then the body for the resolved locale is hydrated.
 */
export async function getArticleBySlug(
  slug: string,
  locale: string = 'en',
): Promise<Article | undefined> {
  // A post pg_cron published after the long-lived list was cached is missing from
  // it; only then pay for the hourly list (so only that render gets the 1 h window).
  const meta =
    (await getArticlesForArticlePages(locale)).find((a) => a.slug === slug) ??
    (await getArticles(locale)).find((a) => a.slug === slug);
  if (!meta) return undefined;
  const content = await fetchArticleBody(slug, meta.locale);
  return { ...meta, content: content ?? '' };
}

export async function getArticleSlugs(locale: string = 'en'): Promise<string[]> {
  return (await getArticlesForArticlePages(locale)).map((a) => a.slug);
}

/**
 * Where an article URL that has no post for its locale should go instead of a 404:
 * the English post, as a site-relative path, when one exists. An untranslated post
 * under a blog locale (`/de/blog/<slug>` with no German translation) used to 404,
 * and those legacy URLs were most of Googlebot's 404s (2026-11-02 coverage audit).
 */
export async function getEnglishArticlePath(slug: string, locale: string): Promise<string | null> {
  if (locale === 'en') return null;
  const isSlug = (a: Article) => a.slug === slug;
  // Same two-step lookup as getArticleBySlug, so a post pg_cron just published
  // redirects too instead of 404ing until the long-lived list refreshes.
  const exists =
    (await getArticlesForArticlePages('en')).some(isSlug) || (await getArticles('en')).some(isSlug);
  return exists ? `/blog/${slug}` : null;
}

export function getArticleUrl(slug: string, locale: string): string {
  const prefix = locale === 'en' ? '' : `/${locale}`;
  return `${BASE_URL}${prefix}/blog/${slug}`;
}

/**
 * Canonical URL for a blog article served in `locale`.
 *
 * Self-canonical only when a real translation exists for that locale; otherwise
 * the page renders English fallback content, so it canonicalizes to the English
 * URL (never self-canonicalize fallback content, or Google sees duplicate
 * English text across locale prefixes). Mirrors {@link getArticleHreflangMap}.
 */
export async function getCanonicalArticleUrl(slug: string, locale: string): Promise<string> {
  const hasTranslation =
    locale === 'en' || (isAllowed(locale) && (await listTranslatedLocales(slug)).includes(locale));
  return getArticleUrl(slug, hasTranslation ? locale : 'en');
}

/** hreflang map for a blog article — only locales with a real translation. */
export async function getArticleHreflangMap(slug: string): Promise<Record<string, string>> {
  const translated = new Set(await listTranslatedLocales(slug));
  const languages: Record<string, string> = {};
  for (const locale of ALLOWED_LOCALES) {
    if (translated.has(locale)) {
      const prefix = locale === 'en' ? '' : `/${locale}`;
      languages[locale] = `${BASE_URL}${prefix}/blog/${slug}`;
    }
  }
  if (languages.en) {
    languages['x-default'] = languages.en;
  }
  return languages;
}

/**
 * Reader full-text search → published article slugs in rank order, for `locale`
 * (falls back to en for non-blog locales). Throws on RPC failure so the UI can
 * show the "search unavailable — browse by category" state (plan U8).
 */
export async function searchBlogPostSlugs(query: string, locale: string = 'en'): Promise<string[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const effLocale = isAllowed(locale) ? locale : 'en';
  return searchArticleSlugs(trimmed, effLocale);
}

/** Reader-facing category facets ({slug,name}) for the blog filter UI. */
export async function getBlogCategories(): Promise<{ slug: string; name: string }[]> {
  return listBlogCategories();
}

export async function getRelatedArticles(
  currentSlug: string,
  category: string | undefined,
  locale: string = 'en',
  limit: number = 3,
): Promise<Article[]> {
  const articles = await getArticlesForArticlePages(locale);
  if (!category) return articles.filter((a) => a.slug !== currentSlug).slice(0, limit);
  const sameCategory = articles.filter((a) => a.slug !== currentSlug && a.category === category);
  const others = articles.filter((a) => a.slug !== currentSlug && a.category !== category);
  return [...sameCategory, ...others].slice(0, limit);
}
