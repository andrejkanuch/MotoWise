jest.mock('@/lib/analytics', () => require('@/test/mocks').mockAnalytics());

import { RideStatus } from '@motovault/graphql';
import { buildRideGuardSnapshot, hasRealRide, isBelowRideFloors } from '../ride-guard';

function page(
  nodes: { status: RideStatus; durationS: number | null; distanceM: number | null }[],
  hasNextPage = false,
) {
  return {
    myRides: {
      edges: nodes.map((node) => ({ node })),
      pageInfo: { hasNextPage },
      totalCount: nodes.length,
    },
  };
}

const REAL = { status: RideStatus.Completed, durationS: 600, distanceM: 5_000 };
const JUNK = { status: RideStatus.Completed, durationS: 10, distanceM: 2 };

describe('hasRealRide', () => {
  it('is unknown with nothing cached', () => {
    expect(hasRealRide([undefined, undefined])).toBeNull();
  });

  it('is true once any page shows a completed ride over both floors', () => {
    expect(hasRealRide([page([JUNK], true), page([REAL], true)])).toBe(true);
  });

  it('is false only when a page holds the whole history', () => {
    expect(hasRealRide([page([])])).toBe(false);
    expect(hasRealRide([page([JUNK])])).toBe(false);
    expect(hasRealRide([page([JUNK], true)])).toBeNull();
  });

  it('ignores rides still recording and rides with null totals', () => {
    expect(
      hasRealRide([
        page([
          { ...REAL, status: RideStatus.Recording },
          { status: RideStatus.Completed, durationS: null, distanceM: null },
        ]),
      ]),
    ).toBe(false);
  });
});

describe('buildRideGuardSnapshot', () => {
  it('rounds distance and converts max speed to km/h with one decimal', () => {
    expect(
      buildRideGuardSnapshot({
        elapsedS: 41,
        distanceM: 12.6,
        maxSpeedMps: 4.17,
        gpsFix: true,
        hasRealRide: false,
      }),
    ).toEqual({
      elapsed_s: 41,
      distance_m: 13,
      gps_fix: true,
      max_speed_kmh: 15,
      has_real_ride: false,
      variant: 'default',
    });
  });

  it('matches the floors the HUD guards on', () => {
    expect(isBelowRideFloors(29, 5_000)).toBe(true);
    expect(isBelowRideFloors(600, 49)).toBe(true);
    expect(isBelowRideFloors(30, 50)).toBe(false);
  });
});
