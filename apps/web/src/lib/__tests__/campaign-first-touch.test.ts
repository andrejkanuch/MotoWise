// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  captureCampaignParams,
  clearFirstTouch,
  firstTouchProperties,
  getCampaignParams,
  persistFirstTouch,
} from '../campaign';

function visit(url: string) {
  window.history.replaceState(null, '', url);
}

afterEach(() => {
  window.sessionStorage.clear();
  clearFirstTouch();
  visit('/');
});

describe('first-touch capture', () => {
  it('stores UTMs and click ids from a tagged landing', () => {
    visit('/blog/chain-care?utm_source=instagram&utm_medium=social&fbclid=abc');
    captureCampaignParams();
    visit('/pro');
    expect(getCampaignParams()).toEqual({ utm_source: 'instagram', utm_medium: 'social' });
    const touch = persistFirstTouch();
    expect(touch).toMatchObject({ fbclid: 'abc', landing_path: '/blog/chain-care' });
  });

  it('turns a /get bio link into its UTM set', () => {
    visit('/get?src=TikTok');
    captureCampaignParams();
    expect(getCampaignParams()).toEqual({
      utm_source: 'tiktok',
      utm_medium: 'social',
      utm_campaign: 'bio',
    });
  });

  it('keeps the first touch when a later tagged visit arrives', () => {
    visit('/?utm_source=facebook');
    captureCampaignParams();
    visit('/?utm_source=tiktok');
    captureCampaignParams();
    expect(getCampaignParams()?.utm_source).toBe('facebook');
  });

  it('ignores untagged visits', () => {
    visit('/features');
    captureCampaignParams();
    expect(getCampaignParams()).toBeNull();
    expect(persistFirstTouch()).toBeNull();
  });

  it('reads the 30-day cookie after the tab is gone, and never overwrites it', () => {
    visit('/?utm_source=instagram');
    captureCampaignParams();
    persistFirstTouch();
    window.sessionStorage.clear(); // a later day, a new tab
    visit('/?utm_source=tiktok');
    captureCampaignParams();
    persistFirstTouch();
    expect(getCampaignParams()?.utm_source).toBe('instagram');
  });

  it('lets a tagged visit replace a click-id-only touch in both tiers', () => {
    visit('/?fbclid=abc');
    captureCampaignParams();
    persistFirstTouch();
    expect(getCampaignParams()).toBeNull();
    visit('/?utm_source=tiktok');
    captureCampaignParams();
    expect(getCampaignParams()).toEqual({ utm_source: 'tiktok' });
    expect(persistFirstTouch()).toMatchObject({ utm_source: 'tiktok' });
    window.sessionStorage.clear(); // a later day, a new tab
    visit('/pro');
    expect(getCampaignParams()).toEqual({ utm_source: 'tiktok' });
  });

  it('falls back to the current URL when the stored touch is click ids only', () => {
    visit('/?fbclid=abc');
    captureCampaignParams();
    persistFirstTouch();
    window.sessionStorage.clear();
    visit('/get?src=instagram');
    expect(getCampaignParams()?.utm_source).toBe('instagram');
  });

  it('prefixes PostHog properties with ft_', () => {
    expect(firstTouchProperties({ utm_source: 'instagram', landing_path: '/get' })).toEqual({
      ft_utm_source: 'instagram',
      ft_landing_path: '/get',
    });
  });
});
