/**
 * When What's New is owed, and which pages it carries.
 *
 * Owed: the newest release entry at or below the installed build, when that
 * entry is newer than the rider's last-seen release and has at least one page.
 * Pages: the release's own features tagged new, then catch-up features the
 * rider has neither been shown nor used, at most three.
 */

jest.mock('react-native-mmkv', () => require('../../test/mocks').makeMmkvMock());

const mockApplication: { nativeApplicationVersion: string | null } = {
  nativeApplicationVersion: null,
};
jest.mock('expo-application', () => ({
  __esModule: true,
  get nativeApplicationVersion() {
    return mockApplication.nativeApplicationVersion;
  },
}));

import {
  WHATS_NEW_FEATURE,
  WHATS_NEW_RELEASES,
  WHATS_NEW_TAG,
  type WhatsNewFeature,
} from '../../data/whats-new-releases';
import { useWhatsNewStore } from '../../stores/whats-new.store';
import {
  isWhatsNewOwed,
  markWhatsNewSeenForNewRider,
  owedRelease,
  selectPages,
  type WhatsNewFeatureState,
} from '../whats-new';

const { ROAD_ATLAS, RECEIPT_SCAN, NOTES_PHOTOS } = WHATS_NEW_FEATURE;
const NOTHING_SEEN: WhatsNewFeatureState = { seenFeatures: [], usedFeatures: [] };
const release = (version: string) => {
  const found = WHATS_NEW_RELEASES.find((r) => r.version === version);
  if (!found) throw new Error(`no release entry ${version}`);
  return found;
};

beforeEach(() => {
  mockApplication.nativeApplicationVersion = '3.28.0';
  useWhatsNewStore.setState({ lastSeenVersion: null, seenFeatures: [], usedFeatures: [] });
});

describe('owedRelease', () => {
  it.each([
    ['3.28.0', '3.25.0', '3.28.0'],
    ['3.28.3', '3.25.0', '3.28.0'],
    ['3.29.0', '3.22.0', '3.28.0'],
    ['3.28.0', null, '3.28.0'],
  ])('installed %s, last seen %p → owes %s', (installed, lastSeen, owed) => {
    expect(owedRelease(installed, lastSeen, NOTHING_SEEN)?.release.version).toBe(owed);
  });

  it.each([
    ['3.29.0', '3.28.0'],
    ['3.28.0', '3.28.0'],
    ['3.28.0', '3.28.5'],
  ])('installed %s, last seen %s → nothing owed', (installed, lastSeen) => {
    expect(owedRelease(installed, lastSeen, NOTHING_SEEN)).toBeNull();
  });

  it('owes nothing for a build older than every entry', () => {
    expect(owedRelease('3.0.0', null, NOTHING_SEEN)).toBeNull();
  });

  it.each([
    ['junk', null],
    ['', null],
    [null, null],
    ['3.28.0', 'junk'],
  ])('owes nothing when a version is not comparable (installed %p, last seen %p)', (installed, lastSeen) => {
    expect(owedRelease(installed, lastSeen, NOTHING_SEEN)).toBeNull();
  });

  it('carries the selected pages with the owed release', () => {
    expect(owedRelease('3.28.0', '3.25.0', NOTHING_SEEN)?.pages.map((p) => p.feature)).toEqual([
      ROAD_ATLAS,
      RECEIPT_SCAN,
      NOTES_PHOTOS,
    ]);
  });
});

