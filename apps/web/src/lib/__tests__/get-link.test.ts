import { describe, expect, it } from 'vitest';
import {
  appStoreCampaignUrl,
  GetPlatform,
  GetSource,
  isBotUserAgent,
  normalizeGetSource,
  platformFromUserAgent,
  storeRedirectFor,
} from '../get-link';
import { STORE_LINKS } from '../store-links';

const IPHONE_INSTAGRAM =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0';
const ANDROID_TIKTOK =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36 trill_350000 musical_ly';
const MAC_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';

describe('normalizeGetSource', () => {
  it('accepts known sources case-insensitively', () => {
    expect(normalizeGetSource('Instagram')).toBe(GetSource.Instagram);
    expect(normalizeGetSource(' tiktok ')).toBe(GetSource.TikTok);
    expect(normalizeGetSource(['facebook', 'x'])).toBe(GetSource.Facebook);
  });

  it('buckets unknown and missing values as other', () => {
    expect(normalizeGetSource('snapchat')).toBe(GetSource.Other);
    expect(normalizeGetSource(undefined)).toBe(GetSource.Other);
    expect(normalizeGetSource('')).toBe(GetSource.Other);
  });
});

describe('platformFromUserAgent', () => {
  it('detects phones inside in-app browsers', () => {
    expect(platformFromUserAgent(IPHONE_INSTAGRAM)).toBe(GetPlatform.Ios);
    expect(platformFromUserAgent(ANDROID_TIKTOK)).toBe(GetPlatform.Android);
  });

  it('treats everything else as desktop', () => {
    expect(platformFromUserAgent(MAC_SAFARI)).toBe(GetPlatform.Desktop);
    expect(platformFromUserAgent('')).toBe(GetPlatform.Desktop);
  });
});

describe('isBotUserAgent', () => {
  it('flags link-preview fetchers and the aweme scraper', () => {
    expect(isBotUserAgent('facebookexternalhit/1.1')).toBe(true);
    expect(isBotUserAgent('Mozilla/5.0 (Linux; Android 10) aweme_29.0')).toBe(true);
    expect(isBotUserAgent('')).toBe(true);
  });

  it('lets real in-app browsers through', () => {
    expect(isBotUserAgent(IPHONE_INSTAGRAM)).toBe(false);
    expect(isBotUserAgent(ANDROID_TIKTOK)).toBe(false);
  });
});

describe('store redirects', () => {
  it('builds an App Store campaign link when the provider token is set', () => {
    const url = new URL(appStoreCampaignUrl(GetSource.TikTok, '123456'));
    expect(url.pathname).toBe('/app/apple-store/id6760291360');
    expect(url.searchParams.get('pt')).toBe('123456');
    expect(url.searchParams.get('ct')).toBe('tiktok');
  });

  it('falls back to the plain App Store link without a provider token', () => {
    expect(appStoreCampaignUrl(GetSource.TikTok, undefined)).toBe(STORE_LINKS.appStore);
  });

  it('sends Android to Play with the source in the install referrer', () => {
    const url = storeRedirectFor(GetPlatform.Android, GetSource.Instagram, undefined);
    const referrer = new URL(url as string).searchParams.get('referrer');
    expect(referrer).toBe('utm_source=instagram&utm_medium=social&utm_campaign=bio');
  });

  it('does not redirect desktop', () => {
    expect(storeRedirectFor(GetPlatform.Desktop, GetSource.Facebook, '1')).toBeNull();
  });
});
