// -------------------------------------------------------------------
// Intent-matched blog CTA logic (pure, dependency-free)
// -------------------------------------------------------------------
// Picks the download-CTA "angle" for an article and extracts the bike model
// from its title, so the mid-article CTA speaks to what the reader came for.
// No posthog / React import — safe in Server Components and unit tests.
//
// Positioning guardrails (feedback_ai_diag_not_hero): expenses is the #1 paid
// feature, maintenance #2; diagnostic content is framed as "service history /
// health log", never AI-led. See docs/SEO-Conversion-Plan-2026-07-15.md.
// -------------------------------------------------------------------

/** Which value proposition the CTA leads with. */
export const CtaAngle = {
  /** "never miss a service" — reminders (article type = maintenance). */
  Maintenance: 'maintenance',
  /** "see your true cost per year" — the expense tracker, #1 paid feature. */
  Cost: 'cost',
  /** "keep a service history" — guides/diagnostics, framed as a health log. */
  Guide: 'guide',
} as const;
export type CtaAngle = (typeof CtaAngle)[keyof typeof CtaAngle];

/** Screenshot shown beside each angle's copy (all 1206×2622 phone captures). */
export const CTA_SCREENSHOT: Record<CtaAngle, string> = {
  [CtaAngle.Maintenance]: '/images/features/maintenance.png',
  [CtaAngle.Cost]: '/images/features/expenses.png',
  [CtaAngle.Guide]: '/images/features/maintenance.png',
};

/** Article type → default angle. Cost intent overrides this (see resolveCtaAngle). */
const ANGLE_BY_TYPE: Record<string, CtaAngle> = {
  maintenance: CtaAngle.Maintenance,
  guide: CtaAngle.Guide,
  trip: CtaAngle.Guide,
  gear: CtaAngle.Guide,
};

type AngleInput = {
  type: string;
  slug: string;
  keywords?: string[];
  keywordSlugs?: string[];
};

/**
 * Resolve the CTA angle. Cost intent (a "*cost*" slug/keyword) wins over type —
 * a "maintenance cost per year" article is really an expense-tracker prospect —
 * otherwise the article's type decides, defaulting to the service-history angle.
 */
export function resolveCtaAngle(article: AngleInput): CtaAngle {
  const haystack = [article.slug, ...(article.keywords ?? []), ...(article.keywordSlugs ?? [])]
    .join(' ')
    .toLowerCase();
  if (haystack.includes('cost')) return CtaAngle.Cost;
  return ANGLE_BY_TYPE[article.type] ?? CtaAngle.Guide;
}

// Brands whose name reliably leads a title (top motorcycle makes in our markets).
// Longest-first so "Harley-Davidson" / "Royal Enfield" match before a substring.
const BRANDS = [
  'Harley-Davidson',
  'Royal Enfield',
  'Moto Guzzi',
  'Yamaha',
  'Honda',
  'Kawasaki',
  'Suzuki',
  'Ducati',
  'Triumph',
  'Aprilia',
  'Husqvarna',
  'Indian',
  'BMW',
  'KTM',
  'Zero',
] as const;

// Topic words that follow the model in a title — the model is everything before
// the first one of these.
const STOP_WORDS = new Set([
  'maintenance',
  'service',
  'oil',
  'cost',
  'costs',
  'review',
  'guide',
  'specs',
  'problems',
  'schedule',
  'repair',
  'chain',
  'tire',
  'tires',
  'brake',
  'brakes',
  'valve',
  'reliability',
]);

/**
 * Best-effort {make, model} from an article title, e.g.
 * "Yamaha MT-07 Maintenance Schedule (2021)" → { make: 'Yamaha', model: 'MT-07' }.
 * `model` is '' when a brand leads but no model tokens follow. Returns null when
 * no known brand leads the title (generic articles). Powers both the CTA copy
 * and the make/model tags carried into the Play install referrer (plan P2.1).
 */
export function extractMakeModel(title: string): { make: string; model: string } | null {
  const cleaned = title.replace(/\([^)]*\)/g, ' ').trim();
  const brand = BRANDS.find((b) => cleaned.toLowerCase().startsWith(b.toLowerCase()));
  if (!brand) return null;

  const rest = cleaned.slice(brand.length).trim();
  const modelTokens: string[] = [];
  for (const token of rest.split(/\s+/)) {
    const bare = token.replace(/[.,:;/]+$/, '');
    if (!bare || STOP_WORDS.has(bare.toLowerCase())) break;
    modelTokens.push(bare);
  }
  return { make: brand, model: modelTokens.join(' ') };
}

/**
 * Human-readable bike model for CTA copy, e.g. "Yamaha MT-07". Returns null when
 * no brand leads the title, so the caller falls back to a generic "motorcycle".
 */
export function extractModel(title: string): string | null {
  const mm = extractMakeModel(title);
  if (!mm) return null;
  const full = [mm.make, mm.model].filter(Boolean).join(' ').trim();
  // Guard against a runaway match (a long prose title with no stop word).
  return full.length > 40 ? mm.make : full;
}
