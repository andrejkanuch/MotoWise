import { z } from 'zod';

// --- Difficulty ---

export const GROUP_RIDE_DIFFICULTY = {
  EASY: 'easy',
  MODERATE: 'moderate',
  CHALLENGING: 'challenging',
} as const;

export const GroupRideDifficultySchema = z.enum(['easy', 'moderate', 'challenging']);
export type GroupRideDifficulty = z.infer<typeof GroupRideDifficultySchema>;

// --- Create Group Ride ---

export const CreateGroupRideInputSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  dateTime: z
    .string()
    .datetime()
    .refine((dt) => new Date(dt).getTime() > Date.now(), {
      message: 'dateTime must be in the future',
    }),
  meetingPointLat: z.number().min(-90).max(90),
  meetingPointLng: z.number().min(-180).max(180),
  meetingPointName: z.string().max(200).optional(),
  routeId: z.string().uuid().optional(),
  routeDescription: z.string().min(1).max(1000).optional(),
  difficulty: GroupRideDifficultySchema,
  maxRiders: z.number().int().min(2).max(50),
});

export type CreateGroupRideInput = z.infer<typeof CreateGroupRideInputSchema>;

// --- Update Group Ride ---

export const UpdateGroupRideInputSchema = z.object({
  groupRideId: z.string().uuid(),
  title: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(1000).optional(),
  dateTime: z
    .string()
    .datetime()
    .refine((dt) => new Date(dt).getTime() > Date.now(), {
      message: 'dateTime must be in the future',
    })
    .optional(),
  meetingPointLat: z.number().min(-90).max(90).optional(),
  meetingPointLng: z.number().min(-180).max(180).optional(),
  meetingPointName: z.string().max(200).optional(),
  maxRiders: z.number().int().min(2).max(50).optional(),
});

export type UpdateGroupRideInput = z.infer<typeof UpdateGroupRideInputSchema>;
