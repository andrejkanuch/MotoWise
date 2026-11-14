jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
jest.mock('@/lib/analytics', () => require('@/test/mocks').mockAnalytics());

import { RideStatus } from '@motovault/graphql';
import { useRideStore } from '@/stores/ride.store';
import {
  buildRideGuardSnapshot,
  guardEndDiscards,
  hasRealRide,
  isBelowRideFloors,
  withLiveDistance,
} from '../ride-guard';

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

// Issue 365 T09 (FS-PO4b, D3 amended 2026-11-12).
describe('guardEndDiscards', () => {
  const snapshot = (elapsedS: number, distanceM: number) =>
    buildRideGuardSnapshot({
      elapsedS,
      distanceM,
      maxSpeedMps: 0,
      gpsFix: true,
      hasRealRide: null,
    });

  it('discards a ride under the 50 m floor, whatever its elapsed time', () => {
    expect(guardEndDiscards(snapshot(5, 0))).toBe(true);
    expect(guardEndDiscards(snapshot(90, 20))).toBe(true);
    expect(guardEndDiscards(snapshot(119, 49))).toBe(true);
  });

  it('keeps the no-GPS branch (>= 120 s) as today: the rider may still save it', () => {
    expect(guardEndDiscards(snapshot(120, 0))).toBe(false);
    expect(guardEndDiscards(snapshot(2_400, 10))).toBe(false);
  });

  it('keeps a ride over the distance floor that is only under the time floor', () => {
    expect(guardEndDiscards(snapshot(10, 80))).toBe(false);
  });
});

describe('withLiveDistance', () => {
  const snapshot = buildRideGuardSnapshot({
    elapsedS: 20,
    distanceM: 10,
    maxSpeedMps: 0,
    gpsFix: true,
    hasRealRide: null,
  });

  it('reads the distance the ride has now, so a ride past 50 m is not discarded', () => {
    useRideStore.setState({ distance: 70.4 });
    expect(withLiveDistance(snapshot).distance_m).toBe(70);
    expect(guardEndDiscards(withLiveDistance(snapshot))).toBe(false);
  });

  it('never lowers the distance the sheet showed', () => {
    useRideStore.setState({ distance: 0 });
    expect(withLiveDistance(snapshot).distance_m).toBe(10);
  });
});
