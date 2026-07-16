import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), identify: vi.fn(), reset: vi.fn() },
}));

const posthog = (await import('posthog-js')).default;
const { trackStoreCtaClick } = await import('../analytics');
const { CtaPageType, CtaPlacement, StorePlatform } = await import('../cta-taxonomy');

describe('trackStoreCtaClick', () => {
  afterEach(() => vi.clearAllMocks());

  it('captures platform + page_type + placement', () => {
    trackStoreCtaClick(StorePlatform.Ios, {
      pageType: CtaPageType.Blog,
      placement: CtaPlacement.EndArticle,
    });
    expect(posthog.capture).toHaveBeenCalledWith('store_cta_click', {
      platform: 'ios',
      page_type: 'blog',
      placement: 'end_article',
    });
  });

  it('includes the slug when present', () => {
    trackStoreCtaClick(StorePlatform.Android, {
      pageType: CtaPageType.Blog,
      placement: CtaPlacement.MidArticle,
      slug: 'yamaha-mt-07-maintenance-schedule',
    });
    expect(posthog.capture).toHaveBeenCalledWith('store_cta_click', {
      platform: 'android',
      page_type: 'blog',
      placement: 'mid_article',
      slug: 'yamaha-mt-07-maintenance-schedule',
    });
  });

  it('stamps campaign params (incl. utm_content) for channel attribution', () => {
    trackStoreCtaClick(
      StorePlatform.Android,
      { pageType: CtaPageType.Home, placement: CtaPlacement.Hero },
      {
        utm_source: 'instagram',
        utm_medium: 'social',
        utm_campaign: 'bio',
        utm_content: 'reel_42',
      },
    );
    expect(posthog.capture).toHaveBeenCalledWith('store_cta_click', {
      platform: 'android',
      page_type: 'home',
      placement: 'hero',
      utm_source: 'instagram',
      utm_medium: 'social',
      utm_campaign: 'bio',
      utm_content: 'reel_42',
    });
  });

  it('omits campaign keys that are absent', () => {
    trackStoreCtaClick(
      StorePlatform.Ios,
      { pageType: CtaPageType.Feature, placement: CtaPlacement.Inline },
      { utm_source: 'tiktok' },
    );
    expect(posthog.capture).toHaveBeenCalledWith('store_cta_click', {
      platform: 'ios',
      page_type: 'feature',
      placement: 'inline',
      utm_source: 'tiktok',
    });
  });

  it('sends instantly for same-tab CTAs so the event survives navigation', () => {
    trackStoreCtaClick(StorePlatform.Ios, {
      pageType: CtaPageType.Route,
      placement: CtaPlacement.Inline,
      sameTab: true,
    });
    expect(posthog.capture).toHaveBeenCalledWith(
      'store_cta_click',
      { platform: 'ios', page_type: 'route', placement: 'inline' },
      { send_instantly: true },
    );
  });
});
