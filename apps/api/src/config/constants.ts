import { RIDE_WAYPOINT_LIMITS } from '@motovault/types';

/** OpenAI model identifiers */
export const AI_MODELS = {
  ARTICLE_GENERATOR: 'gpt-4.1',
  TOPIC_CLASSIFIER: 'gpt-4.1-nano',
  DIAGNOSTIC: 'gpt-4.1',
  INSIGHTS: 'gpt-4.1-mini',
  RIDE_SUMMARY: 'gpt-4.1-nano',
  RECEIPT_SCAN: 'gpt-4.1',
} as const;

export type AiModel = (typeof AI_MODELS)[keyof typeof AI_MODELS];

/**
 * Per-model cost in USD per million tokens. The previous single AI_COSTS table
 * applied gpt-4.1 pricing to every model, overstating nano/mini spend 5-25x and
 * tripping the global circuit breaker early.
 */
export const MODEL_COSTS: Record<AiModel, { inputUsdPerMTok: number; outputUsdPerMTok: number }> = {
  'gpt-4.1': { inputUsdPerMTok: 2, outputUsdPerMTok: 8 },
  'gpt-4.1-mini': { inputUsdPerMTok: 0.4, outputUsdPerMTok: 1.6 },
  'gpt-4.1-nano': { inputUsdPerMTok: 0.1, outputUsdPerMTok: 0.4 },
};

/** Cost of one completion in integer cents (rounded up so spend is never undercounted). */
export function costCentsFor(model: AiModel, inputTokens: number, outputTokens: number): number {
  const { inputUsdPerMTok, outputUsdPerMTok } = MODEL_COSTS[model];
  const usd = (inputTokens * inputUsdPerMTok + outputTokens * outputUsdPerMTok) / 1_000_000;
  return Math.ceil(usd * 100);
}

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
  RECEIPT_SCAN: { limit: 5, ttl: 60_000 },
  ARTICLE_LIST: { limit: 30, ttl: 60_000 },
  SHARE_LINK: { limit: 10, ttl: 60_000 },
  WAYPOINT_UPLOAD: { limit: 10, ttl: 60_000 },
  WAYPOINT_QUERY: { limit: 30, ttl: 60_000 },
  TYPEAHEAD: { limit: 60, ttl: 60_000 },
  STANDARD: { limit: 20, ttl: 60_000 },
  FOLLOW: { limit: 50, ttl: 3_600_000 },
  KUDOS: { limit: 200, ttl: 3_600_000 },
  HEALTH_REPORT: { limit: 10, ttl: 3_600_000 },
  RIDE_SUMMARY: { limit: 20, ttl: 3_600_000 },
  COMMENT: { limit: 30, ttl: 60_000 },
  GROUP_RIDE: { limit: 10, ttl: 60_000 },
  CLONE: { limit: 10, ttl: 3_600_000 },
  DOCUMENT_UPLOAD: { limit: 30, ttl: 60_000 },
  DOCUMENT_SIGN: { limit: 120, ttl: 60_000 },
} as const;

/**
 * Document vault signed-URL TTLs (seconds), within the R16 ceilings
 * (≤60s display, ≤5min download). Signed URLs are minted on demand and never
 * persisted.
 */
export const DOCUMENT_SIGNED_URL_TTL = {
  DISPLAY: 60,
  DOWNLOAD: 300,
} as const;

/**
 * Bounds of the Postgres `real` (float4) type. Needed because Postgres does NOT
 * round a too-small magnitude down to zero — it REJECTS the whole statement with
 * SQLSTATE 22003 ("value out of range: underflow"). Any column typed REAL that
 * takes a client-supplied float has to be filtered through these.
 */
export const POSTGRES_REAL = {
  /** Smallest positive normal float4 (2^-126); anything smaller and non-zero underflows. */
  MIN_MAGNITUDE: 1.1754943508222875e-38,
  /** Largest finite float4. */
  MAX_MAGNITUDE: 3.4028234663852886e38,
} as const;

/** Query and data limits */
export const QUERY_LIMITS = {
  // Shared with the mobile recorder — see RIDE_WAYPOINT_LIMITS for why the client
  // must know this number rather than discovering it via a rejection.
  MAX_WAYPOINTS_PER_RIDE: RIDE_WAYPOINT_LIMITS.MAX_PER_RIDE,
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
