// -------------------------------------------------------------------
// Campaign / acquisition-source capture (web → app install attribution)
// -------------------------------------------------------------------
// Social bio links (Instagram, TikTok, …) point at /get?src=<platform>, and any
// other tagged link carries UTM params, e.g.
// https://motovault.app?utm_source=instagram&utm_medium=social&utm_campaign=bio
//
// This module captures the first touch on the initial hard page load (before
// the visitor navigates deeper and the query string is lost), then makes it
// available at store-click and checkout time so we can:
//   1. stamp it onto `store_cta_click` / `checkout_completed` (channel funnel),
//   2. append a Google Play `referrer` — the one deterministic organic-install
//      signal available without an MMP (iOS strips referrers), and
//   3. pass it into the RevenueCat Web Billing purchase metadata.
//
// Two storage tiers, split by consent:
//   - sessionStorage, always: the tab-scoped copy the store CTA reads. It never
//     outlives the tab, which is what the pre-consent capture has always used.
//   - a 30-day first-party cookie, only once analytics consent is granted
//     (persistFirstTouch, called from the consent provider). It carries the
//     source across the days between watching a video and buying on the web.
// First touch wins in both tiers: a later tagged visit never overwrites them.
// The one exception is a click-id-only touch (Meta adds fbclid to every
// outbound link, tagged or not): it names no source, so a later touch that
// carries UTMs replaces it.
// -------------------------------------------------------------------

import { GET_PATH, GET_SOURCE_PARAM, getLinkCampaign, normalizeGetSource } from '@/lib/get-link';

const CAMPAIGN_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const;

/** Ad-platform click ids. They mark a paid or platform-wrapped click even when the link had no UTMs. */
const CLICK_ID_KEYS = ['fbclid', 'ttclid', 'gclid'] as const;

const STORAGE_KEY = 'mv_campaign_params';
const FIRST_TOUCH_COOKIE = 'mv_ft';
const FIRST_TOUCH_MAX_AGE = 2_592_000; // 30 days in seconds
/** Cookies cap at ~4 KB; click ids are long, so bound every stored value. */
const MAX_VALUE_LENGTH = 200;

export type CampaignParams = Partial<Record<(typeof CAMPAIGN_KEYS)[number], string>>;
type ClickIds = Partial<Record<(typeof CLICK_ID_KEYS)[number], string>>;

/** What we store for the first tagged visit. */
type FirstTouch = CampaignParams &
  ClickIds & {
    landing_path?: string;
    referring_domain?: string;
  };

function pick<K extends string>(
  sp: URLSearchParams,
  keys: readonly K[],
): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  for (const key of keys) {
    const value = sp.get(key);
    if (value) out[key] = value.slice(0, MAX_VALUE_LENGTH);
  }
  return out;
}

function campaignOnly(touch: FirstTouch): CampaignParams | null {
  const params: CampaignParams = {};
  for (const key of CAMPAIGN_KEYS) {
    if (touch[key]) params[key] = touch[key];
  }
  return Object.keys(params).length > 0 ? params : null;
}

function hasCampaign(touch: FirstTouch | null): touch is FirstTouch {
  return touch !== null && campaignOnly(touch) !== null;
}

function externalReferrer(): string | undefined {
  try {
    const host = new URL(document.referrer).hostname;
    return host && host !== window.location.hostname ? host : undefined;
  } catch {
    return undefined;
  }
}

/** The UTM set a /get bio link stands for (`?src=` is its only tag). */
function getLinkDefaults(sp: URLSearchParams): CampaignParams {
  if (window.location.pathname !== GET_PATH || !sp.has(GET_SOURCE_PARAM)) return {};
  return getLinkCampaign(normalizeGetSource(sp.get(GET_SOURCE_PARAM)));
}

