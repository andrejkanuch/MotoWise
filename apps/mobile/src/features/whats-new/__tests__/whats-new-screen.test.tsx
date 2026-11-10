// The What's New screen: the boot shows only on auto-show; the release is
// marked seen and logged as viewed once, on mount; the page set, the tags, the
// line and button per data kind, Tried state, Back / dots / Next, close and
// "Ride on", resume, and the accessibility announcement on page change.
import type { ReactNode } from 'react';

jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 54, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
const mockReducedMotion = jest.fn(() => false);
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => mockReducedMotion(),
}));
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  const element = (props: { children?: ReactNode }) => <View {...props} />;
  const names = ['Svg', 'G', 'Path', 'Line', 'Circle', 'Rect', 'Polyline'];
  return {
    __esModule: true,
    default: element,
    ...Object.fromEntries(names.map((name) => [name, element])),
  };
});
jest.mock('expo-application', () => ({ __esModule: true, nativeApplicationVersion: '3.28.0' }));
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
}));
const mockTrackEvent = jest.fn();
jest.mock('@/lib/analytics', () => ({
  AnalyticsEvent: new Proxy({}, { get: (_target, key) => String(key) }),
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));
// The boot has its own tests; here it only has to report how it ended.
jest.mock('../whats-new-boot', () => {
  const { Pressable, Text } = require('react-native');
  return {
    WhatsNewBoot: ({
      onDone,
      newCount,
      catchUpCount,
    }: {
      onDone: (r: { skipped: boolean; elapsedMs: number }) => void;
      newCount: number;
      catchUpCount: number;
    }) => (
      <>
        <Text testID="boot-counts">{`${newCount}+${catchUpCount}`}</Text>
        <Pressable testID="boot-end" onPress={() => onDone({ skipped: false, elapsedMs: 2000 })} />
        <Pressable testID="boot-skip" onPress={() => onDone({ skipped: true, elapsedMs: 700 })} />
      </>
    ),
  };
});
const mockHandle = { current: null as unknown };
jest.mock('../use-boot-snapshot', () => ({ useBootSnapshot: () => mockHandle.current }));

import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { WHATS_NEW_SOURCE } from '@/config/whats-new';
import {
  WHATS_NEW_DATA_KIND,
  WHATS_NEW_FEATURE,
  type WhatsNewFeature,
} from '@/data/whats-new-releases';
import '@/i18n';
import { useWhatsNewStore } from '@/stores/whats-new.store';
import {
  ATLAS_LINE,
  BOOT_KIND,
  WHATS_NEW_DATA_SOURCE,
  type WhatsNewPageDataMap,
} from '../build-boot-snapshot';
import { WhatsNewScreen, whatsNewParams } from '../whats-new-screen';

const ROUTES = [
  [
    [42.46, -2.44],
    [42.47, -2.43],
    [42.48, -2.45],
  ],
] as const;

const YOUR_DATA: WhatsNewPageDataMap = {
  [WHATS_NEW_FEATURE.ROAD_ATLAS]: {
    feature: WHATS_NEW_FEATURE.ROAD_ATLAS,
    kind: WHATS_NEW_DATA_KIND.YOUR_DATA,
    source: WHATS_NEW_DATA_SOURCE.CACHE,
    line: ATLAS_LINE.SEASON,
    distance: '2,507 km',
    rides: 36,
    newRoadShare: null,
    routes: ROUTES,
  },
  [WHATS_NEW_FEATURE.RECEIPT_SCAN]: {
    feature: WHATS_NEW_FEATURE.RECEIPT_SCAN,
    kind: WHATS_NEW_DATA_KIND.YOUR_DATA,
    source: WHATS_NEW_DATA_SOURCE.FETCHED,
    expenseId: 'e1',
    place: 'Repsol',
    // The record's own currency, although the rider's currency is USD.
    amount: '€22.85',
    date: 'Nov 3',
    category: 'fuel',
  },
  [WHATS_NEW_FEATURE.NOTES_PHOTOS]: {
    feature: WHATS_NEW_FEATURE.NOTES_PHOTOS,
    kind: WHATS_NEW_DATA_KIND.YOUR_DATA,
    source: WHATS_NEW_DATA_SOURCE.FETCHED,
    noteId: 'n1',
    text: 'Chain slack 30 mm',
    hasPhoto: false,
  },
};

const EXAMPLES: WhatsNewPageDataMap = {
  [WHATS_NEW_FEATURE.ROAD_ATLAS]: {
    feature: WHATS_NEW_FEATURE.ROAD_ATLAS,
    kind: WHATS_NEW_DATA_KIND.EXAMPLE,
    source: WHATS_NEW_DATA_SOURCE.NONE,
    routes: ROUTES,
    unitLabel: 'mi',
  },
  [WHATS_NEW_FEATURE.RECEIPT_SCAN]: {
    feature: WHATS_NEW_FEATURE.RECEIPT_SCAN,
    kind: WHATS_NEW_DATA_KIND.EXAMPLE,
    source: WHATS_NEW_DATA_SOURCE.TIMED_OUT,
    currency: 'USD' as never,
    amount: '$18.42',
    date: 'Nov 7',
    category: 'fuel',
  },
  [WHATS_NEW_FEATURE.NOTES_PHOTOS]: {
    feature: WHATS_NEW_FEATURE.NOTES_PHOTOS,
    kind: WHATS_NEW_DATA_KIND.EXAMPLE,
    source: WHATS_NEW_DATA_SOURCE.NONE,
    bikeName: 'Street Glide',
    front: '36 psi',
    rear: '42 psi',
  },
};

const getPageData = jest.fn();

function useHandle(pages: WhatsNewPageDataMap, priorUse: WhatsNewFeature[] = []) {
  getPageData.mockImplementation((feature: WhatsNewFeature) => pages[feature]);
  mockHandle.current = {
    ready: true,
    boot: { kind: BOOT_KIND.NONE },
    priorUse,
    getPageData,
  };
}

const onTryFeature = jest.fn();

async function open(params: Record<string, string> = {}) {
  await render(<WhatsNewScreen {...whatsNewParams(params)} onTryFeature={onTryFeature} />);
}

const calls = (event: string) =>
  mockTrackEvent.mock.calls.filter(([name]) => name === event).map(([, props]) => props);

function pageOf() {
  return screen.getByTestId('whats-new-page-of').props.children;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockReducedMotion.mockReturnValue(false);
  useWhatsNewStore.setState({
    lastSeenVersion: '3.25.0',
    seenFeatures: [],
    triedFeatures: [],
    usedFeatures: [],
    returnSessionOpen: true,
  });
  useHandle(YOUR_DATA);
});

