import { describe, expect, it } from 'vitest';
import { isQualifyingRide, type QualifyingRideInput } from '../qualifying';

// 12 km in 25 minutes, ended by the app (server-end reason left null).
const appAutoEnded: QualifyingRideInput = {
  status: 'completed',
  deletedAt: null,
  autoEndedReason: null,
  distanceM: 12_000,
  startedAt: '2026-10-10T10:00:00Z',
  endedAt: '2026-10-10T10:25:00Z',
  pausedDurationS: 0,
  autoPausedDurationS: 0,
};

describe('isQualifyingRide', () => {
  it('counts an app-auto-ended ride (null auto_ended_reason, 12 km, 25 min)', () => {
    expect(isQualifyingRide(appAutoEnded)).toBe(true);
  });

  it('does not count an idle-swept ride', () => {
    expect(isQualifyingRide({ ...appAutoEnded, autoEndedReason: 'idle_timeout' })).toBe(false);
  });

  it('does not count a ride that is still open or deleted', () => {
    expect(isQualifyingRide({ ...appAutoEnded, status: 'recording' })).toBe(false);
    expect(isQualifyingRide({ ...appAutoEnded, status: 'paused' })).toBe(false);
    expect(isQualifyingRide({ ...appAutoEnded, deletedAt: '2026-10-11T08:00:00Z' })).toBe(false);
  });

  it('needs at least 1 km, and an unknown distance never counts', () => {
    expect(isQualifyingRide({ ...appAutoEnded, distanceM: 1_000 })).toBe(true);
    expect(isQualifyingRide({ ...appAutoEnded, distanceM: 999 })).toBe(false);
    expect(isQualifyingRide({ ...appAutoEnded, distanceM: null })).toBe(false);
  });

  it('needs 180 s of ended minus started minus manual and auto pauses', () => {
    const fourMinutes = { ...appAutoEnded, endedAt: '2026-10-10T10:04:00Z' };

    // 240 s elapsed less 90 s paused: 150 s, under the floor.
    expect(isQualifyingRide({ ...fourMinutes, pausedDurationS: 90 })).toBe(false);
    expect(isQualifyingRide({ ...fourMinutes, autoPausedDurationS: 90 })).toBe(false);
    // Exactly 180 s counts.
    expect(isQualifyingRide({ ...fourMinutes, pausedDurationS: 30, autoPausedDurationS: 30 })).toBe(
      true,
    );
    expect(isQualifyingRide({ ...appAutoEnded, endedAt: '2026-10-10T10:02:59Z' })).toBe(false);
  });

  it('reads null pause columns as no pause', () => {
    expect(
      isQualifyingRide({ ...appAutoEnded, pausedDurationS: null, autoPausedDurationS: null }),
    ).toBe(true);
  });

  it('never counts a ride without both timestamps', () => {
    expect(isQualifyingRide({ ...appAutoEnded, endedAt: null })).toBe(false);
    expect(isQualifyingRide({ ...appAutoEnded, startedAt: null })).toBe(false);
  });
});
