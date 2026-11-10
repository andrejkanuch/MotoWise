/** A fix at or above this speed counts as moving. */
export const MOVING_MIN_SPEED_MPS = 1.5;

/** A longer interval between fixes is a GPS gap and is never counted as moving. */
export const MOVING_MAX_INTERVAL_S = 10;

/** The fields moving time needs from a waypoint, in recorded order. */
export interface MovingTimeFix {
  recordedAt: string;
  speedMps?: number | null;
}

/**
 * Moving time in seconds: the sum of the interval before each fix whose speed
 * is at least 1.5 m/s, counting only intervals of at most 10 s. A fix without a
 * speed reading counts as not moving. Null for empty input.
 */
export function computeTrackMovingTimeS(fixes: readonly MovingTimeFix[]): number | null {
  if (fixes.length === 0) return null;

  let movingMs = 0;
  for (let i = 1; i < fixes.length; i++) {
    const speed = fixes[i].speedMps;
    if (speed == null || speed < MOVING_MIN_SPEED_MPS) continue;
    const intervalMs = Date.parse(fixes[i].recordedAt) - Date.parse(fixes[i - 1].recordedAt);
    if (intervalMs > 0 && intervalMs <= MOVING_MAX_INTERVAL_S * 1000) movingMs += intervalMs;
  }
  return movingMs / 1000;
}

/** Average moving speed: distance over moving time. Null when either is unknown or there is no moving time. */
export function averageMovingSpeedMps(
  distanceM: number | null,
  movingTimeS: number | null,
): number | null {
  if (distanceM == null || movingTimeS == null || movingTimeS <= 0) return null;
  return distanceM / movingTimeS;
}