describe('auto-show', () => {
  it('boots first, then shows page 1 of 3; the release is marked seen and viewed is logged once', async () => {
    await open({ source: WHATS_NEW_SOURCE.AUTO });

    expect(screen.getByTestId('boot-counts').props.children).toBe('1+2');
    expect(screen.queryByTestId('whats-new-page-of')).toBeNull();
    expect(useWhatsNewStore.getState().lastSeenVersion).toBe('3.28.0');
    expect(useWhatsNewStore.getState().seenFeatures).toEqual([
      WHATS_NEW_FEATURE.ROAD_ATLAS,
      WHATS_NEW_FEATURE.RECEIPT_SCAN,
      WHATS_NEW_FEATURE.NOTES_PHOTOS,
    ]);
    expect(calls('WHATS_NEW_VIEWED')).toEqual([
      { version: '3.28.0', source: WHATS_NEW_SOURCE.AUTO, pages: 3 },
    ]);
    // No page has been seen during the boot, so none is frozen yet.
    expect(getPageData).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('boot-end'));

    expect(pageOf()).toBe('1 of 3');
    expect(screen.getByText('New in 3.28')).toBeTruthy();
    expect(calls('WHATS_NEW_BOOT_SKIPPED')).toEqual([]);
    expect(calls('WHATS_NEW_PAGE_VIEWED')).toEqual([
      {
        version: '3.28.0',
        feature: WHATS_NEW_FEATURE.ROAD_ATLAS,
        page_index: 0,
        data_kind: WHATS_NEW_DATA_KIND.YOUR_DATA,
        data_source: WHATS_NEW_DATA_SOURCE.CACHE,
        tag: 'new',
      },
    ]);
    expect(calls('WHATS_NEW_VIEWED')).toHaveLength(1);
  });

  it('logs a skipped boot', async () => {
    await open({ source: WHATS_NEW_SOURCE.AUTO });
    await fireEvent.press(screen.getByTestId('boot-skip'));
    expect(calls('WHATS_NEW_BOOT_SKIPPED')).toEqual([{ elapsed_ms: 700 }]);
  });

  it('leaves out catch-up pages for features the rider already uses', async () => {
    useHandle(YOUR_DATA, [WHATS_NEW_FEATURE.RECEIPT_SCAN]);
    await open({ source: WHATS_NEW_SOURCE.AUTO, noBoot: '1' });
    expect(pageOf()).toBe('1 of 2');
    // Remembered, so the scan entry rows drop their NEW chip too.
    expect(useWhatsNewStore.getState().usedFeatures).toEqual([WHATS_NEW_FEATURE.RECEIPT_SCAN]);
  });

  it('with noBoot goes straight to the pages', async () => {
    await open({ source: WHATS_NEW_SOURCE.AUTO, noBoot: '1' });
    expect(screen.queryByTestId('boot-end')).toBeNull();
    expect(pageOf()).toBe('1 of 3');
  });

  it('with one page shows no dots and no "i of n", only "Ride on"', async () => {
    useWhatsNewStore.setState({
      seenFeatures: [WHATS_NEW_FEATURE.RECEIPT_SCAN, WHATS_NEW_FEATURE.NOTES_PHOTOS],
    });
    await open({ source: WHATS_NEW_SOURCE.AUTO, noBoot: '1' });
    expect(screen.queryByTestId('whats-new-page-of')).toBeNull();
    expect(screen.queryByTestId('whats-new-dot-0')).toBeNull();
    expect(screen.getByText('Ride on')).toBeTruthy();
    expect(screen.queryByText('Next')).toBeNull();
  });
});

