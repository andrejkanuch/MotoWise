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
});
