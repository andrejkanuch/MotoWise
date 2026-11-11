// The screen's pure decisions: what state to show, when a purchase is trusted,
// country plate letters, map geometry, the region swap, the route layer guard
// and the season ribbon.
jest.mock('@/lib/logger', () => ({ logger: { warn: jest.fn(), log: jest.fn() } }));
jest.mock('@rnmapbox/maps', () => ({ __esModule: true, default: {} }));
jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn() }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
jest.mock('@/lib/analytics', () => require('@/test/mocks').mockAnalytics());
jest.mock('@/lib/subscription', () => ({ presentRiderInsightsPaywall: jest.fn() }));
jest.mock('@/lib/graphql-client', () => ({ gqlFetcher: jest.fn() }));

import { logger } from '@/lib/logger';
import { freeInsights } from '@/test/rider-insights-fixtures';
import { MAP_STYLES } from '@/utils/map-styles';
import { routeLayerPlacement, scaleBar } from '../atlas-hero';
import { blurCaptureKey } from '../blur-capture';
import { plateLettersFor } from '../country-codes';
import { busiestSlot, gridLevels } from '../how-you-ride-list';
import { fitViewport, projectPoint } from '../map-viewport';
import { swapMainRegion } from '../region-tiles';
import { seasonEndSoFar, summarizeRibbon, weekRange } from '../season-ribbon';
import {
  hasRegionGeometry,
  INSIGHTS_VIEW,
  insightsViewState,
  isUnlocking,
  PURCHASE_TRUST_WINDOW_MS,
} from '../use-rider-insights';

describe('insightsViewState', () => {
  it.each([
    [
      { hasData: true, isError: false, fetchStatus: 'idle', isOnline: true },
      INSIGHTS_VIEW.READY,
      false,
    ],
    [
      { hasData: true, isError: false, fetchStatus: 'paused', isOnline: false },
      INSIGHTS_VIEW.READY,
      true,
    ],
    [
      { hasData: true, isError: true, fetchStatus: 'idle', isOnline: true },
      INSIGHTS_VIEW.READY,
      true,
    ],
    [
      { hasData: false, isError: false, fetchStatus: 'paused', isOnline: false },
      INSIGHTS_VIEW.OFFLINE,
      false,
    ],
    [
      { hasData: false, isError: true, fetchStatus: 'idle', isOnline: false },
      INSIGHTS_VIEW.OFFLINE,
      false,
    ],
    [
      { hasData: false, isError: true, fetchStatus: 'idle', isOnline: true },
      INSIGHTS_VIEW.ERROR,
      false,
    ],
    [
      { hasData: false, isError: false, fetchStatus: 'fetching', isOnline: true },
      INSIGHTS_VIEW.LOADING,
      false,
    ],
  ] as const)('%o shows %s (stale %s)', (input, view, stale) => {
    expect(insightsViewState(input)).toEqual({ view, stale });
  });
});

describe('isUnlocking', () => {
  const now = 1_000_000;
  it('trusts the store for two minutes after a purchase while the server reads free', () => {
    const trustUntil = now + PURCHASE_TRUST_WINDOW_MS;
    expect(isUnlocking({ serverPro: false, storePro: true, trustUntil, now })).toBe(true);
    expect(isUnlocking({ serverPro: false, storePro: true, trustUntil, now: trustUntil })).toBe(
      false,
    );
  });
  it('is off once the server agrees, without a purchase, or when the store reads free', () => {
    const trustUntil = now + 1;
    expect(isUnlocking({ serverPro: true, storePro: true, trustUntil, now })).toBe(false);
    expect(isUnlocking({ serverPro: false, storePro: true, trustUntil: null, now })).toBe(false);
    expect(isUnlocking({ serverPro: false, storePro: false, trustUntil, now })).toBe(false);
  });
});

describe('hasRegionGeometry', () => {
  const [region] = freeInsights().regions;
  it('reads a region with bounds but no routes as the offline copy', () => {
    expect(hasRegionGeometry(region)).toBe(true);
    expect(hasRegionGeometry({ ...region, routes: [] })).toBe(false);
    expect(hasRegionGeometry({ ...region, bounds: null, routes: [] })).toBe(true);
  });
});

describe('plateLettersFor', () => {
  it.each([
    ['ES', 'E'],
    ['AT', 'A'],
    ['SK', 'SK'],
    ['US', 'USA'],
    ['GB', 'UK'],
    ['de', 'D'],
    ['ZZ', 'ZZ'],
  ])('%s -> %s', (iso, plate) => expect(plateLettersFor(iso)).toBe(plate));
});

describe('map geometry', () => {
  it('centres the viewport on the bounds and projects that centre to the middle of the box', () => {
    const viewport = fitViewport([16, 48, 18, 49], 358, 448, 24);
    const [x, y] = projectPoint(viewport.center, viewport, 358, 448);
    expect(x).toBeCloseTo(179, 5);
    expect(y).toBeCloseTo(224, 5);
  });
  it('fits the bounds inside the padded box', () => {
    const viewport = fitViewport([16, 48, 18, 49], 358, 448, 24);
    const [west] = projectPoint([16, 48.5], viewport, 358, 448);
    const [east] = projectPoint([18, 48.5], viewport, 358, 448);
    expect(east - west).toBeCloseTo(358 - 48, 0);
  });
  it('picks a round scale length no longer than the bar allows', () => {
    const viewport = fitViewport([16, 48, 18, 49], 358, 448, 24);
    const km = scaleBar(viewport, 'metric');
    expect(km.unit).toBe('km');
    expect([10, 20, 50]).toContain(km.value);
    expect(km.px).toBeLessThanOrEqual(96);
    expect(scaleBar(viewport, 'imperial').unit).toBe('mi');
  });
});

