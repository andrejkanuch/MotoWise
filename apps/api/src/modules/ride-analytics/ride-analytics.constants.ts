/** Sentinel UUID for "all bikes" aggregate in rollups + records. */
export const ALL_BIKES_SENTINEL = '00000000-0000-0000-0000-000000000000';

/** Minimum distance (meters) for a ride to count as "real" for analytics. */
export const MIN_RIDE_DISTANCE_M = 500;

/** Minimum moving time (seconds) for a ride to count as "real" for analytics. */
export const MIN_RIDE_MOVING_TIME_S = 60;

/** Speed band thresholds in m/s (converted from km/h). */
export const SPEED_BANDS = {
  /** 0–50 km/h */
  URBAN_MAX_MPS: 50 / 3.6,
  /** 50–110 km/h */
  CRUISE_MAX_MPS: 110 / 3.6,
  /** 110–160 km/h */
  SPIRITED_MAX_MPS: 160 / 3.6,
  /** 160+ km/h = silly */
} as const;
