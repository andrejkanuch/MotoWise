export const MAX_MOTORCYCLE_YEAR = new Date().getFullYear() + 2;
export const MIN_MOTORCYCLE_YEAR = 1900;

export const FREE_TIER_LIMITS = {
  MAX_BIKES: 1,
  MAX_AI_DIAGNOSTICS_PER_MONTH: 1,
  MAX_ARTICLES_PER_MONTH: 2,
  MAX_MILEAGE: 999999,
  // Receipt scan (U5): 3 free scans per calendar month. Server-side counting
  // is authoritative (receiptScanQuota); this is the client gate limit. Mirror
  // of reserve_receipt_scan's p_monthly_limit default (00166).
  MAX_RECEIPT_SCANS_PER_MONTH: 3,
} as const;

export const GPX_EXPORT_LIMITS = {
  /** Free-tier users: 1 GPX export per month (taste-then-convert model) */
  FREE_MONTHLY_EXPORTS: 1,
  /** Pro-tier users: unlimited (use -1 sentinel) */
  PRO_MONTHLY_EXPORTS: -1,
} as const;

export const AI_FEATURE_LIMITS = {
  /** Free-tier users: trip assistant questions allowed per month */
  FREE_TRIP_ASSISTANT_QUESTIONS_PER_MONTH: 3,
  /** Free-tier users: AI ride summaries generated per month */
  FREE_RIDE_SUMMARIES_PER_MONTH: 2,
} as const;

export const PRO_FEATURES = {
  UNLIMITED_BIKES: 'unlimited_bikes',
  UNLIMITED_ARTICLES: 'unlimited_articles',
  FULL_AI_DIAGNOSTICS: 'full_ai_diagnostics',
  MAINTENANCE_REMINDERS: 'maintenance_reminders',
  GPX_EXPORT: 'gpx_export',
  TRIP_ASSISTANT: 'trip_assistant',
  RIDE_SUMMARIES: 'ride_summaries',
  OFFLINE_TRIPS: 'offline_trips',
  UNLIMITED_SCANS: 'unlimited_scans',
} as const;

export type ProFeature = (typeof PRO_FEATURES)[keyof typeof PRO_FEATURES];

/** Maximum decoded image size for diagnostic uploads (5 MB) */
export const MAX_DIAGNOSTIC_IMAGE_BYTES = 5 * 1024 * 1024;

/** Maximum base64 string length for diagnostic uploads (~6.7 MB base64 = ~5 MB decoded) */
export const MAX_DIAGNOSTIC_IMAGE_BASE64_LENGTH = Math.ceil(MAX_DIAGNOSTIC_IMAGE_BYTES / 3) * 4;

/**
 * GPS waypoint budgets for one recorded ride. Shared because the server enforces
 * `MAX_PER_RIDE` as a hard abuse guard, which makes it a client constraint too: a
 * batch the cap rejects can never be accepted, so a recorder that keeps producing
 * them mints a fresh permanently-failing payload every chunk for the rest of the
 * ride. That is the whole of Sentry MOTO-VAULT-REACT-NATIVE-1M — 351 of its 391
 * events came from ONE rider on ONE long ride, one per rejected chunk. Both sides
 * must read the same number or the client cannot know where to stop.
 */
export const RIDE_WAYPOINT_LIMITS = {
  /** Hard cap on stored waypoints for a single ride (RidesService.uploadWaypoints). */
  MAX_PER_RIDE: 10_000,
  /** Most waypoints one `uploadWaypoints` mutation will accept (UploadWaypointsInputSchema). */
  MAX_PER_UPLOAD: 500,
} as const;

/**
 * Bounds on the mobile ride sync queue's DEAD-LETTER store (`ride-sync-queue.ts`).
 *
 * The dead-letter queue had no cap, no TTL and no eviction: it grew forever, and
 * the whole array is JSON.parse'd + JSON.stringify'd on every dead-letter, on the
 * ride hot path. One rider reached 107 parked ops — each `uploadWaypoints` entry
 * carrying up to `RIDE_WAYPOINT_LIMITS.MAX_PER_UPLOAD` full Waypoint objects — and
 * because `clearDeliveredQueue` refuses to run while anything is pending, those
 * entries also permanently disabled queue cleanup for that install.
 *
 * MAX_DEAD_LETTER_OPS is deliberately generous: an eviction is UNAMBIGUOUS,
 * irreversible rider data loss (the dead-letter payload is the only remaining copy
 * — local waypoint chunks are dropped once enqueued), so the cap exists to stop
 * unbounded growth, not to ration storage. A fully stranded 10,000-waypoint ride is
 * ~20 ops at MAX_PER_UPLOAD, so 200 holds several whole lost rides before anything
 * is discarded.
 */
export const RIDE_SYNC_LIMITS = {
  /** Most ops the dead-letter queue retains; oldest-first eviction beyond it. */
  MAX_DEAD_LETTER_OPS: 200,
} as const;

/**
 * Rider-count bounds on a trip. Shared because THREE places must agree:
 *   - the Zod bounds in `validators/trip.ts` (Create / CreateWithWaypoints / Update)
 *   - `trips_max_riders_check` on `public.trips` (`BETWEEN 1 AND 50` since
 *     migration `00179_allow_solo_trips_max_riders`)
 *   - the mobile create/edit-trip form (`apps/mobile/src/utils/trip-max-riders.ts`)
 *
 * MIN is 1 because a solo trip is a supported plan — `trip-completeness.ts` treats
 * `maxRiders <= 1` as complete. Moving one side alone is exactly what produced
 * MOTO-VAULT-NODE-NESTJS-K: Zod accepted 1, Postgres refused it, and every solo
 * trip creation returned a 500. A comment asking the next person to keep three
 * copies in sync is what allowed that drift; one exported constant removes it.
 */
export const TRIP_MAX_RIDERS = {
  MIN: 1,
  MAX: 50,
  /** Pre-filled in the create-trip form; not a validation bound. */
  DEFAULT: 10,
} as const;

export const AI_BUDGET_LIMITS = {
  /** Maximum AI generations per day for free-tier users */
  FREE_DAILY_GENERATIONS: 50,
  /** Maximum AI generations per day for Pro-tier users */
  PRO_DAILY_GENERATIONS: 200,
  /** Global daily spend cap in cents before circuit breaker trips ($50) */
  GLOBAL_DAILY_SPEND_CAP_CENTS: 5000,
} as const;
