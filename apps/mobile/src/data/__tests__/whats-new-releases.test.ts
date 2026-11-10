import { compareVersions } from '../../lib/version-compare';
import {
  CATCH_UP_FEATURES,
  WHATS_NEW_FEATURE,
  WHATS_NEW_FEATURES,
  WHATS_NEW_RELEASES,
} from '../whats-new-releases';

/**
 * What's New is feature-based: each release lists the features it introduced,
 * and older features the rider may have missed come from a catch-up allowlist.
 * These pin the shape the gate and the carousel read.
 */
describe('whats-new releases', () => {
  const CURRENT = '3.28.0';

  it('lists the shipping release first, introducing only Road Atlas', () => {
    expect(WHATS_NEW_RELEASES[0]).toEqual({
      version: CURRENT,
      features: [WHATS_NEW_FEATURE.ROAD_ATLAS],
    });
  });

  it('is ordered newest-first by semver', () => {
    for (let i = 1; i < WHATS_NEW_RELEASES.length; i++) {
      expect(
        compareVersions(WHATS_NEW_RELEASES[i - 1].version, WHATS_NEW_RELEASES[i].version),
      ).toBe(1);
    }
  });

  it('lists every feature under the release that introduced it, exactly once', () => {
    const listed = WHATS_NEW_RELEASES.flatMap((r) => r.features.map((f) => [f, r.version]));
    expect(listed).toHaveLength(Object.keys(WHATS_NEW_FEATURES).length);
    for (const [feature, version] of listed) {
      expect(WHATS_NEW_FEATURES[feature as keyof typeof WHATS_NEW_FEATURES].introducedIn).toBe(
        version,
      );
    }
  });

  it('dates the catch-up features to the releases they actually shipped in', () => {
    expect(CATCH_UP_FEATURES).toEqual([
      WHATS_NEW_FEATURE.RECEIPT_SCAN,
      WHATS_NEW_FEATURE.NOTES_PHOTOS,
    ]);
    expect(WHATS_NEW_FEATURES[WHATS_NEW_FEATURE.RECEIPT_SCAN].introducedIn).toBe('3.19.1');
    expect(WHATS_NEW_FEATURES[WHATS_NEW_FEATURE.NOTES_PHOTOS].introducedIn).toBe('3.22.0');
  });

  it('gives every feature a distinct destination', () => {
    const destinations = Object.values(WHATS_NEW_FEATURES).map((f) => f.destination);
    expect(new Set(destinations).size).toBe(destinations.length);
  });

  describe('i18n keys', () => {
    const en = require('../../i18n/locales/en.json');
    const resolve = (key: string): unknown =>
      key
        .split('.')
        .reduce<unknown>(
          (acc, part) =>
            typeof acc === 'object' && acc !== null
              ? (acc as Record<string, unknown>)[part]
              : undefined,
          en,
        );

    it.each(Object.values(WHATS_NEW_FEATURE))('every key of %s resolves in en.json', (id) => {
      const { keys } = WHATS_NEW_FEATURES[id];
      const all = [
        keys.title,
        keys.where,
        keys.yourData.line,
        keys.yourData.cta,
        keys.example.line,
        keys.example.cta,
      ];
      // A plural key resolves through its CLDR `_other` form.
      for (const key of all) {
        const value = resolve(key) ?? resolve(`${key}_other`);
        expect([key, typeof value]).toEqual([key, 'string']);
      }
    });

    it('keys follow whatsNew.features.<id>', () => {
      expect(WHATS_NEW_FEATURES[WHATS_NEW_FEATURE.ROAD_ATLAS].keys.yourData.cta).toBe(
        'whatsNew.features.road_atlas.yourData.cta',
      );
    });
  });
});
