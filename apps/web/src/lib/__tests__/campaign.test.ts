import { describe, expect, it } from 'vitest';
import { buildPlayReferrer, type CampaignParams } from '../campaign';

describe('buildPlayReferrer', () => {
  const playUrl = 'https://play.google.com/store/apps/details?id=app.motovault';

  it('returns the URL unchanged when there is nothing to attribute', () => {
    expect(buildPlayReferrer(playUrl, null)).toBe(playUrl);
    expect(buildPlayReferrer(playUrl, {})).toBe(playUrl);
  });

  it('appends an encoded referrer built from the campaign params', () => {
    const params: CampaignParams = {
      utm_source: 'instagram',
      utm_medium: 'social',
      utm_campaign: 'bio',
    };
    const result = buildPlayReferrer(playUrl, params);
    // Play returns the referrer once-decoded; the app then parses it as a query
    // string, so the referrer value must decode to `utm_source=instagram&...`.
    const referrer = new URL(result).searchParams.get('referrer');
    expect(referrer).toBe('utm_source=instagram&utm_medium=social&utm_campaign=bio');
  });

  it('encodes special characters inside a value so it survives the round-trip', () => {
    const params: CampaignParams = { utm_campaign: 'spring&sale=2026' };
    const result = buildPlayReferrer(playUrl, params);
    // Outer decode (what Play hands back): the `&`/`=` inside the value stay
    // percent-encoded, so parsing the referrer keeps them in the value.
    const referrer = new URL(result).searchParams.get('referrer');
    expect(referrer).toBe('utm_campaign=spring%26sale%3D2026');
    // Simulate the app parsing that referrer string.
    expect(new URLSearchParams(referrer as string).get('utm_campaign')).toBe('spring&sale=2026');
  });

  it('uses `&` as separator when the play URL already has a query string', () => {
    const result = buildPlayReferrer(playUrl, { utm_source: 'tiktok' });
    expect(result).toBe(`${playUrl}&referrer=utm_source%3Dtiktok`);
  });
});
