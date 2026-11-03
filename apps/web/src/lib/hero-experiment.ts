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
 * (mv_region=OTHER) or an explicit "accept". Everyone else, and crawlers, see
 * the control and get no cookie. Their visits could not be measured anyway.
 * A "reject" clears an earlier assignment.
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
const CRAWLER_UA = 'bot|crawl|spider|slurp|lighthouse|headless';

/** Built from the constants above so the cookie names and variants cannot drift. */
export const HERO_ASSIGN_SCRIPT = `(function(){var V=${JSON.stringify(HERO_VARIANTS)},v=V[0];try{var c=document.cookie;var g=function(n){var m=c.match(new RegExp('(?:^|; )'+n+'=([^;]*)'));return m?decodeURIComponent(m[1]):null};var k=(g('${CONSENT_COOKIE}')||'').split(':')[1];var h=g('${HERO_COOKIE}');var s=location.protocol==='https:'?'; Secure':'';if(k==='${REJECTED}'){if(h)document.cookie='${HERO_COOKIE}=; path=/; max-age=0'}else if(!new RegExp('${CRAWLER_UA}','i').test(navigator.userAgent)&&(k==='${ACCEPTED}'||g('${REGION_COOKIE}')==='${OPT_OUT_REGION}')){if(h&&V.indexOf(h)>-1){v=h}else{v=V[Math.floor(Math.random()*V.length)];document.cookie='${HERO_COOKIE}='+v+'; path=/; max-age=${HERO_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax'+s}}}catch(e){}document.documentElement.setAttribute('${HERO_ATTRIBUTE}',v)})()`;

/**
 * CSP source for {@link HERO_ASSIGN_SCRIPT}, which the root shell inlines like
 * the theme script (see theme-init-script.ts for why a hash). Change the
 * script and the hash together (a unit test enforces it).
 */
export const HERO_ASSIGN_SCRIPT_CSP_HASH = "'sha256-GT9nd8KltBBLCsxh7YmXRayMCUzwNTM0klQEhxHP8S8='";

function isHeroVariant(value: string | null | undefined): value is HeroVariant {
  return HERO_VARIANTS.includes(value as HeroVariant);
}

/** The variant the assignment script picked; control when it has not run. */
export function readHeroVariant(): HeroVariant {
  if (typeof document === 'undefined') return HERO_VARIANT.Control;
  const value = document.documentElement.getAttribute(HERO_ATTRIBUTE);
  return isHeroVariant(value) ? value : HERO_VARIANT.Control;
}
