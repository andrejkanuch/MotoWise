// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock process.env before importing
vi.stubEnv('NEXT_PUBLIC_META_PIXEL_ID', '913433971307490');

const { trackPageView, trackEvent, trackCustomEvent } = await import('../meta-pixel');

describe('meta-pixel utilities', () => {
  let fbq: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fbq = vi.fn();
    vi.stubGlobal('fbq', fbq);
    vi.stubEnv('NEXT_PUBLIC_META_PIXEL_ID', '913433971307490');
  });

  describe('trackPageView', () => {
    it('calls fbq with PageView event', () => {
      trackPageView();
      expect(fbq).toHaveBeenCalledWith('track', 'PageView');
    });
  });

  describe('trackEvent', () => {
    it('calls fbq with standard event name and params', () => {
      trackEvent('ViewContent', {
        content_name: 'Trip Planning',
        content_category: 'feature',
      });
      expect(fbq).toHaveBeenCalledWith('track', 'ViewContent', {
        content_name: 'Trip Planning',
        content_category: 'feature',
      });
    });

    it('calls fbq with Lead event', () => {
      trackEvent('Lead', { content_name: 'App Download' });
      expect(fbq).toHaveBeenCalledWith('track', 'Lead', {
        content_name: 'App Download',
      });
    });
  });

  describe('trackCustomEvent', () => {
    it('calls fbq trackCustom with event name and params', () => {
      trackCustomEvent('FeatureUsed', { feature: 'diagnostics' });
      expect(fbq).toHaveBeenCalledWith('trackCustom', 'FeatureUsed', {
        feature: 'diagnostics',
      });
    });
  });

  describe('when fbq is not loaded (ad blocker)', () => {
    it('does not throw when fbq is undefined', () => {
      vi.stubGlobal('fbq', undefined);
      expect(() => trackPageView()).not.toThrow();
      expect(() => trackEvent('ViewContent')).not.toThrow();
      expect(() => trackCustomEvent('Test')).not.toThrow();
    });
  });
});
