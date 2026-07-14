import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), identify: vi.fn(), reset: vi.fn() },
}));

const posthog = (await import('posthog-js')).default;
const { trackAppStoreClick } = await import('../analytics');

describe('trackAppStoreClick', () => {
  afterEach(() => vi.clearAllMocks());

  it('captures platform only when no location is given', () => {
    trackAppStoreClick('ios');
    expect(posthog.capture).toHaveBeenCalledWith('app_store_click', { platform: 'ios' });
  });

  it('captures the funnel location when provided', () => {
    trackAppStoreClick('android', 'hero');
    expect(posthog.capture).toHaveBeenCalledWith('app_store_click', {
      platform: 'android',
      location: 'hero',
    });
  });

  it('stamps campaign params onto the event for channel attribution', () => {
    trackAppStoreClick('android', 'cta', {
      utm_source: 'instagram',
      utm_medium: 'social',
      utm_campaign: 'bio',
    });
    expect(posthog.capture).toHaveBeenCalledWith('app_store_click', {
      platform: 'android',
      location: 'cta',
      utm_source: 'instagram',
      utm_medium: 'social',
      utm_campaign: 'bio',
    });
  });

  it('omits campaign keys that are absent', () => {
    trackAppStoreClick('ios', 'cta', { utm_source: 'tiktok' });
    expect(posthog.capture).toHaveBeenCalledWith('app_store_click', {
      platform: 'ios',
      location: 'cta',
      utm_source: 'tiktok',
    });
  });
});
