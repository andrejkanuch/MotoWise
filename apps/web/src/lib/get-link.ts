// -------------------------------------------------------------------
// /get — the social bio-link landing page
// -------------------------------------------------------------------
// One URL per platform (`/get?src=instagram|tiktok|facebook`). A phone is sent
// straight to its store with the platform stamped on, so installs can be split
// by the account that drove them:
//   - iOS: an App Store campaign link (`pt` provider token + `ct` campaign).
//     App Store Connect reports a campaign only once it has 5+ downloads, so
//     the campaign is the platform, never the individual video.
//   - Android: a Google Play install `referrer` carrying UTMs.
// Desktop gets a page with a QR code back to the same /get URL, so scanning it
// takes the phone through the same per-platform redirect.
// Pure module (no React, no server APIs) so it is unit-testable and importable
// from both the page and campaign.ts.
// -------------------------------------------------------------------

import type { CampaignParams } from '@/lib/campaign';
import { buildPlayReferrer, STORE_LINKS } from '@/lib/store-links';

export const GET_PATH = '/get';
export const GET_SOURCE_PARAM = 'src';

/** Accounts that link to /get. Anything else is counted as `other`. */
export const GetSource = {
  Instagram: 'instagram',
  TikTok: 'tiktok',
  Facebook: 'facebook',
  YouTube: 'youtube',
  Other: 'other',
} as const;
export type GetSource = (typeof GetSource)[keyof typeof GetSource];

const KNOWN_SOURCES = new Set<string>(Object.values(GetSource));

/** The platform the visitor's device will install from. */
export const GetPlatform = { Ios: 'ios', Android: 'android', Desktop: 'desktop' } as const;
export type GetPlatform = (typeof GetPlatform)[keyof typeof GetPlatform];

const APP_STORE_ID = '6760291360';
const BIO_MEDIUM = 'social';
const BIO_CAMPAIGN = 'bio';

/** Normalize `?src=` to a known source; unknown or missing values become `other`. */
export function normalizeGetSource(raw: string | string[] | undefined | null): GetSource {
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim().toLowerCase();
  return value && KNOWN_SOURCES.has(value) ? (value as GetSource) : GetSource.Other;
}

/** The UTM set a bio link stands for. */
export function getLinkCampaign(source: GetSource): CampaignParams {
  return { utm_source: source, utm_medium: BIO_MEDIUM, utm_campaign: BIO_CAMPAIGN };
}

/**
 * Server-side counterpart of `detectPlatform()`. iPadOS 13+ sends a desktop
 * Safari UA that the server cannot tell from a Mac, so an iPad lands on the
 * desktop page — whose QR code and App Store button still work.
 */
export function platformFromUserAgent(userAgent: string): GetPlatform {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return GetPlatform.Ios;
  if (/android/.test(ua)) return GetPlatform.Android;
  return GetPlatform.Desktop;
}

/**
 * Link-preview fetchers and scrapers. They get the page (with its Open Graph
 * tags) instead of a redirect, and are not counted. The Douyin/TikTok `aweme`
 * scraper is listed because it passes PostHog's bot filter and otherwise looks
 * like TikTok traffic. `bot` skips CUBOT phone model strings, and Telegram is
 * matched as `telegrambot` so its Android in-app browser (`Telegram-Android/...`)
 * still counts as a phone.
 */
const BOT_PATTERN =
  /(?<!cu)bot|crawl|spider|slurp|preview|facebookexternalhit|meta-externalagent|embedly|whatsapp|telegrambot|skype|discord|aweme|bytespider|headless|curl|wget|python|okhttp/i;

export function isBotUserAgent(userAgent: string): boolean {
  return !userAgent || BOT_PATTERN.test(userAgent);
}

/**
 * App Store campaign link. Without the provider token Apple ignores `ct`, so the
 * plain store URL is returned instead of a link that only looks attributed.
 */
export function appStoreCampaignUrl(source: GetSource, providerToken: string | undefined): string {
  if (!providerToken) return STORE_LINKS.appStore;
  const params = new URLSearchParams({ pt: providerToken, ct: source, mt: '8' });
  return `https://apps.apple.com/app/apple-store/id${APP_STORE_ID}?${params.toString()}`;
}

export function playStoreCampaignUrl(source: GetSource): string {
  return buildPlayReferrer(STORE_LINKS.googlePlay, getLinkCampaign(source));
}

/** Where a phone on `platform` is sent; null for desktop (it gets the page). */
export function storeRedirectFor(
  platform: GetPlatform,
  source: GetSource,
  providerToken: string | undefined,
): string | null {
  if (platform === GetPlatform.Ios) return appStoreCampaignUrl(source, providerToken);
  if (platform === GetPlatform.Android) return playStoreCampaignUrl(source);
  return null;
}