describe('profile and return', () => {
  it('profile: no boot, pages straight away, no seen write, viewed logged as profile', async () => {
    await open({ source: WHATS_NEW_SOURCE.PROFILE });
    expect(screen.queryByTestId('boot-end')).toBeNull();
    expect(pageOf()).toBe('1 of 3');
    expect(useWhatsNewStore.getState().lastSeenVersion).toBe('3.25.0');
    expect(useWhatsNewStore.getState().seenFeatures).toEqual([]);
    expect(calls('WHATS_NEW_VIEWED')).toEqual([
      { version: '3.28.0', source: WHATS_NEW_SOURCE.PROFILE, pages: 3 },
    ]);
  });

  it('profile shows the full set even when the catch-ups were seen and used', async () => {
    useWhatsNewStore.setState({
      seenFeatures: [WHATS_NEW_FEATURE.RECEIPT_SCAN],
      usedFeatures: [WHATS_NEW_FEATURE.NOTES_PHOTOS],
    });
    await open({ source: WHATS_NEW_SOURCE.PROFILE });
    expect(pageOf()).toBe('1 of 3');
  });

  it('resume=1 opens on page 2 without the boot', async () => {
    await open({ source: WHATS_NEW_SOURCE.AUTO, resume: '1' });
    expect(screen.queryByTestId('boot-end')).toBeNull();
    expect(pageOf()).toBe('2 of 3');
    expect(screen.getByText('You may have missed')).toBeTruthy();
  });

  it('source=return&resume=1 opens on page 2 and logs no second viewed', async () => {
    await open({ source: WHATS_NEW_SOURCE.RETURN, resume: '1' });
    expect(pageOf()).toBe('2 of 3');
    expect(calls('WHATS_NEW_VIEWED')).toEqual([]);
    expect(useWhatsNewStore.getState().lastSeenVersion).toBe('3.25.0');
  });
});

