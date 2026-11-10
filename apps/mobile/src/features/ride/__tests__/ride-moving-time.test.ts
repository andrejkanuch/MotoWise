import { rideMovingTimeS, summaryMovingTimeS } from '../ride-moving-time';

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

describe('summaryMovingTimeS', () => {
  it('shows the track moving time, as Avg speed and ride detail do', () => {
    // An hour on the clock, 48 minutes moving on the track: 28.8 km at 10 m/s.
    expect(
      summaryMovingTimeS({
        distanceM: 28_800,
        avgSpeedMps: 10,
        durationS: 3_600,
        fallbackS: 3_600,
      }),
    ).toBe(2_880);
  });

  it('agrees with the ride detail for the same ride', () => {
    const ride = { distanceM: 45_600, avgSpeedMps: 14.83, durationS: 3_480 };
    expect(summaryMovingTimeS({ ...ride, fallbackS: 3_480 })).toBe(
      rideMovingTimeS({ ...ride, autoPausedDurationS: 0 }),
    );
  });

  it('falls back to the elapsed moving time without an average speed', () => {
    expect(
      summaryMovingTimeS({ distanceM: 0, avgSpeedMps: 0, durationS: 3_600, fallbackS: 3_000 }),
    ).toBe(3_000);
  });

  it('never exceeds the duration', () => {
    expect(
      summaryMovingTimeS({ distanceM: 10_000, avgSpeedMps: 1, durationS: 600, fallbackS: 600 }),
    ).toBe(600);
  });
});
