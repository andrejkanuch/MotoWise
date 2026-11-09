import { rideMovingTimeS } from '../ride-moving-time';

describe('rideMovingTimeS', () => {
  it('is distance over average speed, so the two tiles agree', () => {
    // 45.6 km at 14.83 m/s: 51 min moving inside a 58 min ride.
    expect(
      rideMovingTimeS({
        distanceM: 45_594,
        avgSpeedMps: 14.8273,
        durationS: 3_509,
        autoPausedDurationS: 0,
      }),
    ).toBe(3_075);
  });

  it('falls back to the duration minus auto-pauses without an average speed', () => {
    expect(
      rideMovingTimeS({
        distanceM: 0,
        avgSpeedMps: null,
        durationS: 3_600,
        autoPausedDurationS: 600,
      }),
    ).toBe(3_000);
  });

  it('never exceeds the duration and never goes below zero', () => {
    expect(
      rideMovingTimeS({
        distanceM: 10_000,
        avgSpeedMps: 1,
        durationS: 600,
        autoPausedDurationS: 0,
      }),
    ).toBe(600);
    expect(
      rideMovingTimeS({ distanceM: 0, avgSpeedMps: 0, durationS: 100, autoPausedDurationS: 400 }),
    ).toBe(0);
  });
});
