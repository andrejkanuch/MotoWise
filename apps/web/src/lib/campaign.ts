// -------------------------------------------------------------------
// Campaign / acquisition-source capture (web → app install attribution)
// -------------------------------------------------------------------
// Social bio links (Instagram, TikTok, …) should be tagged with UTM params,
// e.g. https://motovault.app?utm_source=instagram&utm_medium=social&utm_campaign=bio
//
// This module captures those params first-touch into sessionStorage on the
// initial hard page load (before the visitor navigates deeper and the query
// string is lost), then makes them available at store-click time so we can:
//   1. stamp them onto the `app_store_click` PostHog event (channel funnel), and
//   2. append a Google Play `referrer` — the ONE deterministic organic-install
//      signal available without an MMP (Play captures it; iOS App Store strips
//      any referrer, so there is no iOS equivalent).
// -------------------------------------------------------------------

const CAMPAIGN_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const;

const STORAGE_KEY = 'mv_campaign_params';

export type CampaignParams = Partial<Record<(typeof CAMPAIGN_KEYS)[number], string>>;

function readFromSearch(search: string): CampaignParams {
  const sp = new URLSearchParams(search);
  const params: CampaignParams = {};
  for (const key of CAMPAIGN_KEYS) {
    const value = sp.get(key);
    if (value) params[key] = value;
  }
  return params;
}

/**
 * Persist the first-touch UTM params seen this session. Idempotent — the first
 * tagged URL wins, so later untagged navigations never clobber the source. Safe
 * to call before hydration; no-ops server-side or when nothing is tagged.
 */
export function captureCampaignParams(): void {
  if (typeof window === 'undefined') return;
  try {
    if (window.sessionStorage.getItem(STORAGE_KEY)) return; // first-touch wins
    const params = readFromSearch(window.location.search);
    if (Object.keys(params).length > 0) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(params));
    }
  } catch {
    // sessionStorage can throw in private mode / sandboxed webviews — attribution
    // is best-effort, never worth surfacing an error to the visitor.
  }
}

/** First-touch campaign params (sessionStorage), falling back to the current URL. */
export function getCampaignParams(): CampaignParams | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as CampaignParams;
  } catch {
    // fall through to URL parse
  }
  const params = readFromSearch(window.location.search);
  return Object.keys(params).length > 0 ? params : null;
}

/**
 * Append a Google Play `referrer` param built from arbitrary key/values. Play
 * surfaces this verbatim in the Install Referrer API + Play Console acquisition
 * reports, giving deterministic Android channel attribution — and it is how blog
 * CTAs carry make/model intent across the store boundary (`mv_make`/`mv_model`,
 * plan P2.1). Undefined/empty values are dropped; returns the URL unchanged when
 * there is nothing to attribute.
 */
export function buildPlayReferrer(
  playUrl: string,
  params: Record<string, string | undefined> | null,
): string {
  const entries = params
    ? Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1]))
    : [];
  if (entries.length === 0) return playUrl;
  // Encode each value: URLSearchParams already decoded them, so a value that
  // itself contains `&`/`=` would otherwise split into extra pairs once Play
  // hands the (once-decoded) referrer string back to the app for parsing.
  const referrer = entries.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
  const separator = playUrl.includes('?') ? '&' : '?';
  return `${playUrl}${separator}referrer=${encodeURIComponent(referrer)}`;
}
