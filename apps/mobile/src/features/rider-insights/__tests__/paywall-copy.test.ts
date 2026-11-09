jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));

import i18n from '@/i18n';
import { RIDER_INSIGHTS_PAYWALL_ROW } from '@/lib/paywall-surfaces';
import { buildInsightsPaywallCopy, insightsPaywallNumbers } from '../paywall-copy';

const t = i18n.t.bind(i18n);
const EN = { t, system: 'metric', language: 'en' } as const;
const EN_MILES = { t, system: 'imperial', language: 'en' } as const;

// 1,330 miles and 2,507 km, in metres.
const MILES_1330_M = 1330 * 1609.344;
const KM_2507_M = 2_507_000;

const NUMBERS = { seasonDistanceM: KM_2507_M, seasonRides: 36, longestRideM: 385_000 };
const NO_NUMBERS = { seasonDistanceM: null, seasonRides: null, longestRideM: null };

describe('buildInsightsPaywallCopy', () => {
  it('gives a rider in miles their season distance in miles', () => {
    const copy = buildInsightsPaywallCopy(
      RIDER_INSIGHTS_PAYWALL_ROW.TERRITORY,
      { ...NUMBERS, seasonDistanceM: MILES_1330_M },
      EN_MILES,
    );
    expect(copy.headline).toBe('1,330 mi this season');
  });

  it('gives a metric rider their season distance in km', () => {
    const copy = buildInsightsPaywallCopy(RIDER_INSIGHTS_PAYWALL_ROW.ROAD_CHARACTER, NUMBERS, EN);
    expect(copy).toEqual({
      headline: '2,507 km this season',
      subhead: 'Pro shows how twisty your roads were, and your estimated lean.',
    });
  });

  it('groups digits the way the rider’s language does', () => {
    const copy = buildInsightsPaywallCopy(RIDER_INSIGHTS_PAYWALL_ROW.SUMMARY, NUMBERS, {
      ...EN,
      language: 'de',
    });
    expect(copy.headline).toContain('2.507 km');
  });

  it('builds the rhythm headline from the ride count', () => {
    const copy = buildInsightsPaywallCopy(RIDER_INSIGHTS_PAYWALL_ROW.RHYTHM, NUMBERS, EN);
    expect(copy.headline).toBe('36 rides this season');
  });

  it('builds the best-rides headline from the free longest ride', () => {
    const copy = buildInsightsPaywallCopy(RIDER_INSIGHTS_PAYWALL_ROW.BEST_RIDES, NUMBERS, EN);
    expect(copy.headline).toBe('Your longest ride: 385 km');
  });

  it.each([
    [RIDER_INSIGHTS_PAYWALL_ROW.TERRITORY, 'See where you explored'],
    [RIDER_INSIGHTS_PAYWALL_ROW.ROAD_CHARACTER, 'See what your roads are like'],
    [RIDER_INSIGHTS_PAYWALL_ROW.RHYTHM, 'See when you ride'],
    [RIDER_INSIGHTS_PAYWALL_ROW.BEST_RIDES, 'Rank your best rides'],
    [RIDER_INSIGHTS_PAYWALL_ROW.SUMMARY, 'See the new roads on every ride'],
  ])('falls back to the default headline for %s when its number is missing', (row, expected) => {
    expect(buildInsightsPaywallCopy(row, NO_NUMBERS, EN).headline).toBe(expected);
  });
});

describe('insightsPaywallNumbers', () => {
  it('reads only the free season totals and the longest ride', () => {
    expect(
      insightsPaywallNumbers({
        totals: { rides: 36, distanceM: KM_2507_M, countries: 4 },
        longestRide: null,
      }),
    ).toEqual({ seasonDistanceM: KM_2507_M, seasonRides: 36, longestRideM: null });
  });
});
