// -------------------------------------------------------------------
// Store-CTA taxonomy — the acquisition-funnel dimensions
// -------------------------------------------------------------------
// Pure, dependency-free constants (no posthog-js import) so Server
// Components can reference them without pulling the analytics client into
// their bundle. analytics.ts consumes these for the store_cta_click event.
// -------------------------------------------------------------------

/** App-store platforms (no magic strings). */
export const StorePlatform = { Ios: 'ios', Android: 'android', Unknown: 'unknown' } as const;
export type StorePlatform = (typeof StorePlatform)[keyof typeof StorePlatform];

/** The kind of page a store CTA was clicked from. */
export const CtaPageType = {
  Home: 'home',
  Blog: 'blog',
  Guide: 'guide',
  Route: 'route',
  Compare: 'compare',
  Feature: 'feature',
  Tool: 'tool',
} as const;
export type CtaPageType = (typeof CtaPageType)[keyof typeof CtaPageType];

/** Where on the page a store CTA sits. */
export const CtaPlacement = {
  Hero: 'hero',
  MidArticle: 'mid_article',
  EndArticle: 'end_article',
  StickyBar: 'sticky_bar',
  Inline: 'inline',
  Footer: 'footer',
} as const;
export type CtaPlacement = (typeof CtaPlacement)[keyof typeof CtaPlacement];

/** First path segment → page type, for global chrome that infers its context. */
const SEGMENT_PAGE_TYPE: Record<string, CtaPageType> = {
  blog: CtaPageType.Blog,
  guides: CtaPageType.Guide,
  route: CtaPageType.Route,
  compare: CtaPageType.Compare,
  features: CtaPageType.Feature,
  tools: CtaPageType.Tool,
};

/**
 * Derive `{ pageType, slug }` from a locale-less pathname (as returned by
 * next-intl's usePathname). Lets global components — the sticky app bar, footer
 * — attribute a click to the page the visitor is on without threading props
 * through the tree. Unknown/home routes resolve to `home`.
 */
export function pageContextFromPathname(pathname: string): {
  pageType: CtaPageType;
  slug?: string;
} {
  const segments = pathname.split('/').filter(Boolean);
  const pageType = SEGMENT_PAGE_TYPE[segments[0] ?? ''] ?? CtaPageType.Home;
  const slug = segments.length > 1 ? segments[segments.length - 1] : undefined;
  return { pageType, slug };
}

/** Everything needed to attribute a store CTA click to its on-page context. */
export type StoreCtaContext = {
  pageType: CtaPageType;
  placement: CtaPlacement;
  slug?: string;
  /**
   * Keep navigation in the same tab (rare — most CTAs open the store in a new
   * tab so the landing page survives). When true the event is sent with
   * `send_instantly` so the page unload doesn't drop it.
   */
  sameTab?: boolean;
  /**
   * Extra key/values folded into the Google Play install referrer (Android
   * only) — e.g. `mv_make`/`mv_model` so the app can pre-seed the bike on first
   * launch (plan P2.1). First-touch campaign UTMs take precedence on conflict.
   */
  referrerParams?: Record<string, string>;
};
