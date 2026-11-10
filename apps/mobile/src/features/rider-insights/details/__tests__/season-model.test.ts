// The season page's pure decisions: which month a week counts in, the months
// and weeks it lists, and how far back the ride list must page for one week.
// Ride start times are built from local dates so the tests hold in any zone.
jest.mock('@rnmapbox/maps', () => ({ __esModule: true, default: {} }));
jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
jest.mock('@/lib/graphql-client', () => ({ gqlFetcher: jest.fn() }));

import { RideStatus } from '@motovault/graphql';
import {
  type MyRide,
  monthOfWeek,
  needsOlderRides,
  ridesInWeek,
  seasonMonths,
  seasonWeeks,
  weekBounds,
} from '../season-model';

const SEASON = { from: '2026-01-01', to: '2026-12-31' };
const TODAY = '2026-04-15';

function ride(id: string, local: Date, status: RideStatus = RideStatus.Completed): MyRide {
  return {
    id,
    status,
    name: null,
    startedAt: local.toISOString(),
    endedAt: null,
    distanceM: 10_000,
    maxSpeedMps: null,
    avgSpeedMps: null,
    elevationGain: null,
    pausedDurationS: 0,
    autoPausedDurationS: 0,
    durationS: null,
    motorcycleId: null,
    routePolyline: null,
    routeThumbnailUri: null,
    gpsQuality: null,
  };
}

describe('monthOfWeek', () => {
  it('counts a week in the month of its Thursday', () => {
    // Mon 30 Mar to Sun 5 Apr: Thursday is 2 Apr.
    expect(monthOfWeek('2026-03-30')).toBe('2026-04');
    // Mon 23 Feb to Sun 1 Mar: Thursday is 26 Feb.
    expect(monthOfWeek('2026-02-23')).toBe('2026-02');
    // The season's first week starts in the old year but counts in January.
    expect(monthOfWeek('2025-12-29')).toBe('2026-01');
  });
});

describe('seasonMonths', () => {
  const ribbon = [
    { weekStart: '2025-12-29', rides: 1, distanceM: 20_000 },
    { weekStart: '2026-03-02', rides: 3, distanceM: 385_000 },
    { weekStart: '2026-03-30', rides: 2, distanceM: 90_000 },
    { weekStart: '2026-04-13', rides: 1, distanceM: 40_000 },
  ];

  it('lists every month up to the season end so far, newest first, empty months as zeros', () => {
    expect(seasonMonths(ribbon, SEASON, TODAY)).toEqual([
      { month: '2026-04', rides: 3, distanceM: 130_000 },
      { month: '2026-03', rides: 3, distanceM: 385_000 },
      { month: '2026-02', rides: 0, distanceM: 0 },
      { month: '2026-01', rides: 1, distanceM: 20_000 },
    ]);
  });

  it('keeps a finished season to its own last month', () => {
    const months = seasonMonths([], { from: '2025-01-01', to: '2025-12-31' }, TODAY);
    expect(months).toHaveLength(12);
    expect(months[0].month).toBe('2025-12');
  });

  it('counts a week whose Thursday falls before the season in its first month', () => {
    // Season 2027 opens on a Friday: its first week (Mon 28 Dec 2026) has a 2026 Thursday.
    const months = seasonMonths(
      [{ weekStart: '2026-12-28', rides: 1, distanceM: 5_000 }],
      { from: '2027-01-01', to: '2027-12-31' },
      '2027-01-03',
    );
    expect(months).toEqual([{ month: '2027-01', rides: 1, distanceM: 5_000 }]);
  });
});

describe('seasonWeeks', () => {
  it('lists the weeks ridden newest first and marks the biggest', () => {
    const weeks = seasonWeeks(
      [
        { weekStart: '2026-03-02', rides: 3, distanceM: 385_000 },
        { weekStart: '2026-04-13', rides: 1, distanceM: 40_000 },
      ],
      SEASON,
      TODAY,
    );
    expect(weeks).toEqual([
      { weekStart: '2026-04-13', rides: 1, distanceM: 40_000, biggest: false },
      { weekStart: '2026-03-02', rides: 3, distanceM: 385_000, biggest: true },
    ]);
  });
});

describe('weekBounds', () => {
  it('runs from Monday local midnight to the next Monday', () => {
    const { start, end } = weekBounds('2026-03-02');
    expect(start).toEqual(new Date(2026, 2, 2));
    expect(end).toEqual(new Date(2026, 2, 9));
  });
});

describe('needsOlderRides', () => {
  const newer = ride('a', new Date(2026, 2, 12, 9));
  const inWeek = ride('b', new Date(2026, 2, 3, 9));
  const older = ride('c', new Date(2026, 1, 27, 18));

  it('asks for more while no loaded ride is older than the week and pages remain', () => {
    expect(needsOlderRides([newer], '2026-03-02', true)).toBe(true);
    expect(needsOlderRides([newer, inWeek], '2026-03-02', true)).toBe(true);
    expect(needsOlderRides([], '2026-03-02', true)).toBe(true);
  });

  it('stops once a ride is older than the week, or the list has ended', () => {
    expect(needsOlderRides([newer, inWeek, older], '2026-03-02', true)).toBe(false);
    expect(needsOlderRides([newer], '2026-03-02', false)).toBe(false);
  });
});

describe('ridesInWeek', () => {
  it('keeps the finished rides that started Monday 00:00 to Sunday 23:59, oldest first', () => {
    const rides = [
      ride('next-monday', new Date(2026, 2, 9, 0, 0)),
      ride('sunday-night', new Date(2026, 2, 8, 23, 59)),
      ride('recording', new Date(2026, 2, 5, 10), RideStatus.Recording),
      ride('monday-start', new Date(2026, 2, 2, 0, 0)),
      ride('sunday-before', new Date(2026, 2, 1, 23, 59)),
    ];
    expect(ridesInWeek(rides, '2026-03-02').map((r) => r.id)).toEqual([
      'monday-start',
      'sunday-night',
    ]);
  });
});
