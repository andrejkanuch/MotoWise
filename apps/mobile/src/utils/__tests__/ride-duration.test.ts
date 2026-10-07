import { activeRideSeconds } from '../ride-duration';

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