describe('selectPages', () => {
  it('gives a rider with nothing seen or used every page, the release feature first', () => {
    expect(selectPages(release('3.28.0'), NOTHING_SEEN)).toEqual([
      { feature: ROAD_ATLAS, tag: WHATS_NEW_TAG.NEW },
      { feature: RECEIPT_SCAN, tag: WHATS_NEW_TAG.CATCH_UP },
      { feature: NOTES_PHOTOS, tag: WHATS_NEW_TAG.CATCH_UP },
    ]);
  });

  it('drops a catch-up feature the rider already used', () => {
    const pages = selectPages(release('3.28.0'), {
      seenFeatures: [],
      usedFeatures: [RECEIPT_SCAN],
    });
    expect(pages.map((p) => p.feature)).toEqual([ROAD_ATLAS, NOTES_PHOTOS]);
  });

  it('drops a catch-up feature already shown in a carousel', () => {
    const pages = selectPages(release('3.28.0'), {
      seenFeatures: [NOTES_PHOTOS],
      usedFeatures: [],
    });
    expect(pages.map((p) => p.feature)).toEqual([ROAD_ATLAS, RECEIPT_SCAN]);
  });

  it('tags a release’s own feature new even when it is also a catch-up feature', () => {
    expect(selectPages(release('3.22.0'), NOTHING_SEEN)).toEqual([
      { feature: NOTES_PHOTOS, tag: WHATS_NEW_TAG.NEW },
      { feature: RECEIPT_SCAN, tag: WHATS_NEW_TAG.CATCH_UP },
    ]);
  });

  it('never offers a catch-up feature newer than the release', () => {
    expect(selectPages(release('3.19.1'), NOTHING_SEEN)).toEqual([
      { feature: RECEIPT_SCAN, tag: WHATS_NEW_TAG.NEW },
    ]);
  });

  it('never returns more than 3 pages', () => {
    const big = {
      version: '9.0.0',
      features: [ROAD_ATLAS, RECEIPT_SCAN, NOTES_PHOTOS, ROAD_ATLAS] as WhatsNewFeature[],
    };
    expect(selectPages(big, NOTHING_SEEN)).toHaveLength(3);
  });

  it('returns no pages when every candidate is excluded, and then nothing is owed', () => {
    const empty = { version: '3.28.0', features: [] as WhatsNewFeature[] };
    const everything = { seenFeatures: [RECEIPT_SCAN], usedFeatures: [NOTES_PHOTOS] };
    expect(selectPages(empty, everything)).toEqual([]);
    expect(owedRelease('3.28.0', '3.25.0', everything, [empty])).toBeNull();
  });
});

describe('isWhatsNewOwed', () => {
  it('is owed to an existing rider updating from an older release', () => {
    expect(isWhatsNewOwed('3.28.0', '3.25.0')).toBe(true);
  });

  it('is owed for a patch build of a release the rider has not seen', () => {
    expect(isWhatsNewOwed('3.28.3', '3.25.0')).toBe(true);
  });

  it('is not owed for a newer build with no entry once the latest entry was seen', () => {
    expect(isWhatsNewOwed('999.0.0', '3.28.0')).toBe(false);
  });

  it('is not owed without a native version', () => {
    expect(isWhatsNewOwed(null, null)).toBe(false);
  });
});

describe('markWhatsNewSeenForNewRider', () => {
  it('marks the installed build seen, so a new rider is not owed What’s New', () => {
    const state = () => useWhatsNewStore.getState();
    expect(isWhatsNewOwed('3.28.0', state().lastSeenVersion, state())).toBe(true);

    markWhatsNewSeenForNewRider();

    expect(state().lastSeenVersion).toBe('3.28.0');
    expect(state().seenFeatures).toEqual([ROAD_ATLAS]);
    expect(isWhatsNewOwed('3.28.0', state().lastSeenVersion, state())).toBe(false);
  });

  it('marks the features of the newest entry at or below a patch build seen', () => {
    mockApplication.nativeApplicationVersion = '3.28.2';
    markWhatsNewSeenForNewRider();
    expect(useWhatsNewStore.getState().lastSeenVersion).toBe('3.28.2');
    expect(useWhatsNewStore.getState().seenFeatures).toEqual([ROAD_ATLAS]);
  });

  it('leaves the store untouched when the native version is unknown', () => {
    mockApplication.nativeApplicationVersion = null;
    markWhatsNewSeenForNewRider();
    expect(useWhatsNewStore.getState().lastSeenVersion).toBeNull();
    expect(useWhatsNewStore.getState().seenFeatures).toEqual([]);
  });
});