/** The first touch carried by the current URL, or null when the visit is untagged. */
function touchFromLocation(): FirstTouch | null {
  const sp = new URLSearchParams(window.location.search);
  // Explicit UTMs on the URL win over the /get defaults.
  const campaign = { ...getLinkDefaults(sp), ...pick(sp, CAMPAIGN_KEYS) };
  const clickIds = pick(sp, CLICK_ID_KEYS);
  if (Object.keys(campaign).length === 0 && Object.keys(clickIds).length === 0) return null;
  const referringDomain = externalReferrer();
  return {
    ...campaign,
    ...clickIds,
    landing_path: window.location.pathname.slice(0, MAX_VALUE_LENGTH),
    ...(referringDomain ? { referring_domain: referringDomain } : {}),
  };
}

function readJson(raw: string | null | undefined): FirstTouch | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as FirstTouch) : null;
  } catch {
    return null;
  }
}

function readCookie(): FirstTouch | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${FIRST_TOUCH_COOKIE}=([^;]*)`));
  if (!match) return null;
  try {
    return readJson(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

function readSession(): FirstTouch | null {
  try {
    return readJson(window.sessionStorage.getItem(STORAGE_KEY));
  } catch {
    // sessionStorage can throw in private mode / sandboxed webviews.
    return null;
  }
}

function writeCookie(value: string, maxAge: number) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  // biome-ignore lint/suspicious/noDocumentCookie: first-party attribution cookie, written only with consent
  document.cookie = `${FIRST_TOUCH_COOKIE}=${value}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
}

/**
 * Persist the first tagged touch of this tab into sessionStorage. Idempotent —
 * the first tagged URL wins, so later untagged navigations never clobber it.
 * Safe to call before hydration; no-ops server-side or when nothing is tagged.
 */
export function captureCampaignParams(): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = readSession();
    if (hasCampaign(existing)) return; // first-touch wins
    const touch = touchFromLocation();
    // A click-id-only touch only ever fills an empty slot.
    if (touch && (!existing || hasCampaign(touch))) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(touch));
    }
  } catch {
    // Attribution is best-effort, never worth surfacing an error to the visitor.
  }
}

/**
 * Promote this tab's first touch to the 30-day cookie. Call only once analytics
 * consent is granted. Keeps an existing cookie (an earlier visit's touch wins).
 * Returns the stored first touch so the caller can hand it to PostHog.
 */
export function persistFirstTouch(): FirstTouch | null {
  if (typeof window === 'undefined') return null;
  const existing = readCookie();
  if (hasCampaign(existing)) return existing;
  const touch = readSession();
  if (!touch || (existing && !hasCampaign(touch))) return existing;
  try {
    writeCookie(encodeURIComponent(JSON.stringify(touch)), FIRST_TOUCH_MAX_AGE);
  } catch {
    // Cookie writes can throw in sandboxed webviews.
  }
  return touch;
}

/** Drop the 30-day cookie when the visitor declines analytics. */
export function clearFirstTouch(): void {
  if (typeof window === 'undefined') return;
  try {
    writeCookie('', 0);
  } catch {
    // best-effort
  }
}

/**
 * First-touch campaign params: cookie, then this tab, then the current URL.
 * A tier whose touch has no UTMs (click ids only) falls through to the next.
 */
export function getCampaignParams(): CampaignParams | null {
  if (typeof window === 'undefined') return null;
  for (const touch of [readCookie(), readSession(), touchFromLocation()]) {
    const params = touch ? campaignOnly(touch) : null;
    if (params) return params;
  }
  return null;
}

/**
 * The first touch as flat `ft_`-prefixed PostHog properties, for super
 * properties and the person's `$set_once`.
 */
export function firstTouchProperties(touch: FirstTouch): Record<string, string> {
  const props: Record<string, string> = {};
  for (const [key, value] of Object.entries(touch)) {
    if (typeof value === 'string' && value) props[`ft_${key}`] = value;
  }
  return props;
}

// Lives with the store URLs so Server Components can build Play links too.
export { buildPlayReferrer } from '@/lib/store-links';
