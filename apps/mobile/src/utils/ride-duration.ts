const MS_PER_SECOND = 1000;

export interface RideClock {
  /** Epoch ms the ride started; undefined when no ride is recorded. */
  startedAt: number | undefined;
  /** Manual pause time already banked, in ms. */
  totalPausedMs: number;
  /** Epoch ms a manual pause in progress began; 0 when not paused. */
  pausedAt: number;
}

/**
 * Riding seconds between the start and `endAt`, minus banked pauses and any pause
 * still in progress at `endAt`. Pure, so the HUD clock, a normal end and the
 * headless auto-end all measure a ride the same way.
 */
export function activeRideSeconds(clock: RideClock, endAt: number): number {
  if (!clock.startedAt) return 0;
  const inProgressPauseMs = clock.pausedAt > 0 ? Math.max(0, endAt - clock.pausedAt) : 0;
  const pausedMs = clock.totalPausedMs + inProgressPauseMs;
  return Math.max(0, Math.round((endAt - clock.startedAt - pausedMs) / MS_PER_SECOND));
}

/**
 * Moving time exactly as the API computes it (`computeMovingTimeS` in
 * ride-analytics.utils.ts): whole elapsed seconds, floored, minus the rounded
 * manual and auto pause seconds the phone sends with EndRide. `activeRideSeconds`
 * rounds instead, so a ride can read 180 s on the summary and 179 s on the server;
 * the ride-moment paywall rule (plan R1) must be applied to the server's number.
 */
export function movingTimeSeconds(
  startedAt: number,
  endedAt: number,
  totalPausedMs: number,
  totalAutoPausedMs: number,
): number {
  return Math.max(
    0,
    Math.floor((endedAt - startedAt) / MS_PER_SECOND) -
      Math.round(totalPausedMs / MS_PER_SECOND) -
      Math.round(totalAutoPausedMs / MS_PER_SECOND),
  );
}
