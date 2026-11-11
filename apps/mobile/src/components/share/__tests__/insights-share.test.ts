// The season share images' data: the ride-end trim, what each image carries,
// the poster camera, and the cache key a capture is stored under.
jest.mock('@rnmapbox/maps', () => ({ __esModule: true, default: {} }));
jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn() }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
jest.mock('@/lib/analytics', () => require('@/test/mocks').mockAnalytics());
jest.mock('@/lib/graphql-client', () => ({ gqlFetcher: jest.fn() }));

import { projectPoint } from '@/features/rider-insights/map-viewport';
import { freeInsights, proInsights } from '@/test/rider-insights-fixtures';
import { encodePolyline } from '@/utils/polyline';
import {
  buildInsightsSharePayload,
  CARD_UNITS_WIDTH,
  END_TRIM_M,
  INSIGHTS_SHARE_IMAGE,
  insightsShareCacheKey,
  POSTER_BASE,
  POSTER_PANEL_UNITS,
  posterViewport,
  SHARE_SIZE,
  trimRouteEnds,
} from '../insights-share';
import type { LngLat } from '../share-card-types';

/** Metres per degree of longitude on the equator, on the 6,371 km sphere. */
const M_PER_DEG = (6_371_000 * Math.PI) / 180;

/** A straight ride east along the equator, one point every 100 m. */
function equatorRide(lengthM: number): LngLat[] {
  return Array.from({ length: lengthM / 100 + 1 }, (_, i) => [(i * 100) / M_PER_DEG, 0]);
}

const name = (region: { name: string | null }) => region.name ?? 'Unnamed';

describe('trimRouteEnds', () => {
  it('removes 500 m from each end of a 3 km ride, cutting exactly at 500 m', () => {
    const trimmed = trimRouteEnds(equatorRide(3000), END_TRIM_M);
    expect(trimmed[0][0] * M_PER_DEG).toBeCloseTo(500, 3);
    expect(trimmed[trimmed.length - 1][0] * M_PER_DEG).toBeCloseTo(2500, 3);
  });

  it('cuts between stored points by distance', () => {
    // Points 0 m, 400 m, 1,200 m, 2,000 m: the 500 m cut falls inside the second segment.
    const ride: LngLat[] = [0, 400, 1200, 2000].map((m) => [m / M_PER_DEG, 0]);
    const trimmed = trimRouteEnds(ride, END_TRIM_M);
    expect(trimmed.map(([lng]) => Math.round(lng * M_PER_DEG))).toEqual([500, 1200, 1500]);
  });

  it('leaves nothing of a ride no longer than both cuts', () => {
    expect(trimRouteEnds(equatorRide(1000), END_TRIM_M)).toEqual([]);
  });
});

