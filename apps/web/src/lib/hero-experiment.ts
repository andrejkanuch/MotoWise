/**
 * Home hero A/B test: which message sells the app best.
 *
 * Each eligible visitor is assigned one variant before first paint by
 * {@link HERO_ASSIGN_SCRIPT}, which the root shell inlines in <head> on every
 * full page load (so a soft navigation to the home page keeps it). The script
 * sets `data-hero` on <html>; the kit's CSS shows only the matching hero copy,
 * so the home page stays fully static and nothing flickers. The hero then
 * registers the variant as a PostHog super property (`hero_variant`) and
 * captures `hero_viewed`, so store clicks can be split by variant.
 *
 * Only visitors analytics may track are randomized: an opt-out region
 * (mv_region=OTHER) that has not said no, or a clicked "accept". That mirrors
 * cookie-consent.tsx, which asks an EU visitor again when their "yes" was only
 * implied. Everyone else, and crawlers, see the control, and any earlier
 * assignment is cleared. Exposure is only recorded for an assigned visitor
 * ({@link readHeroAssignment}), so a visitor who accepts on the page is counted
 * from the next page load, in the arm they are randomized into then.
 */

export const HERO_VARIANT = {
  Control: 'control',
  Cost: 'cost',
  Service: 'service',
} as const;
export type HeroVariant = (typeof HERO_VARIANT)[keyof typeof HERO_VARIANT];

const HERO_VARIANTS: readonly HeroVariant[] = Object.values(HERO_VARIANT);

/** First-party cookie that keeps a visitor on one variant. */
export const HERO_COOKIE = 'mv_hero';
/** Attribute the assignment script sets on <html>. */
export const HERO_ATTRIBUTE = 'data-hero';
/** PostHog super property carrying the variant onto every later event. */
export const HERO_VARIANT_PROPERTY = 'hero_variant';

const HERO_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;
// Mirrors cookie-consent.tsx (`v1:<decision>:…`) and consent-region.ts.
const CONSENT_COOKIE = 'mv_consent';
const REGION_COOKIE = 'mv_region';
const OPT_OUT_REGION = 'OTHER';
const ACCEPTED = 'accepted';
const REJECTED = 'rejected';
const EXPLICIT_SOURCE = 'explicit';
const CONSENT_VERSION = 'v1';
const CRAWLER_UA = 'bot|crawl|spider|slurp|lighthouse|headless';

/** Built from the constants above so the cookie names and variants cannot drift. */
export const HERO_ASSIGN_SCRIPT = `(function(){var V=${JSON.stringify(HERO_VARIANTS)},v=V[0];try{var c=document.cookie;var g=function(n){var m=c.match(new RegExp('(?:^|; )'+n+'=([^;]*)'));return m?decodeURIComponent(m[1]):null};var p=(g('${CONSENT_COOKIE}')||'').split(':');var k=p[1];var h=g('${HERO_COOKIE}');var s=location.protocol==='https:'?'; Secure':'';var ok=k!=='${REJECTED}'&&!new RegExp('${CRAWLER_UA}','i').test(navigator.userAgent)&&((p[0]==='${CONSENT_VERSION}'&&k==='${ACCEPTED}'&&p[4]==='${EXPLICIT_SOURCE}')||g('${REGION_COOKIE}')==='${OPT_OUT_REGION}');if(!ok){if(h)document.cookie='${HERO_COOKIE}=; path=/; max-age=0'}else if(h&&V.indexOf(h)>-1){v=h}else{v=V[Math.floor(Math.random()*V.length)];document.cookie='${HERO_COOKIE}='+v+'; path=/; max-age=${HERO_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax'+s}}catch(e){}document.documentElement.setAttribute('${HERO_ATTRIBUTE}',v)})()`;

/**
 * CSP source for {@link HERO_ASSIGN_SCRIPT}, which the root shell inlines like
 * the theme script (see theme-init-script.ts for why a hash). Change the
 * script and the hash together (a unit test enforces it).
 */
export const HERO_ASSIGN_SCRIPT_CSP_HASH = "'sha256-XNz/1MPZWud3AX4oGcHkqH/ZlVM/ipzOzARdfsbtAYk='";

function isHeroVariant(value: string | null | undefined): value is HeroVariant {
  return HERO_VARIANTS.includes(value as HeroVariant);
}

function readHeroCookie(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${HERO_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * The variant this visitor was randomized into, or null when they were not
 * (undecided EU, crawler, a "no", script blocked): they see the control but
 * are not part of the test, so no exposure is recorded for them.
 */
export function readHeroAssignment(): HeroVariant | null {
  if (typeof document === 'undefined') return null;
  const shown = document.documentElement.getAttribute(HERO_ATTRIBUTE);
  return isHeroVariant(shown) && shown === readHeroCookie() ? shown : null;
}

/** A "no" (or an Undo) ends the assignment now, not on the next page load. */
export function clearHeroAssignment(): void {
  if (typeof document === 'undefined' || readHeroCookie() === null) return;
  // biome-ignore lint/suspicious/noDocumentCookie: the A/B assignment cookie, cleared on a "no"
  document.cookie = `${HERO_COOKIE}=; path=/; max-age=0`;
}
