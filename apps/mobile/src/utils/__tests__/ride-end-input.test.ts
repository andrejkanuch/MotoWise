import { computeClimbM, RIDE_END_SOURCE, type Waypoint } from '@motovault/types';
import { aggregateWaypoints } from '../ride-aggregate';
import { buildRideEndInput } from '../ride-end-input';

const T0 = Date.parse('2026-06-28T10:00:00.000Z');

/** One fix a second heading north at `speedMps`, ~11 m apart (0.0001° latitude). */
function track(altitudes: readonly (number | null)[], speedMps = 11): Waypoint[] {
  return altitudes.map((altitude, i) => ({
    latitude: 50 + i * 0.0001,
    longitude: 14,
    altitude,
    speedMps,
    recordedAt: new Date(T0 + i * 1000).toISOString(),
  }));
}

describe('buildRideEndInput', () => {
  const base = {
    rideId: 'ride-1',
    endedAtMs: T0 + 60_000,
    pausedMs: 12_400,
    autoPausedMs: 61_600,
  };

  it('sends max speed, climb, descent and distance-over-moving-time speed from the waypoints', () => {
    // Climbs 0 → 30 m and back down to 10 m. The median-of-5 filter flattens the
    // single 30 m peak to 28, so the climb is 28 m and the descent 18 m.
    const waypoints = track([0, 0, 10, 20, 30, 28, 30, 20, 10, 10, 10]);
    waypoints[4] = { ...waypoints[4], speedMps: 25 };

    const { input } = buildRideEndInput({
      ...base,
      waypoints,
      endSource: RIDE_END_SOURCE.CLIENT_AUTO,
    });

    expect(input).toMatchObject({
      rideId: 'ride-1',
      endedAt: new Date(T0 + 60_000).toISOString(),
      maxSpeedMps: 25,
      elevationGain: 28,
      elevationLoss: 18,
      pausedDurationS: 12,
      autoPausedDurationS: 62,
      endSource: 'client_auto',
    });
    // 10 intervals of ~11.1 m covered in 10 s of moving time.
    expect(input.distanceM).toBe(111);
    expect(input.avgSpeedMps).toBeCloseTo(11.12, 1);
    expect(typeof input.routePolyline).toBe('string');
  });

  it('never sends a constant GPS quality or a lean angle', () => {
    const { input } = buildRideEndInput({
      ...base,
      waypoints: track([0, 0, 0]),
      endSource: RIDE_END_SOURCE.RIDER_PHONE,
    });
    expect(input).not.toHaveProperty('gpsQuality');
    expect(input).not.toHaveProperty('maxLeanAngle');
  });

  it('leaves stats it cannot know empty instead of zero, so the server keeps what it has', () => {
    const { input } = buildRideEndInput({
      ...base,
      waypoints: [],
      endSource: RIDE_END_SOURCE.RIDER_CARPLAY,
    });
    expect(input).toMatchObject({
      distanceM: 0,
      maxSpeedMps: null,
      avgSpeedMps: null,
      elevationGain: null,
      elevationLoss: null,
      routePolyline: null,
      endSource: 'rider_carplay',
    });
  });
});

describe('aggregateWaypoints — shared ride metrics', () => {
  it("reports the same climb as the server's metric for the same waypoints", () => {
    const altitudes = [100, 103, 101, 108, 112, 111, 119, 121, 118, 125, 124, 130];
    const totals = aggregateWaypoints(track(altitudes));
    expect(totals.elevationGain).toBe(computeClimbM(altitudes));
  });

  it('ignores altitude noise under 5 m', () => {
    const totals = aggregateWaypoints(track([100, 103, 100, 104, 100, 103, 100]));
    expect(totals.elevationGain).toBe(0);
    expect(totals.elevationLoss).toBe(0);
  });

  it('has no climb when no fix carries an altitude', () => {
    const totals = aggregateWaypoints(track([null, null, null]));
    expect(totals.elevationGain).toBeNull();
    expect(totals.elevationLoss).toBeNull();
  });

  it('averages speed as distance over moving time, not over every speed sample', () => {
    // Moving at 10 m/s for 4 s, then 6 fixes standing still (speed 0.2): the old
    // mean of non-zero samples would land near 4 m/s.
    const moving = track([0, 0, 0, 0, 0], 10);
    const parked = track([0, 0, 0, 0, 0, 0], 0.2).map((wp, i) => ({
      ...wp,
      latitude: moving[4].latitude,
      recordedAt: new Date(T0 + (5 + i) * 1000).toISOString(),
    }));
    const totals = aggregateWaypoints([...moving, ...parked]);
    expect(totals.movingTimeS).toBe(4);
    expect(totals.avgSpeedMps).toBeCloseTo(totals.distanceM / 4, 6);
  });
});