describe('pager', () => {
  it('hides Back on page 1; Next moves on and logs the page once; Back returns', async () => {
    await open({ source: WHATS_NEW_SOURCE.PROFILE });
    expect(screen.queryByText('Back')).toBeNull();

    await fireEvent.press(screen.getByText('Next'));
    expect(pageOf()).toBe('2 of 3');
    await fireEvent.press(screen.getByText('Back'));
    expect(pageOf()).toBe('1 of 3');
    await fireEvent.press(screen.getByText('Next'));

    const viewed = calls('WHATS_NEW_PAGE_VIEWED').map((p) => p.page_index);
    expect(viewed).toEqual([0, 1]);
  });

  it('"Ride on" on the last page closes once and logs completed_all', async () => {
    useWhatsNewStore.setState({ triedFeatures: [WHATS_NEW_FEATURE.RECEIPT_SCAN] });
    await open({ source: WHATS_NEW_SOURCE.PROFILE });
    await fireEvent.press(screen.getByText('Next'));
    await fireEvent.press(screen.getByText('Next'));
    expect(pageOf()).toBe('3 of 3');

    await fireEvent.press(screen.getByText('Ride on'));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(useWhatsNewStore.getState().returnSessionOpen).toBe(false);
    expect(calls('WHATS_NEW_DISMISSED')).toEqual([
      { version: '3.28.0', last_page: 2, completed_all: true, tried_count: 1 },
    ]);
    expect(calls('WHATS_NEW_SKIPPED')).toEqual([]);
  });

  it('close on page 1 logs skipped and an incomplete dismissal', async () => {
    await open({ source: WHATS_NEW_SOURCE.PROFILE });
    await fireEvent.press(screen.getByLabelText('Close'));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(useWhatsNewStore.getState().returnSessionOpen).toBe(false);
    expect(calls('WHATS_NEW_SKIPPED')).toEqual([
      { version: '3.28.0', skipped_at_page: 0, total_pages: 3 },
    ]);
    expect(calls('WHATS_NEW_DISMISSED')).toEqual([
      { version: '3.28.0', last_page: 0, completed_all: false, tried_count: 0 },
    ]);
  });

  it('announces the new page and its title', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await open({ source: WHATS_NEW_SOURCE.PROFILE });
    await fireEvent.press(screen.getByText('Next'));
    expect(announce).toHaveBeenCalledWith('Page 2 of 3: Scan a receipt');
  });

  it('the CTA hands the feature, page and data kind to onTryFeature', async () => {
    await open({ source: WHATS_NEW_SOURCE.PROFILE });
    await fireEvent.press(screen.getByText('Open my atlas'));
    expect(onTryFeature).toHaveBeenCalledWith(
      WHATS_NEW_FEATURE.ROAD_ATLAS,
      0,
      WHATS_NEW_DATA_KIND.YOUR_DATA,
    );
  });
});

