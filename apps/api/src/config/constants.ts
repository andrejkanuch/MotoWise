/** OpenAI model identifiers */
export const AI_MODELS = {
  ARTICLE_GENERATOR: 'gpt-4.1',
  TOPIC_CLASSIFIER: 'gpt-4.1-nano',
  DIAGNOSTIC: 'gpt-4.1',
  INSIGHTS: 'gpt-4.1-mini',
} as const;

/** OpenAI API client defaults */
export const AI_CLIENT = {
  MAX_RETRIES: 3,
  TIMEOUT_MS: 60_000,
  INSIGHTS_TIMEOUT_MS: 10_000,
} as const;

/** Token limits per model call */
export const AI_TOKEN_LIMITS = {
  TOPIC_CLASSIFIER_MAX_TOKENS: 100,
  ARTICLE_MAX_TOKENS: 4096,
  DIAGNOSTIC_MAX_TOKENS: 2048,
} as const;

/** Cost per million tokens in cents (gpt-4.1 pricing) */
export const AI_COSTS = {
  INPUT_COST_PER_MTOK: 3,
  OUTPUT_COST_PER_MTOK: 12,
  /** Divisor to convert (tokens * cost_per_mtok) → cents */
  MTOK_DIVISOR: 10_000,
} as const;

/** Read time calculation */
export const CONTENT = {
  WORDS_PER_MINUTE: 200,
  TOPIC_MAX_LENGTH: 200,
} as const;

/** Per-resolver throttle presets (limit, ttl in ms) */
export const THROTTLE_PRESETS = {
  WEBHOOK: { limit: 30, ttl: 60_000 },
  WAITLIST: { limit: 3, ttl: 60_000 },
  AI_GENERATION: { limit: 5, ttl: 60_000 },
  AI_DIAGNOSTIC: { limit: 3, ttl: 60_000 },
  AI_INSIGHTS: { limit: 3, ttl: 60_000 },
  ARTICLE_LIST: { limit: 30, ttl: 60_000 },
  SHARE_LINK: { limit: 10, ttl: 60_000 },
  WAYPOINT_UPLOAD: { limit: 10, ttl: 60_000 },
  WAYPOINT_QUERY: { limit: 30, ttl: 60_000 },
  STANDARD: { limit: 20, ttl: 60_000 },
  FOLLOW: { limit: 50, ttl: 3_600_000 },
  KUDOS: { limit: 200, ttl: 3_600_000 },
  HEALTH_REPORT: { limit: 10, ttl: 3_600_000 },
  RIDE_SUMMARY: { limit: 20, ttl: 3_600_000 },
  COMMENT: { limit: 30, ttl: 60_000 },
} as const;

/** Query and data limits */
export const QUERY_LIMITS = {
  MAX_WAYPOINTS_PER_RIDE: 10_000,
  MAX_EXPENSES_PER_QUERY: 5_000,
  MAX_EXPORT_ROWS_PER_TABLE: 10_000,
  DEFAULT_MAINTENANCE_HISTORY_LIMIT: 100,
  WAYPOINT_QUERY_DEFAULT: 300,
  WAYPOINT_QUERY_MAX: 1_000,
  WAYPOINT_ACCURACY_THRESHOLD: 100,
} as const;

/** Duration constants */
export const DURATIONS = {
  ONE_DAY_MS: 86_400_000,
  ONE_WEEK_MS: 7 * 86_400_000,
  CIRCUIT_BREAKER_EXPIRE_SECONDS: 86_400,
} as const;

/** Input validation ranges */
export const VALIDATION = {
  MIN_YEAR: 2000,
  MAX_YEAR: 2100,
  MIN_BIKE_YEAR: 1900,
  MAX_BIKE_YEAR: 2030,
  MAX_MILEAGE: 999_999,
  MAX_INSIGHT_FIELD_LENGTH: 100,
} as const;
