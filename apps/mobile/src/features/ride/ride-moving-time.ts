interface MovingTimeInput {
  distanceM: number | null | undefined;
  avgSpeedMps: number | null | undefined;
  durationS: number | null | undefined;
  autoPausedDurationS: number | null | undefined;
}

/**
 * A ride's moving time in seconds. The server's average speed is distance over
 * moving time, so moving time is read back from it and the "Moving" and
 * "Avg speed" tiles always agree. Without an average speed it is the duration
 * minus auto-pauses. Never more than the duration, never below zero.
 */
export function rideMovingTimeS(ride: MovingTimeInput): number {
  const durationS = Math.max(0, ride.durationS ?? 0);
  const distanceM = ride.distanceM ?? 0;
  const avgSpeedMps = ride.avgSpeedMps ?? 0;
  const moving =
    distanceM > 0 && avgSpeedMps > 0
      ? Math.round(distanceM / avgSpeedMps)
      : durationS - (ride.autoPausedDurationS ?? 0);
  return Math.min(durationS, Math.max(0, moving));
}
