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
  return summaryMovingTimeS({
    distanceM: ride.distanceM,
    avgSpeedMps: ride.avgSpeedMps,
    durationS,
    fallbackS: durationS - (ride.autoPausedDurationS ?? 0),
  });
}

interface SummaryMovingTimeInput {
  distanceM: number | null | undefined;
  avgSpeedMps: number | null | undefined;
  durationS: number;
  /** Used when there is no average speed to read the track moving time from. */
  fallbackS: number;
}

/**
 * The moving time the end-of-ride summary shows: the track moving time read back
 * from the average speed (as `rideMovingTimeS`), so the summary, its Avg speed
 * and the ride's detail agree. Without an average speed it is `fallbackS`.
 * Never more than the duration, never below zero.
 */
export function summaryMovingTimeS(input: SummaryMovingTimeInput): number {
  const distanceM = input.distanceM ?? 0;
  const avgSpeedMps = input.avgSpeedMps ?? 0;
  const moving =
    distanceM > 0 && avgSpeedMps > 0 ? Math.round(distanceM / avgSpeedMps) : input.fallbackS;
  return Math.min(Math.max(0, input.durationS), Math.max(0, moving));
}
