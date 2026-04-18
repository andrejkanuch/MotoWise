/**
 * Schema.org JSON-LD builders for MotoVault marketing pages.
 *
 * Design notes:
 * - Uses `SoftwareApplication` with `operatingSystem: "iOS, ANDROID"` per
 *   Google's Software App doc (`MobileApplication` is a subtype; both work
 *   for rich results, but `SoftwareApplication` is the more portable choice).
 * - No `WebSite.potentialAction` / `SearchAction` — Google removed sitelinks
 *   search box support in November 2024; emitting it no longer triggers the
 *   feature.
 * - `BreadcrumbList` fragment `@id`s are namespaced per locale
 *   (`#/{locale}/breadcrumb`) to prevent Google from merging locale variants.
 * - `aggregateRating` is NEVER fabricated. If real combined App Store + Play
 *   Store numbers become available, pass them to `buildSoftwareApplication`
 *   and ensure the same number is displayed as visible text on the page.
 * - `FAQPage` is retained for LLM/AI citation (ChatGPT, Perplexity, AI
 *   Overviews parse it). No Google rich-result benefit on commercial sites
 *   post-Aug 2023 but also no penalty.
 *
 * Consumer wraps the `@graph` via `<JsonLdGraph nodes={...}>` in
 * `apps/web/src/components/marketing/json-ld-graph.tsx`, which handles the
 * `<` → `\u003c` escape required to prevent `</script>` breakout.
 */

import { BASE_URL } from '@/lib/constants';

const APP_STORE_URL = 'https://apps.apple.com/us/app/motovault/id6760291360';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.motovault.app';

type JsonLdNode = Record<string, unknown>;

// ---- Entity @ids (stable across all pages) ----
export const SCHEMA_IDS = {
  organization: `${BASE_URL}/#organization`,
  website: `${BASE_URL}/#website`,
  app: `${BASE_URL}/#app`,
} as const;

export function buildOrganization(args: { name: string; description: string }): JsonLdNode {
  return {
    '@type': 'Organization',
    '@id': SCHEMA_IDS.organization,
    name: args.name,
    url: BASE_URL,
    logo: {
      '@type': 'ImageObject',
      url: `${BASE_URL}/icon.png`,
      width: 512,
      height: 512,
    },
    description: args.description,
    foundingDate: '2025',
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'support@motovault.app',
      contactType: 'customer support',
    },
    sameAs: [APP_STORE_URL, PLAY_STORE_URL],
  };
}

export function buildWebSite(args: {
  name: string;
  description: string;
  locale: string;
}): JsonLdNode {
  // Intentionally no `potentialAction` — SearchAction was deprecated in Nov 2024.
  return {
    '@type': 'WebSite',
    '@id': SCHEMA_IDS.website,
    name: args.name,
    url: BASE_URL,
    description: args.description,
    publisher: { '@id': SCHEMA_IDS.organization },
    inLanguage: args.locale,
  };
}

export interface FeatureSchemaContext {
  /** Sub-category label, e.g. "Motorcycle Trip Planning". */
  subCategory: string;
  /** Canonical feature page URL. */
  url: string;
  /** Description to override the app-level description on this page. */
  description: string;
  /** Feature-specific bullet list. */
  featureList: string[];
}

export interface AggregateRatingInput {
  ratingValue: string;
  reviewCount: string;
  bestRating?: string;
  worstRating?: string;
}

export function buildSoftwareApplication(args: {
  name: string;
  description: string;
  feature?: FeatureSchemaContext;
  /**
   * Real combined App Store + Google Play counts ONLY. Must match the number
   * displayed as visible text on the page. Omit if not available.
   */
  aggregateRating?: AggregateRatingInput;
}): JsonLdNode {
  const node: JsonLdNode = {
    '@type': 'SoftwareApplication',
    '@id': SCHEMA_IDS.app,
    name: args.name,
    applicationCategory: 'TravelApplication',
    applicationSubCategory: args.feature?.subCategory ?? 'Motorcycle',
    operatingSystem: 'iOS, ANDROID',
    description: args.feature?.description ?? args.description,
    url: args.feature?.url ?? BASE_URL,
    downloadUrl: [APP_STORE_URL, PLAY_STORE_URL],
    featureList: args.feature?.featureList ?? [
      'Maintenance tracking with smart service reminders',
      'Expense management with cost-per-mile analytics',
      'GPS ride recording with route maps, speed, and elevation',
      'Multi-day motorcycle trip planning with typed waypoints',
      'AI motorcycle diagnostics from photos — no OBD hardware required',
      'Digital garage management for unlimited bikes',
    ],
    offers: [
      { '@type': 'Offer', price: '0', priceCurrency: 'USD', name: 'Free' },
      {
        '@type': 'Offer',
        price: '4.99',
        priceCurrency: 'USD',
        name: 'MotoVault Pro',
        description: 'Unlock all features with a 7-day free trial',
      },
    ],
    publisher: { '@id': SCHEMA_IDS.organization },
  };
  if (args.aggregateRating) {
    node.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: args.aggregateRating.ratingValue,
      reviewCount: args.aggregateRating.reviewCount,
      bestRating: args.aggregateRating.bestRating ?? '5',
      worstRating: args.aggregateRating.worstRating ?? '1',
    };
  }
  return node;
}

