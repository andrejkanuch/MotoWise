/** Compute moving time in seconds from ride timestamps and pause durations. */
export function computeMovingTimeS(
  startedAt: string,
  endedAt: string,
  pausedDurationS: number,
  autoPausedDurationS: number,
): number {
  return Math.max(
    0,
    Math.floor((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000) -
      pausedDurationS -
      autoPausedDurationS,
  );
}