describe('pages', () => {
  it('atlas with the rider data: YOUR DATA tag, personal line, "Open my atlas"', async () => {
    await open({ source: WHATS_NEW_SOURCE.PROFILE });
    expect(screen.getByText('YOUR DATA')).toBeTruthy();
    expect(
      screen.getByText("2,507 km over 36 rides this season. Here's every one on one map."),
    ).toBeTruthy();
    expect(screen.getByText('Open my atlas')).toBeTruthy();
  });

  it('atlas example: EXAMPLE tag, example line, "Record my first ride"', async () => {
    useHandle(EXAMPLES);
    await open({ source: WHATS_NEW_SOURCE.PROFILE });
    expect(screen.getByText('EXAMPLE')).toBeTruthy();
    expect(
      screen.getByText(
        'Every ride you record draws itself onto one map, and shows which roads were new to you.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Record my first ride')).toBeTruthy();
  });

  it('scan with the rider data shows the record in its own currency', async () => {
    await open({ source: WHATS_NEW_SOURCE.PROFILE, resume: '1' });
    expect(
      screen.getByText(
        'On Nov 3 you logged Repsol, €22.85. Next time, one photo of the receipt fills it in.',
      ),
    ).toBeTruthy();
    expect(screen.getAllByText('€22.85', { includeHiddenElements: true }).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText('Scan my next receipt')).toBeTruthy();
  });

  it('notes example for an imperial rider shows psi and the bike name', async () => {
    useHandle(EXAMPLES);
    await open({ source: WHATS_NEW_SOURCE.PROFILE, resume: '2' });
    expect(
      screen.getByText('Tire pressure 36 psi front, 42 psi rear', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Tire pressures, part numbers, the shop's number. Kept with your Street Glide, with a photo, found in a second.",
      ),
    ).toBeTruthy();
    expect(screen.getByText('Write my first note')).toBeTruthy();
  });

  it('notes example without a bike uses the no-bike line', async () => {
    useHandle({
      ...EXAMPLES,
      [WHATS_NEW_FEATURE.NOTES_PHOTOS]: { ...EXAMPLES.notes_photos, bikeName: null },
    } as WhatsNewPageDataMap);
    await open({ source: WHATS_NEW_SOURCE.PROFILE, resume: '2' });
    expect(
      screen.getByText(
        "Tire pressures, part numbers, the shop's number. Kept with your bike, with a photo, found in a second.",
      ),
    ).toBeTruthy();
  });

  it('a tried feature shows the Tried chip, "Open again" and a tried dot', async () => {
    useWhatsNewStore.setState({ triedFeatures: [WHATS_NEW_FEATURE.ROAD_ATLAS] });
    await open({ source: WHATS_NEW_SOURCE.PROFILE });
    expect(screen.getByText('Tried')).toBeTruthy();
    expect(screen.getByText('Open again')).toBeTruthy();
    expect(screen.queryByText('Open my atlas')).toBeNull();
    expect(screen.getByTestId('whats-new-dot-0').props.accessibilityState).toEqual(
      expect.objectContaining({ checked: true }),
    );
    expect(screen.getByTestId('whats-new-dot-1').props.accessibilityState).toEqual(
      expect.objectContaining({ checked: false }),
    );
  });

  it('freezes only the pages the rider has looked at', async () => {
    await open({ source: WHATS_NEW_SOURCE.PROFILE });
    expect(getPageData.mock.calls.map(([f]) => f)).not.toContain(WHATS_NEW_FEATURE.NOTES_PHOTOS);
  });

  it('demos are animated normally and drawn in their end state under reduced motion', async () => {
    await open({ source: WHATS_NEW_SOURCE.PROFILE, resume: '1' });
    expect(screen.getByTestId('whats-new-scan-line', { includeHiddenElements: true })).toBeTruthy();
    screen.unmount();

    mockReducedMotion.mockReturnValue(true);
    await open({ source: WHATS_NEW_SOURCE.PROFILE, resume: '1' });
    expect(screen.queryByTestId('whats-new-scan-line', { includeHiddenElements: true })).toBeNull();
    expect(screen.getAllByText('Repsol', { includeHiddenElements: true }).length).toBeGreaterThan(
      0,
    );
  });
});

describe('route file', () => {
  it('holds only the params and the screen', () => {
    const source: string = require('node:fs').readFileSync(
      require('node:path').join(__dirname, '../../../app/(modals)/whats-new.tsx'),
      'utf8',
    );
    expect(source).toContain('<WhatsNewScreen');
    expect(source).not.toMatch(/\b(useState|useCallback|trackEvent|ScrollView)\b/);
  });
});