/**
 * Reference-only stub — for use on feature/compare pages that should NOT
 * re-declare the full SoftwareApplication. Pages reference the home entity
 * via stable `@id`.
 */
export function refSoftwareApplication(): JsonLdNode {
  return { '@id': SCHEMA_IDS.app };
}

export interface FaqItem {
  question: string;
  answer: string;
}

export function buildFAQPage(items: FaqItem[], localeFragment?: string): JsonLdNode {
  return {
    '@type': 'FAQPage',
    '@id': `${BASE_URL}/#${localeFragment ?? 'faq'}`,
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

export interface Breadcrumb {
  name: string;
  url: string;
}

export function buildBreadcrumbList(
  trail: Breadcrumb[],
  localeKey: string,
  pageKey: string,
): JsonLdNode {
  return {
    '@type': 'BreadcrumbList',
    // Namespaced per locale + page to prevent Google from merging locale
    // variants in SERP breadcrumbs.
    '@id': `${BASE_URL}/#/${localeKey}${pageKey}/breadcrumb`,
    itemListElement: trail.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
}

export interface WebPageOptions {
  url: string;
  name: string;
  description: string;
  locale: string;
  pageKey: string;
  image?: string;
}

/** Feature / marketing sub-page. References the site + app by `@id`. */
export function buildWebPage(opts: WebPageOptions): JsonLdNode {
  const node: JsonLdNode = {
    '@type': 'WebPage',
    '@id': `${BASE_URL}/#/${opts.locale}${opts.pageKey}/page`,
    url: opts.url,
    name: opts.name,
    description: opts.description,
    isPartOf: { '@id': SCHEMA_IDS.website },
    about: { '@id': SCHEMA_IDS.app },
    inLanguage: opts.locale,
  };
  if (opts.image) {
    node.primaryImageOfPage = { '@type': 'ImageObject', url: opts.image };
  }
  return node;
}

export interface ArticleInput {
  url: string;
  headline: string;
  description: string;
  image: string;
  datePublished: string;
  dateModified: string;
  authorName: string;
  authorUrl?: string;
  locale: string;
  slug: string;
}

export function buildArticle(article: ArticleInput): JsonLdNode {
  return {
    '@type': 'Article',
    '@id': `${BASE_URL}/#/${article.locale}/blog/${article.slug}/article`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': article.url },
    headline: article.headline,
    description: article.description,
    image: [article.image],
    datePublished: article.datePublished,
    dateModified: article.dateModified,
    author: {
      '@type': 'Person',
      name: article.authorName,
      ...(article.authorUrl ? { url: article.authorUrl } : {}),
    },
    publisher: { '@id': SCHEMA_IDS.organization },
    inLanguage: article.locale,
    isPartOf: { '@id': SCHEMA_IDS.website },
  };
}

export function buildTouristAttraction(args: {
  name: string;
  description: string;
  url: string;
  latitude: number;
  longitude: number;
  countryName: string;
  regionName: string;
}): JsonLdNode {
  return {
    '@type': 'TouristAttraction',
    name: args.name,
    description: args.description,
    url: args.url,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: args.latitude,
      longitude: args.longitude,
    },
    address: {
      '@type': 'PostalAddress',
      addressRegion: args.regionName,
      addressCountry: args.countryName,
    },
    touristType: 'Motorcyclist',
    isAccessibleForFree: true,
  };
}

export function buildRouteAggregateRating(args: {
  itemName: string;
  ratingValue: number;
  ratingCount: number;
  url: string;
}): JsonLdNode {
  return {
    '@type': 'TouristAttraction',
    name: args.itemName,
    url: args.url,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: args.ratingValue.toFixed(1),
      reviewCount: String(args.ratingCount),
      bestRating: '5',
      worstRating: '1',
    },
  };
}

/** Build a full `@graph` array for consumption by `<JsonLdGraph>`. */
export function buildGraph(...nodes: (JsonLdNode | false | null | undefined)[]): JsonLdNode[] {
  return nodes.filter(Boolean) as JsonLdNode[];
}
