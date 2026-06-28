import { z } from 'zod';
import { nullishToUndefined } from './nullish';

// --- Trip Difficulty ---

export const TRIP_DIFFICULTY = {
  EASY: 'easy',
  MODERATE: 'moderate',
  CHALLENGING: 'challenging',
  EXPERT: 'expert',
} as const;

export const TripDifficultySchema = z.enum(['easy', 'moderate', 'challenging', 'expert']);
export type TripDifficulty = z.infer<typeof TripDifficultySchema>;

// --- Trip Status ---

export const TRIP_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
} as const;

export const TripStatusSchema = z.enum(['draft', 'published', 'active', 'completed', 'archived']);
export type TripStatus = z.infer<typeof TripStatusSchema>;

// --- Trip Planning Mode ---

export const TRIP_PLANNING_MODE = {
  DAY: 'day',
  OVERNIGHT: 'overnight',
  MULTI: 'multi',
} as const;

export const TripPlanningModeSchema = z.enum(['day', 'overnight', 'multi']);
export type TripPlanningMode = z.infer<typeof TripPlanningModeSchema>;

// --- Surface Type ---
// Unified — previously also in route.ts. Re-exported from route.ts for backward compat.

export const SURFACE_TYPES = {
  PAVED: 'paved',
  MIXED: 'mixed',
  OFF_ROAD: 'off-road',
  UNKNOWN: 'unknown',
} as const;

export const SurfaceTypeSchema = z.enum(['paved', 'mixed', 'off-road', 'unknown']);
export type SurfaceType = z.infer<typeof SurfaceTypeSchema>;

/** Accepts both DB values ('off-road') and GraphQL enum keys ('off_road'), normalises to DB form. */
export const SurfaceTypeInputSchema = z
  .enum(['paved', 'mixed', 'off-road', 'off_road', 'unknown'])
  .transform((v) => (v === 'off_road' ? 'off-road' : v) as SurfaceType);

// --- Waypoint Type ---
// Must match the CHECK constraint on trip_waypoints.type (migration 00072).

export const WAYPOINT_TYPE = {
  START: 'start',
  END: 'end',
  STOP: 'stop',
  FUEL: 'fuel',
  FOOD: 'food',
  OVERNIGHT: 'overnight',
  SCENIC: 'scenic',
  PHOTO: 'photo',
  MECHANICAL: 'mechanical',
  FERRY: 'ferry',
  PASS_SUMMIT: 'pass_summit',
  RALLY_POINT: 'rally_point',
} as const;

export const WaypointTypeSchema = z.enum([
  'start',
  'end',
  'stop',
  'fuel',
  'food',
  'overnight',
  'scenic',
  'photo',
  'mechanical',
  'ferry',
  'pass_summit',
  'rally_point',
]);
export type WaypointType = z.infer<typeof WaypointTypeSchema>;

// --- Period of Day ---

export const PERIOD_OF_DAY = {
  MORNING: 'morning',
  AFTERNOON: 'afternoon',
  EVENING: 'evening',
} as const;

export const PeriodOfDaySchema = z.enum(['morning', 'afternoon', 'evening']);
export type PeriodOfDay = z.infer<typeof PeriodOfDaySchema>;

// --- Participant Role ---

export const PARTICIPANT_ROLE = {
  ORGANIZER: 'organizer',
  RIDER: 'rider',
  CO_PLANNER: 'co_planner',
} as const;

export const ParticipantRoleSchema = z.enum(['organizer', 'rider', 'co_planner']);
export type ParticipantRole = z.infer<typeof ParticipantRoleSchema>;

// --- Trip Suggestion Kind ---

export const TRIP_SUGGESTION_KIND = {
  WAYPOINT: 'waypoint',
  NOTE: 'note',
} as const;

export const TripSuggestionKindSchema = z.enum(['waypoint', 'note']);
export type TripSuggestionKind = z.infer<typeof TripSuggestionKindSchema>;

// --- Trip Suggestion Status ---

export const TRIP_SUGGESTION_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
} as const;

export const TripSuggestionStatusSchema = z.enum(['pending', 'accepted', 'rejected', 'withdrawn']);
export type TripSuggestionStatus = z.infer<typeof TripSuggestionStatusSchema>;

// --- Trip Suggestion Decision ---
// Subset of status — only the outcomes an actor can explicitly apply.

