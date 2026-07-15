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
};
