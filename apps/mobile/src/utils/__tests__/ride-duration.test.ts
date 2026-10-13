import { activeRideSeconds, movingTimeSeconds } from '../ride-duration';

const START = 1_000_000;

describe('activeRideSeconds', () => {
  it('is 0 without a start', () => {
    expect(activeRideSeconds({ startedAt: undefined, totalPausedMs: 0, pausedAt: 0 }, START)).toBe(
      0,
    );
  });

  it('subtracts banked pauses and clamps at 0', () => {
    const clock = { startedAt: START, totalPausedMs: 30_000, pausedAt: 0 };
    expect(activeRideSeconds(clock, START + 90_000)).toBe(60);
    expect(activeRideSeconds(clock, START - 5_000)).toBe(0);
  });

  it('subtracts a pause still in progress at the end time', () => {
    const clock = { startedAt: START, totalPausedMs: 0, pausedAt: START + 60_000 };
    expect(activeRideSeconds(clock, START + 90_000)).toBe(60);
  });

  it('ignores a pause that began after the end time (trimmed end)', () => {
    const clock = { startedAt: START, totalPausedMs: 0, pausedAt: START + 120_000 };
    expect(activeRideSeconds(clock, START + 90_000)).toBe(90);
  });
});

describe('movingTimeSeconds', () => {
  /** The API's computeMovingTimeS (ride-analytics.utils.ts), which the phone must match (plan R1). */
  const apiMovingTimeS = (
    startedAt: number,
    endedAt: number,
    pausedS: number,
    autoPausedS: number,
  ) => Math.max(0, Math.floor((endedAt - startedAt) / 1000) - pausedS - autoPausedS);

  it('floors elapsed seconds before subtracting pauses, like the API', () => {
    // 179.6 s elapsed: the displayed clock rounds up to 180 s (qualifying), the
    // API floors to 179 s (not qualifying). The paywall rule must use the API's.
    const startedAt = 1_000_000;
    const endedAt = startedAt + 179_600;
    expect(activeRideSeconds({ startedAt, totalPausedMs: 0, pausedAt: 0 }, endedAt)).toBe(180);
    expect(movingTimeSeconds(startedAt, endedAt, 0, 0)).toBe(179);
    expect(movingTimeSeconds(startedAt, endedAt, 0, 0)).toBe(
      apiMovingTimeS(startedAt, endedAt, 0, 0),
    );
  });

  it('subtracts the rounded manual and auto pauses the phone sends with EndRide', () => {
    const startedAt = 0;
    const endedAt = 240_000;
    const pausedMs = 30_400; // -> 30 s
    const autoPausedMs = 90_600; // -> 91 s
    expect(movingTimeSeconds(startedAt, endedAt, pausedMs, autoPausedMs)).toBe(240 - 30 - 91);
    expect(movingTimeSeconds(startedAt, endedAt, pausedMs, autoPausedMs)).toBe(
      apiMovingTimeS(
        startedAt,
        endedAt,
        Math.round(pausedMs / 1000),
        Math.round(autoPausedMs / 1000),
      ),
    );
  });

  it('never goes negative', () => {
    expect(movingTimeSeconds(0, 30_000, 0, 90_000)).toBe(0);
  });
});
