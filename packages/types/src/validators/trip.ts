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

// --- Participant Role ---

export const PARTICIPANT_ROLE = {
  ORGANIZER: 'organizer',
  RIDER: 'rider',
} as const;

export const ParticipantRoleSchema = z.enum(['organizer', 'rider']);
export type ParticipantRole = z.infer<typeof ParticipantRoleSchema>;

// --- Participant Status ---

export const PARTICIPANT_STATUS = {
  INVITED: 'invited',
  GOING: 'going',
  MAYBE: 'maybe',
  DECLINED: 'declined',
} as const;

export const ParticipantStatusSchema = z.enum(['invited', 'going', 'maybe', 'declined']);
export type ParticipantStatus = z.infer<typeof ParticipantStatusSchema>;

// --- Create Trip ---

export const CreateTripInputSchema = z
  .object({
    title: z.string().min(1).max(100),
    description: z.string().min(1).max(2000),
    startDate: z.string().date(),
    endDate: z.string().date(),
    difficulty: TripDifficultySchema,
    maxRiders: z.number().int().min(2).max(50),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'endDate must be on or after startDate',
    path: ['endDate'],
  });

export type CreateTripInput = z.infer<typeof CreateTripInputSchema>;

// --- Create Trip With Waypoints (batch) ---

const InlineWaypointSchema = z.object({
  type: WaypointTypeSchema,
  name: z.string().min(1).max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  notes: z.string().max(1000).optional(),
  sortOrder: z.number().int().min(0),
  dayIndex: z.number().int().min(0).default(0),
});

export const CreateTripWithWaypointsInputSchema = z
  .object({
    title: z.string().min(1).max(100),
    description: z.string().min(1).max(2000),
    startDate: z.string().date(),
    endDate: z.string().date(),
    difficulty: TripDifficultySchema,
    maxRiders: z.number().int().min(2).max(50),
    waypoints: z.array(InlineWaypointSchema).min(0).max(25),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'endDate must be on or after startDate',
    path: ['endDate'],
  });

export type CreateTripWithWaypointsInput = z.infer<typeof CreateTripWithWaypointsInputSchema>;

// --- Update Trip ---

export const UpdateTripInputSchema = z.object({
  tripId: z.string().uuid(),
  title: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(2000).optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  difficulty: TripDifficultySchema.optional(),
  maxRiders: z.number().int().min(2).max(50).optional(),
  visibility: z.enum(['private', 'unlisted', 'public']).optional(),
  waypoints: z.array(InlineWaypointSchema).min(0).max(25).optional(),
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
  sortOrder: z.number().int().min(0),
  dayIndex: z.number().int().min(0).default(0),
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
  sortOrder: z.number().int().min(0).optional(),
  dayIndex: z.number().int().min(0).optional(),
});

export type UpdateWaypointInput = z.infer<typeof UpdateWaypointInputSchema>;

// --- Reorder Waypoints ---

export const ReorderWaypointsInputSchema = z.object({
  tripId: z.string().uuid(),
  waypointIds: z.array(z.string().uuid()).min(1),
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