describe('swapMainRegion', () => {
  const key = (k: string) => ({ ...freeInsights().regions[0], key: k });
  it('trades the tapped tile with the main region and leaves the rest in place', () => {
    const order = swapMainRegion([key('a'), key('b'), key('c'), key('d')], 'c').map((r) => r.key);
    expect(order).toEqual(['c', 'b', 'a', 'd']);
  });
});

describe('routeLayerPlacement', () => {
  it('puts the routes under road-label-simple on light-v11 and dark-v11', () => {
    expect(routeLayerPlacement(MAP_STYLES.light)).toEqual({ belowLayerID: 'road-label-simple' });
    expect(routeLayerPlacement(MAP_STYLES.dark)).toEqual({ belowLayerID: 'road-label-simple' });
  });
  it('skips the placement with a logged warning on a style without that layer', () => {
    expect(routeLayerPlacement(MAP_STYLES.satellite)).toEqual({});
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('road-label-simple'));
  });
});

describe('blurCaptureKey', () => {
  const parts = { row: 'rhythm', data: { grid: [[1]] }, isDark: false, fontScale: 1 };
  it('changes with the data, the scheme and the font scale', () => {
    const key = blurCaptureKey(parts);
    expect(blurCaptureKey({ ...parts, data: { grid: [[2]] } })).not.toBe(key);
    expect(blurCaptureKey({ ...parts, isDark: true })).not.toBe(key);
    expect(blurCaptureKey({ ...parts, fontScale: 1.5 })).not.toBe(key);
    expect(blurCaptureKey({ ...parts })).toBe(key);
  });
});

describe('rhythm', () => {
  const grid = [
    [0, 0, 0, 0],
    [0, 2, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [4, 0, 0, 0],
    [9, 0, 0, 0],
  ];
  const t = ((key: string, opts: { day: string }) => `${key}|${opts.day}`) as never;
  it('names the busiest weekday and day part', () => {
    expect(busiestSlot(grid, t, 'en')).toBe('riderInsights.howYouRide.rhythm.slot.morning|Sunday');
  });
  it('has no busiest slot without rides', () => {
    expect(busiestSlot([[0, 0, 0, 0]], t, 'en')).toBeNull();
  });
  it('scales counts to levels 0-3 against the busiest slot', () => {
    expect(gridLevels([[0, 2, 9, 4]])).toEqual([[0, 1, 3, 2]]);
  });
});

describe('summarizeRibbon', () => {
  it('spans the calendar year, counts ridden weeks to date and finds the biggest week', () => {
    const summary = summarizeRibbon(
      [
        { weekStart: '2026-03-02', rides: 3, distanceM: 385_000 },
        { weekStart: '2026-11-02', rides: 1, distanceM: 64_000 },
      ],
      { from: '2026-01-01', to: '2026-11-09' },
    );
    expect(summary.slots[0].weekStart).toBe('2025-12-29');
    expect(summary.slots).toHaveLength(53);
    expect(summary.weeksRidden).toBe(2);
    expect(summary.weeksSoFar).toBe(46);
    expect(summary.biggest?.weekStart).toBe('2026-03-02');
    expect(summary.slots.filter((s) => s.current).map((s) => s.weekStart)).toEqual(['2026-11-09']);
  });

  it('counts the current season to today when the API sends the whole calendar year', () => {
    const summary = summarizeRibbon(
      [{ weekStart: '2026-03-02', rides: 3, distanceM: 385_000 }],
      { from: '2026-01-01', to: '2026-12-31' },
      '2026-11-09',
    );
    expect(summary.weeksSoFar).toBe(46);
    expect(summary.slots.filter((s) => s.current).map((s) => s.weekStart)).toEqual(['2026-11-09']);
  });

  it('keeps a past season to its own last week', () => {
    const summary = summarizeRibbon([], { from: '2025-01-01', to: '2025-12-31' }, '2026-11-09');
    expect(summary.weeksSoFar).toBe(summary.slots.length);
  });
});

describe('seasonEndSoFar', () => {
  it('is today inside the season and the season end otherwise', () => {
    expect(seasonEndSoFar({ from: '2026-01-01', to: '2026-12-31' }, '2026-11-09')).toBe(
      '2026-11-09',
    );
    expect(seasonEndSoFar({ from: '2025-01-01', to: '2025-12-31' }, '2026-11-09')).toBe(
      '2025-12-31',
    );
    expect(seasonEndSoFar({ from: '2026-01-01', to: '2026-11-09' }, '2026-11-09')).toBe(
      '2026-11-09',
    );
  });
});

describe('weekRange', () => {
  it('names the month once when the week stays in it', () => {
    expect(weekRange('2026-08-24', 'en-US')).toEqual({ start: 'Aug 24', end: '30' });
  });

  it('names both months when the week crosses into the next', () => {
    expect(weekRange('2026-08-31', 'en-US')).toEqual({ start: 'Aug 31', end: 'Sep 6' });
  });
});
