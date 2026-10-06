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
