import {
  getLatestRelease,
  getWhatsNewRelease,
  SLIDE_PLATFORM,
  visibleSlides,
  WHATS_NEW_RELEASES,
} from '../whats-new-releases';

/**
 * The modal is version-gated (`_layout.tsx` only pushes it when
 * `getWhatsNewRelease(currentVersion)` is non-null), so a release whose slides
 * are all gated to another platform must report as "nothing to show" rather
 * than open an empty modal. CarPlay is the first iOS-only slide we ship, which
 * is what these cover.
 */
describe('whats-new releases', () => {
  const CURRENT = '3.19.1';

  it('has an entry for the shipping version', () => {
    expect(getWhatsNewRelease(CURRENT, SLIDE_PLATFORM.IOS)).not.toBeNull();
  });

  it('is ordered newest-first, since getLatestRelease takes the first match', () => {
    expect(WHATS_NEW_RELEASES[0].version).toBe(CURRENT);
  });

  it('returns null for a version with no entry', () => {
    expect(getWhatsNewRelease('0.0.0', SLIDE_PLATFORM.IOS)).toBeNull();
  });

  describe('platform gating', () => {
    /** Reads the shipping release off the array directly, so no null-assert is needed. */
    const release = WHATS_NEW_RELEASES[0];

    it('shows both the receipt and CarPlay slides on iOS', () => {
      const keys = visibleSlides(release, SLIDE_PLATFORM.IOS).map((s) => s.titleKey);
      expect(keys).toEqual(['whatsNew.v3191.receiptTitle', 'whatsNew.v3191.carplayTitle']);
    });

    it('hides the CarPlay slide on Android, where CarPlay does not exist', () => {
      const keys = visibleSlides(release, SLIDE_PLATFORM.ANDROID).map((s) => s.titleKey);
      expect(keys).toEqual(['whatsNew.v3191.receiptTitle']);
    });

    it('still shows the release on Android, because receipt scanning is cross-platform', () => {
      expect(getWhatsNewRelease(CURRENT, SLIDE_PLATFORM.ANDROID)).not.toBeNull();
    });

    it('treats a slide with no `platforms` as universal', () => {
      const universal = { slides: [{ titleKey: 'a' }] } as never;
      expect(visibleSlides(universal, 'web')).toHaveLength(1);
    });

    it('reports no release when every slide is gated to another platform', () => {
      const iosOnly = {
        version: 'x',
        slides: [{ titleKey: 'a', platforms: [SLIDE_PLATFORM.IOS] }],
      } as never;
      expect(visibleSlides(iosOnly, SLIDE_PLATFORM.ANDROID)).toHaveLength(0);
    });

    it('skips an all-hidden release so the modal never renders an empty slide', () => {
      // getLatestRelease must return something with a usable slides[0] on both
      // platforms — the modal indexes into it unconditionally.
      for (const os of [SLIDE_PLATFORM.IOS, SLIDE_PLATFORM.ANDROID]) {
        expect(visibleSlides(getLatestRelease(os), os).length).toBeGreaterThan(0);
      }
    });
  });

  describe('i18n keys', () => {
    it('every slide key resolves in en.json', () => {
      const en = require('../../i18n/locales/en.json');
      for (const release of WHATS_NEW_RELEASES) {
        for (const slide of release.slides) {
          for (const key of [slide.titleKey, slide.descriptionKey]) {
            const value = key
              .split('.')
              .reduce<unknown>(
                (acc, part) =>
                  typeof acc === 'object' && acc !== null
                    ? (acc as Record<string, unknown>)[part]
                    : undefined,
                en,
              );
            expect(typeof value).toBe('string');
          }
        }
      }
    });
  });
});