describe('buildInsightsSharePayload', () => {
  const insights = freeInsights();
  const route = encodePolyline(equatorRide(3000).map(([lng, lat]) => [lat, lng]));
  const regions = [{ ...insights.regions[0], routes: [route] }, insights.regions[1]];

  it('trims the ride ends when "Hide ride start and end" is on', () => {
    const payload = buildInsightsSharePayload({
      insights,
      regions,
      regionName: name,
      hideEnds: true,
      handle: 'andrej_k11',
      measurementSystem: 'metric',
    });
    expect(payload.routes[0][0][0] * M_PER_DEG).toBeCloseTo(500, -1);
  });

  it('draws the whole ride when it is off', () => {
    const payload = buildInsightsSharePayload({
      insights,
      regions,
      regionName: name,
      hideEnds: false,
      handle: null,
      measurementSystem: 'metric',
    });
    expect(payload.routes[0][0][0]).toBe(0);
  });

  it('labels the routes with the region on the main map and carries the season totals', () => {
    const payload = buildInsightsSharePayload({
      insights,
      regions: [insights.regions[1], insights.regions[0]],
      regionName: name,
      hideEnds: true,
      handle: 'andrej_k11',
      measurementSystem: 'metric',
    });
    expect(payload.regionName).toBe('Bratislava');
    expect(payload.regionNames).toEqual(['Bratislava', 'La Rioja']);
    expect(payload).toMatchObject({ distanceM: 2_507_000, rides: 36, seasonYear: 2026 });
    expect(payload.plates).toEqual(['E', 'SK']);
  });

  it('never carries lean, even for a Pro rider whose rides have it', () => {
    const pro = proInsights();
    expect(pro.roadCharacter.detail?.lean).not.toBeNull();
    const payload = buildInsightsSharePayload({
      insights: pro,
      regions: pro.regions,
      regionName: name,
      hideEnds: true,
      handle: 'andrej_k11',
      measurementSystem: 'metric',
    });
    expect(JSON.stringify(payload)).not.toMatch(/lean|under20|from40/i);
  });

  it('carries the twisty share for a Pro rider only', () => {
    const pro = proInsights();
    const detail = pro.roadCharacter.detail;
    if (!detail) throw new Error('fixture has no road character');
    const { straight, sweeping, twisty, tight } = detail.bandKm;
    const proPayload = buildInsightsSharePayload({
      insights: pro,
      regions: pro.regions,
      regionName: name,
      hideEnds: true,
      handle: null,
      measurementSystem: 'metric',
    });
    expect(proPayload.twistyShare).toBeCloseTo(
      (twisty + tight) / (straight + sweeping + twisty + tight),
    );

    const freePayload = buildInsightsSharePayload({
      insights,
      regions: insights.regions,
      regionName: name,
      hideEnds: true,
      handle: null,
      measurementSystem: 'metric',
    });
    expect(freePayload.twistyShare).toBeNull();
  });
});

describe('posterViewport', () => {
  it.each([
    SHARE_SIZE.FEED,
    SHARE_SIZE.STORY,
  ])('centres the region in the map area above the panel on the %s base', (size) => {
    const bounds = [-3.1, 42.0, -1.7, 42.6];
    const base = POSTER_BASE[size];
    const viewport = posterViewport(bounds, size);
    const panel = (POSTER_PANEL_UNITS * base.width) / CARD_UNITS_WIDTH;
    const [west, south, east, north] = bounds;
    const [, top] = projectPoint([west, north], viewport, base.width, base.height);
    const [, bottom] = projectPoint([east, south], viewport, base.width, base.height);
    // Equal space above and below the routes inside the map area.
    expect(top).toBeCloseTo(base.height - panel - bottom, 0);
    expect(bottom).toBeLessThan(base.height - panel);
  });
});

describe('insightsShareCacheKey', () => {
  const insights = freeInsights();
  const payload = buildInsightsSharePayload({
    insights,
    regions: insights.regions,
    regionName: name,
    hideEnds: true,
    handle: 'andrej_k11',
    measurementSystem: 'metric',
  });
  const input = {
    image: INSIGHTS_SHARE_IMAGE.SEASON_LINES,
    size: SHARE_SIZE.FEED,
    scheme: 'dark' as const,
    fontScale: 1,
    payload,
  };
  const key = insightsShareCacheKey(input);

  it('is the same for the same image', () => {
    expect(insightsShareCacheKey({ ...input })).toBe(key);
  });

  it.each([
    ['size', { size: SHARE_SIZE.STORY }],
    ['theme', { scheme: 'light' as const }],
    ['font scale', { fontScale: 1.3 }],
    ['image', { image: INSIGHTS_SHARE_IMAGE.ATLAS_POSTER }],
    ['data', { payload: { ...payload, rides: 37 } }],
    [
      'ride-end trim',
      {
        payload: buildInsightsSharePayload({
          insights,
          regions: insights.regions,
          regionName: name,
          hideEnds: false,
          handle: 'andrej_k11',
          measurementSystem: 'metric',
        }),
      },
    ],
  ])('changes with the %s', (_, change) => {
    expect(insightsShareCacheKey({ ...input, ...change })).not.toBe(key);
  });
});
