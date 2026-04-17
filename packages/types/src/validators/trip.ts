import { z } from 'zod';

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

// --- Waypoint Type ---

export const WAYPOINT_TYPE = {
  START: 'start',
  END: 'end',
  FUEL: 'fuel',
  FOOD: 'food',
  SCENIC: 'scenic',
  OVERNIGHT: 'overnight',
  PHOTO: 'photo',
  MECHANICAL: 'mechanical',
  FERRY: 'ferry',
  PASS_SUMMIT: 'pass_summit',
  RALLY_POINT: 'rally_point',
} as const;

export const WaypointTypeSchema = z.enum([
  'start',
  'end',
  'fuel',
  'food',
  'scenic',
  'overnight',
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

// --- Date range constants (trip planning window) ---

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PAST_DAYS = 365; // startDate cannot be more than 1 year in the past
const MAX_FUTURE_DAYS = 5 * 365; // endDate cannot be more than 5 years in the future
const MAX_TRIP_SPAN_DAYS = 365; // maximum trip duration

/**
 * Validates that a start/end date pair (as ISO date strings) falls within
 * the allowed planning window and the overall trip span is bounded.
 * Reports errors via a Zod `ctx` so callers can plug it into `superRefine`.
 */
function validateTripDateRange(
  ctx: z.RefinementCtx,
  startDate: string | undefined,
  endDate: string | undefined,
): void {
  if (!startDate && !endDate) return;

  const now = Date.now();
  const minStart = now - MAX_PAST_DAYS * ONE_DAY_MS;
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
    if (startMs < minStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'startDate cannot be more than 1 year in the past',
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

// --- Create Trip ---

export const CreateTripInputSchema = z
  .object({
    title: z.string().min(1).max(100),
    description: z.string().min(1).max(2000),
    startDate: z.string().date(),
    endDate: z.string().date(),
    difficulty: TripDifficultySchema,
    maxRiders: z.number().int().min(2).max(50),
    visibility: TripVisibilitySchema.optional(),
  })
  .superRefine((data, ctx) => {
    validateTripDateRange(ctx, data.startDate, data.endDate);
  });

export type CreateTripInput = z.infer<typeof CreateTripInputSchema>;

// --- Create Trip With Waypoints (batch) ---

const InlineWaypointSchema = z.object({
  type: WaypointTypeSchema,
  name: z.string().min(1).max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  notes: z.string().max(1000).optional(),
  sortOrder: z.number().int().min(0).max(1000),
  dayIndex: z.number().int().min(0).max(365).default(0),
  periodOfDay: PeriodOfDaySchema.nullable().optional(),
});

export const CreateTripWithWaypointsInputSchema = z
  .object({
    title: z.string().min(1).max(100),
    description: z.string().min(1).max(2000),
    startDate: z.string().date(),
    endDate: z.string().date(),
    difficulty: TripDifficultySchema,
    maxRiders: z.number().int().min(2).max(50),
    visibility: TripVisibilitySchema.optional(),
    waypoints: z.array(InlineWaypointSchema).min(0).max(25),
  })
  .superRefine((data, ctx) => {
    validateTripDateRange(ctx, data.startDate, data.endDate);
  });

export type CreateTripWithWaypointsInput = z.infer<typeof CreateTripWithWaypointsInputSchema>;

// --- Update Trip ---

export const UpdateTripInputSchema = z
  .object({
    tripId: z.string().uuid(),
    title: z.string().min(1).max(100).optional(),
    description: z.string().min(1).max(2000).optional(),
    startDate: z.string().date().optional(),
    endDate: z.string().date().optional(),
    difficulty: TripDifficultySchema.optional(),
    maxRiders: z.number().int().min(2).max(50).optional(),
    visibility: TripVisibilitySchema.optional(),
    waypoints: z.array(InlineWaypointSchema).min(0).max(25).optional(),
  })
  .superRefine((data, ctx) => {
    validateTripDateRange(ctx, data.startDate, data.endDate);
  });

export type UpdateTripInput = z.infer<typeof UpdateTripInputSchema>;

// --- Create Waypoint ---

export const CreateWaypointInputSchema = z.object({
  tripId: z.string().uuid(),
  type: WaypointTypeSchema,
  name: z.string().min(1).max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  notes: z.string().max(1000).optional(),
  sortOrder: z.number().int().min(0).max(1000),
  dayIndex: z.number().int().min(0).max(365).default(0),
  periodOfDay: PeriodOfDaySchema.optional(),
});

export type CreateWaypointInput = z.infer<typeof CreateWaypointInputSchema>;

// --- Update Waypoint ---

export const UpdateWaypointInputSchema = z.object({
  waypointId: z.string().uuid(),
  type: WaypointTypeSchema.optional(),
  name: z.string().min(1).max(200).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  notes: z.string().max(1000).optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
  dayIndex: z.number().int().min(0).max(365).optional(),
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
  bikeId: z.string().uuid().optional(),
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