export const TRIP_SUGGESTION_DECISION = {
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
} as const;

export const TripSuggestionDecisionSchema = z.enum(['accepted', 'rejected', 'withdrawn']);
export type TripSuggestionDecision = z.infer<typeof TripSuggestionDecisionSchema>;

// --- Assistant Message Role ---
// Role labels for the trip-planning assistant chat thread.

export const ASSISTANT_MESSAGE_ROLE = {
  USER: 'user',
  ASSISTANT: 'assistant',
} as const;

export const AssistantMessageRoleSchema = z.enum(['user', 'assistant']);
export type AssistantMessageRole = z.infer<typeof AssistantMessageRoleSchema>;

// --- Participant Status ---

export const PARTICIPANT_STATUS = {
  INVITED: 'invited',
  GOING: 'going',
  MAYBE: 'maybe',
  DECLINED: 'declined',
} as const;

export const ParticipantStatusSchema = z.enum(['invited', 'going', 'maybe', 'declined']);
export type ParticipantStatus = z.infer<typeof ParticipantStatusSchema>;

// --- Trip Visibility ---

export const TripVisibilitySchema = z.enum(['private', 'unlisted', 'public']);
export type TripVisibility = z.infer<typeof TripVisibilitySchema>;

// --- Condition Tags (unified from route-review.ts) ---

export const CONDITION_TAGS = {
  GOOD_SURFACE: 'Good Surface',
  GRAVEL_HAZARD: 'Gravel Hazard',
  CONSTRUCTION: 'Construction',
  LOW_TRAFFIC: 'Low Traffic',
  HEAVY_TRAFFIC: 'Heavy Traffic',
  SCENIC: 'Scenic',
  TECHNICAL_CURVES: 'Technical Curves',
} as const;

export const ConditionTagSchema = z.enum([
  'Good Surface',
  'Gravel Hazard',
  'Construction',
  'Low Traffic',
  'Heavy Traffic',
  'Scenic',
  'Technical Curves',
]);
export type ConditionTag = z.infer<typeof ConditionTagSchema>;

// --- Date range constants (trip planning window) ---

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PAST_DAYS = 365; // startDate cannot be more than 1 year in the past
const MAX_FUTURE_DAYS = 5 * 365; // endDate cannot be more than 5 years in the future
const MAX_TRIP_SPAN_DAYS = 365; // maximum trip duration

type TripDateRangeOptions = {
  /**
   * When true (default), startDate must be within the last `MAX_PAST_DAYS`.
   * Set false for **update** mutation: templates use placeholder dates (e.g. epoch);
   * organisers may also adjust older planned trips without re-creating them.
   */
  enforceStartNotTooFarInPast?: boolean;
  /**
   * When true (default for create), startDate must not be later than `MAX_FUTURE_DAYS` from now.
   * Set false for **update** (same reasons as `enforceStartNotTooFarInPast`).
   */
  enforceStartNotTooFarInFuture?: boolean;
};

/**
 * Validates that a start/end date pair (as ISO date strings) falls within
 * the allowed planning window and the overall trip span is bounded.
 * Reports errors via a Zod `ctx` so callers can plug it into `superRefine`.
 */
