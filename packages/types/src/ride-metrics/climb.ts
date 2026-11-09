/** Altitude changes smaller than this are treated as GPS noise, not climb. */
export const CLIMB_HYSTERESIS_M = 5;

/** Each altitude is replaced by the median of itself and two readings either side. */
const MEDIAN_WINDOW_RADIUS = 2;

/**
 * Median of 5. Near either end the window is cut off rather than shrunk to the
 * reading itself, so a cold-start altitude spike on the first fix is filtered
 * too, at the cost of a metre or two of climb at the very ends of a ride.
 */
function medianFilter(values: readonly number[]): number[] {
  return values.map((_, i) => {
    const window = values
      .slice(Math.max(0, i - MEDIAN_WINDOW_RADIUS), i + MEDIAN_WINDOW_RADIUS + 1)
      .sort((a, b) => a - b);
    return window[Math.floor(window.length / 2)];
  });
}

/**
 * Total climb in metres: a median-of-5 filter over the altitudes, then a 5 m
 * hysteresis, so noise and small wobbles never add up to phantom climb.
 * Missing readings are skipped; null when there is no altitude at all.
 */
export function computeClimbM(altitudes: ReadonlyArray<number | null | undefined>): number | null {
  const readings = altitudes.filter(
    (altitude): altitude is number => typeof altitude === 'number' && Number.isFinite(altitude),
  );
  if (readings.length === 0) return null;

  const filtered = medianFilter(readings);
  let reference = filtered[0];
  let climb = 0;
  for (const altitude of filtered) {
    if (altitude - reference >= CLIMB_HYSTERESIS_M) {
      climb += altitude - reference;
      reference = altitude;
    } else if (reference - altitude >= CLIMB_HYSTERESIS_M) {
      reference = altitude;
    }
  }
  return climb;
}
