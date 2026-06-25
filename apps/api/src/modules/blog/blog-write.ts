import { type BlogTypeData, stripMdxToText, wordCount } from '@motovault/types';

/**
 * Pure write-side mappers (plan U5): camelCase contract -> snake_case DB rows.
 * Kept pure + exported so they're unit-testable without a DB.
 */

/** Map the validated `typeData` union to its per-type table + row. */
export function typeDataToRow(
  postId: string,
  typeData: BlogTypeData,
): { table: string; row: Record<string, unknown> } {
  switch (typeData.type) {
    case 'guide':
      return {
        table: 'blog_post_guide',
        row: {
          post_id: postId,
          difficulty: typeData.difficulty ?? null,
          meta: typeData.meta ?? {},
        },
      };
    case 'maintenance':
      return {
        table: 'blog_post_maintenance',
        row: {
          post_id: postId,
          make: typeData.make ?? null,
          model: typeData.model ?? null,
          variant: typeData.variant ?? null,
          dataset_models: typeData.datasetModels ?? [],
          applicable_models: typeData.applicableModels ?? [],
          meta: typeData.meta ?? {},
        },
      };
    case 'trip':
      return {
        table: 'blog_post_trip',
        row: {
          post_id: postId,
          distance_km: typeData.distanceKm ?? null,
          country_codes: typeData.countryCodes ?? [],
          route_gpx: typeData.routeGpx ?? null,
          meta: typeData.meta ?? {},
        },
      };
    case 'gear':
      return {
        table: 'blog_post_gear',
        row: {
          post_id: postId,
          brand: typeData.brand ?? null,
          model: typeData.model ?? null,
          rating: typeData.rating ?? null,
          price_eur: typeData.priceEur ?? null,
          verdict: typeData.verdict ?? null,
          meta: typeData.meta ?? {},
        },
      };
  }
}

export interface TranslationInputShape {
  locale: string;
  title: string;
  excerpt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  bodyRaw?: string | null;
  faq?: unknown;
  readingTime?: string | null;
}

/** Build a translation row, deriving body_text via the shared helper and setting keyword_text. */
export function translationToRow(
  postId: string,
  t: TranslationInputShape,
  keywordText: string,
): Record<string, unknown> {
  const bodyRaw = t.bodyRaw ?? '';
  const bodyText = stripMdxToText(bodyRaw);
  return {
    post_id: postId,
    locale: t.locale,
    title: t.title,
    excerpt: t.excerpt ?? null,
    seo_title: t.seoTitle ?? null,
    seo_description: t.seoDescription ?? null,
    body_raw: bodyRaw,
    body_text: bodyText,
    keyword_text: keywordText,
    faq: t.faq ?? [],
    reading_time: t.readingTime ?? null,
    word_count: wordCount(bodyText),
  };
}