function validateTripDateRange(
  ctx: z.RefinementCtx,
  startDate: string | undefined,
  endDate: string | undefined,
  options: TripDateRangeOptions = {},
): void {
  const { enforceStartNotTooFarInPast = true, enforceStartNotTooFarInFuture = true } = options;
  if (!startDate && !endDate) return;

  const now = Date.now();
  const minStart = now - MAX_PAST_DAYS * ONE_DAY_MS;
  const maxStart = now + MAX_FUTURE_DAYS * ONE_DAY_MS;
  const maxEnd = now + MAX_FUTURE_DAYS * ONE_DAY_MS;

  let startMs: number | undefined;
  let endMs: number | undefined;

  if (startDate) {
    startMs = Date.parse(startDate);
    if (Number.isNaN(startMs)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'startDate is not a valid date',
        path: ['startDate'],
      });
      return;
    }
    if (enforceStartNotTooFarInPast && startMs < minStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'startDate cannot be more than 1 year in the past',
        path: ['startDate'],
      });
    }
    if (enforceStartNotTooFarInFuture && startMs > maxStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'startDate cannot be more than 5 years in the future',
        path: ['startDate'],
      });
    }
  }

  if (endDate) {
    endMs = Date.parse(endDate);
    if (Number.isNaN(endMs)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endDate is not a valid date',
        path: ['endDate'],
      });
      return;
    }
    if (endMs > maxEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endDate cannot be more than 5 years in the future',
        path: ['endDate'],
      });
    }
  }

  if (startMs !== undefined && endMs !== undefined) {
    if (endMs < startMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endDate must be on or after startDate',
        path: ['endDate'],
      });
      return;
    }
    const spanDays = (endMs - startMs) / ONE_DAY_MS;
    if (spanDays > MAX_TRIP_SPAN_DAYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Trip span cannot exceed ${MAX_TRIP_SPAN_DAYS} days`,
        path: ['endDate'],
      });
    }
  }
}

// --- Helpers ---

/** Strip HTML tags from user-provided text (XSS prevention for JSONB content rendered on web) */
const stripHtml = (v: string) => v.replace(/<[^>]*>/g, '');

// --- Inline Waypoint (used in create/update trip batch) ---

const InlineWaypointSchema = z.object({
  type: WaypointTypeSchema,
  name: z.string().min(1).max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  notes: nullishToUndefined(z.string().max(1000)),
  sortOrder: z.number().int().min(0).max(1000),
  dayIndex: z.number().int().min(0).max(365).default(0),
  /** @deprecated kept for backward compat — optional on new data */
  periodOfDay: PeriodOfDaySchema.nullable().optional(),
});

type InlineWaypoint = z.infer<typeof InlineWaypointSchema>;

/**
 * Create-trip-with-waypoints: if any waypoints are sent, require a minimal routable set.
 * Empty array is allowed (organiser adds stops after creation).
 */
function validateCreateTripWaypoints(ctx: z.RefinementCtx, waypoints: InlineWaypoint[]): void {
  if (waypoints.length === 0) return;
  if (waypoints.length < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'Add at least two waypoints (start and end) or save with no waypoints to add them later',
      path: ['waypoints'],
    });
    return;
  }
  const hasStart = waypoints.some((w) => w.type === 'start');
  const hasEnd = waypoints.some((w) => w.type === 'end');
  if (!hasStart || !hasEnd) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Waypoints must include one start and one end',
      path: ['waypoints'],
    });
  }
  const sortOrders = waypoints.map((w) => w.sortOrder);
  if (new Set(sortOrders).size !== sortOrders.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Each waypoint must have a unique sortOrder',
      path: ['waypoints'],
    });
  }
}

// ==========================================
// Template fields (is_template = true)
// ==========================================
// These fields are only populated for template trips (published to Discover).
// All are optional/nullable so regular trips pass validation.

const TemplateFieldsSchema = z.object({
  isTemplate: z.boolean().optional().default(false),
  slug: z.string().max(200).nullable().optional(),
  countryCode: z.string().min(2).max(2).nullable().optional(),
  regionCode: z.string().min(1).max(10).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  polyline: z.string().nullable().optional(),
  distanceM: z.number().nonnegative().nullable().optional(),
  elevationGainM: z.number().nonnegative().nullable().optional(),
  estimatedDurationMinutes: z.number().int().nonnegative().nullable().optional(),
  surfaceType: SurfaceTypeInputSchema.nullable().optional(),
  curvatureIndex: z.number().min(0).max(10).nullable().optional(),
  viewCount: z.number().int().nonnegative().optional().default(0),
  cloneCount: z.number().int().nonnegative().optional().default(0),
  isFeatured: z.boolean().optional().default(false),
  isMotovaultPick: z.boolean().optional().default(false),
  averageRating: z.number().min(0).max(5).nullable().optional(),
  reviewCount: z.number().int().nonnegative().optional().default(0),
  forkedFromTripId: z.string().uuid().nullable().optional(),
  publishedAt: z.string().datetime().nullable().optional(),
  isFlagged: z.boolean().optional().default(false),
});

// --- Create Trip ---

export const CreateTripInputSchema = z
  .object({
    title: z
      .string()
      .min(1)
      .max(100)
      .transform((s) => stripHtml(s).trim())
      .pipe(z.string().min(1).max(100)),
    description: z
      .string()
      .min(1)
      .max(2000)
      .transform((s) => stripHtml(s).trim())
      .pipe(z.string().min(1).max(2000)),
    startDate: z.string().date(),
    endDate: z.string().date(),
    difficulty: TripDifficultySchema,
    // min(1) supports solo trips — the mobile app lets riders plan a 1-rider
    // trip and treats maxRiders <= 1 as a valid/complete trip
    // (trip-completeness.ts). A min(2) floor here rejected every solo-trip
    // creation with a generic BAD_REQUEST. (Sentry MOTO-VAULT-REACT-NATIVE-1J)
    maxRiders: z.number().int().min(1).max(50),
    visibility: nullishToUndefined(TripVisibilitySchema),
  })
  .superRefine((data, ctx) => {
    validateTripDateRange(ctx, data.startDate, data.endDate, {
      enforceStartNotTooFarInPast: true,
      enforceStartNotTooFarInFuture: true,
    });
  });

export type CreateTripInput = z.infer<typeof CreateTripInputSchema>;

// --- Create Trip With Waypoints (batch) ---

export const CreateTripWithWaypointsInputSchema = z
  .object({
    title: z
      .string()
      .min(1)
      .max(100)
      .transform((s) => stripHtml(s).trim())
      .pipe(z.string().min(1).max(100)),
    description: z
      .string()
      .min(1)
      .max(2000)
      .transform((s) => stripHtml(s).trim())
      .pipe(z.string().min(1).max(2000)),
    // Optional because a showcase ("Already rode it") is a dateless trip — the
    // service stores sentinel dates + dates_pending=true. For a planned trip
    // (isShowcase=false) both are required, enforced in superRefine below.
    startDate: nullishToUndefined(z.string().date()),
    endDate: nullishToUndefined(z.string().date()),
    difficulty: TripDifficultySchema,
    // min(1) supports solo trips — see CreateTripInputSchema above.
    // (Sentry MOTO-VAULT-REACT-NATIVE-1J)
    maxRiders: z.number().int().min(1).max(50),
    visibility: nullishToUndefined(TripVisibilitySchema),
    waypoints: z.array(InlineWaypointSchema).min(0).max(25),
    // Showcase ("Already rode it"): a dateless trip parameterised by dayCount
    // instead of a start/end range. The service maps this to sentinel dates +
    // dates_pending=true and skips organiser auto-enrolment.
    isShowcase: z.boolean().optional().default(false),
    dayCount: z.number().int().min(1).max(30).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.isShowcase) {
      // Dateless: no date-range validation. dayCount carries the day structure.
      if (data.startDate || data.endDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'A showcase trip must not carry start/end dates',
          path: ['startDate'],
        });
      }
    } else {
      if (!data.startDate || !data.endDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'startDate and endDate are required for a planned trip',
          path: [data.startDate ? 'endDate' : 'startDate'],
        });
      }
      validateTripDateRange(ctx, data.startDate, data.endDate, {
        enforceStartNotTooFarInPast: true,
        enforceStartNotTooFarInFuture: true,
      });
    }
    validateCreateTripWaypoints(ctx, data.waypoints);
  });

export type CreateTripWithWaypointsInput = z.infer<typeof CreateTripWithWaypointsInputSchema>;

// --- Update Trip ---

export const UpdateTripInputSchema = z
  .object({
    tripId: z.string().uuid(),
    title: nullishToUndefined(z.string().min(1).max(100)),
    description: nullishToUndefined(z.string().min(1).max(2000)),
    startDate: nullishToUndefined(z.string().date()),
    endDate: nullishToUndefined(z.string().date()),
    difficulty: nullishToUndefined(TripDifficultySchema),
    // min(1) supports solo trips — see CreateTripInputSchema.
    // (Sentry MOTO-VAULT-REACT-NATIVE-1J)
    maxRiders: nullishToUndefined(z.number().int().min(1).max(50)),
    visibility: nullishToUndefined(TripVisibilitySchema),
    waypoints: nullishToUndefined(z.array(InlineWaypointSchema).min(0).max(25)),
  })
  .superRefine((data, ctx) => {
    validateTripDateRange(ctx, data.startDate, data.endDate, {
      enforceStartNotTooFarInPast: false,
      enforceStartNotTooFarInFuture: false,
    });
  });

export type UpdateTripInput = z.infer<typeof UpdateTripInputSchema>;

// --- Create Waypoint ---

export const CreateWaypointInputSchema = z.object({
  tripId: z.string().uuid(),
  type: WaypointTypeSchema,
  name: z.string().min(1).max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  notes: nullishToUndefined(z.string().max(1000)),
  sortOrder: z.number().int().min(0).max(1000),
  dayIndex: z.number().int().min(0).max(365).default(0),
  /** @deprecated kept for backward compat — optional on new data */
  periodOfDay: nullishToUndefined(PeriodOfDaySchema),
});

export type CreateWaypointInput = z.infer<typeof CreateWaypointInputSchema>;

// --- Update Waypoint ---

export const UpdateWaypointInputSchema = z.object({
  waypointId: z.string().uuid(),
  type: nullishToUndefined(WaypointTypeSchema),
  name: nullishToUndefined(z.string().min(1).max(200)),
  lat: nullishToUndefined(z.number().min(-90).max(90)),
  lng: nullishToUndefined(z.number().min(-180).max(180)),
  notes: nullishToUndefined(z.string().max(1000)),
  sortOrder: nullishToUndefined(z.number().int().min(0).max(1000)),
  dayIndex: nullishToUndefined(z.number().int().min(0).max(365)),
  /** @deprecated kept for backward compat — optional on new data */
  periodOfDay: PeriodOfDaySchema.nullable().optional(),
});

export type UpdateWaypointInput = z.infer<typeof UpdateWaypointInputSchema>;

// --- Reorder Waypoints ---

export const ReorderWaypointsInputSchema = z.object({
  tripId: z.string().uuid(),
  waypointIds: z.array(z.string().uuid()).min(1).max(25),
});

export type ReorderWaypointsInput = z.infer<typeof ReorderWaypointsInputSchema>;

// --- Join Trip ---

export const JoinTripInputSchema = z.object({
  tripId: z.string().uuid(),
  status: ParticipantStatusSchema.optional().default('going'),
  bikeId: nullishToUndefined(z.string().uuid()),
});

export type JoinTripInput = z.infer<typeof JoinTripInputSchema>;

// --- Update Participant Status ---

export const UpdateParticipantStatusInputSchema = z.object({
  tripId: z.string().uuid(),
  status: ParticipantStatusSchema,
});

export type UpdateParticipantStatusInput = z.infer<typeof UpdateParticipantStatusInputSchema>;

// ==========================================
// Trip share link (H2 capability URLs)
// ==========================================

// Branded type — forces callers through the schema via .parse() or .safeParse()
export const TripShareTokenSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{64}$/, 'Invalid share token format')
  .transform((s) => s.toLowerCase())
  .brand<'TripShareToken'>();
export type TripShareToken = z.infer<typeof TripShareTokenSchema>;

// Shape of the RPC `resolve_trip_by_token` JSONB response. Service boundary
// must safeParse() against this schema — never cast raw RPC output.
export const SharedTripRowSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    description: z.string().nullable(),
    status: z.enum(['published', 'active', 'completed']),
    difficulty: z.string(),
    start_date: z.string(),
    end_date: z.string(),
    max_riders: z.number().int(),
    participant_count: z.number().int(),
    cover_image_url: z.string().nullable(),
  })
  .strict();
export type SharedTripRow = z.infer<typeof SharedTripRowSchema>;

export const SharedTripWaypointSchema = z
  .object({
    id: z.string().uuid(),
    sort_order: z.number().int(),
    day_index: z.number().int().nullable(),
    period_of_day: PeriodOfDaySchema.nullable().optional(),
    type: z.string(),
    name: z.string(),
    notes: z.string().nullable(),
    lat: z.number(),
    lng: z.number(),
  })
  .strict();
export type SharedTripWaypoint = z.infer<typeof SharedTripWaypointSchema>;

export const SharedTripParticipantSchema = z
  .object({
    anon_id: z.string(),
    role: z.string(),
    status: z.string(),
    display_name: z.string(),
    avatar_url: z.string().nullable(),
  })
  .strict();
export type SharedTripParticipant = z.infer<typeof SharedTripParticipantSchema>;

export const ResolveTripByTokenResponseSchema = z
  .object({
    trip: SharedTripRowSchema,
    waypoints: z.array(SharedTripWaypointSchema),
    participants: z.array(SharedTripParticipantSchema),
  })
  .strict();
export type ResolveTripByTokenResponse = z.infer<typeof ResolveTripByTokenResponseSchema>;

// ==========================================
// Template-specific schemas (unified Discover)
// ==========================================

// --- Trip Template Waypoint (JSONB contract for template trips) ---

export const TripTemplateWaypointSchema = z.object({
  sortOrder: z.number().int(),
  dayIndex: z.number().int().min(0),
  type: WaypointTypeSchema,
  name: z.string().min(1).max(200).transform(stripHtml),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  notes: z.string().max(1000).transform(stripHtml).nullable().optional(),
});
export type TripTemplateWaypoint = z.infer<typeof TripTemplateWaypointSchema>;

// --- Publish As Template ---
// Takes an existing trip and publishes it as a template (is_template = true).

export const PublishAsTemplateInputSchema = z.object({
  tripId: z.string().uuid(),
});
export type PublishAsTemplateInput = z.infer<typeof PublishAsTemplateInputSchema>;

// --- Trip Review ---
// Reviews on template trips (replaces discover_trip_reviews + route_reviews).

export const TripReviewSchema = z.object({
  tripId: z.string().uuid(),
  userId: z.string().uuid().nullable().optional(),
  rating: z.number().int().min(1).max(5),
  text: z.string().min(1).max(500).transform(stripHtml).optional(),
  conditionTags: z.array(ConditionTagSchema).max(10).optional(),
  bikeId: z.string().uuid().optional(),
  createdAt: z.string().datetime().optional(),
});
export type TripReview = z.infer<typeof TripReviewSchema>;

// --- Create Trip Review (input for mutation) ---

export const CreateTripReviewInputSchema = z.object({
  tripId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  text: nullishToUndefined(z.string().min(1).max(500).transform(stripHtml)),
  conditionTags: nullishToUndefined(z.array(ConditionTagSchema).max(10)),
  bikeId: nullishToUndefined(z.string().uuid()),
});
export type CreateTripReviewInput = z.infer<typeof CreateTripReviewInputSchema>;

// --- Trip Save ---
// Bookmark / save a template trip.

export const TripSaveSchema = z.object({
  tripId: z.string().uuid(),
  userId: z.string().uuid(),
  savedAt: z.string().datetime().optional(),
});
export type TripSave = z.infer<typeof TripSaveSchema>;

// --- Trip Template Filters ---
// Filters for browsing template trips (replaces DiscoverTripsFilter + DiscoverRoutesFilter).

export const TripTemplateFiltersSchema = z.object({
  country: z.string().min(2).max(2).optional(),
  regionCode: z.string().min(1).max(10).optional(),
  difficulty: TripDifficultySchema.optional(),
  dayCountMin: z.number().int().min(1).optional(),
  dayCountMax: z.number().int().min(1).optional(),
  surfaceType: SurfaceTypeInputSchema.optional(),
  searchText: z.string().max(200).trim().optional(),
  minRating: z.number().min(0).max(5).optional(),
  isFeatured: z.boolean().optional(),
  isMotovaultPick: z.boolean().optional(),
});
export type TripTemplateFilters = z.infer<typeof TripTemplateFiltersSchema>;

// --- Moderate Trip Template (Admin) ---

export const ModerateTripTemplateInputSchema = z.object({
  tripId: z.string().uuid(),
  isFlagged: z.boolean(),
});
export type ModerateTripTemplateInput = z.infer<typeof ModerateTripTemplateInputSchema>;

// --- Trip Slug Params (URL validation for template trips on web) ---

export const TripSlugParamsSchema = z.object({
  country: z.string().min(2).max(2), // ISO 3166-1 alpha-2
  region: z.string().min(1).max(10), // ISO 3166-2 subdivision
  slug: z.string().min(1).max(200),
});
export type TripSlugParams = z.infer<typeof TripSlugParamsSchema>;

// --- Share Ride As Trip ---
// Creates a template trip from a completed ride (replaces ShareRideToDiscover on routes).

export const ShareRideAsTripInputSchema = z.object({
  rideId: z.string().uuid(),
  name: z.string().max(200).optional(),
  surfaceType: SurfaceTypeInputSchema.optional(),
});

export type ShareRideAsTripInput = z.infer<typeof ShareRideAsTripInputSchema>;

// Re-export TemplateFieldsSchema for consumers that need the raw shape
export { TemplateFieldsSchema };
export type TemplateFields = z.infer<typeof TemplateFieldsSchema>;
