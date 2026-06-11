import { z } from 'zod';
import { nullishToUndefined } from './nullish';

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
  meetingPointName: nullishToUndefined(z.string().max(200)),
  routeId: nullishToUndefined(z.string().uuid()),
  routeDescription: nullishToUndefined(z.string().min(1).max(1000)),
  difficulty: GroupRideDifficultySchema,
  maxRiders: z.number().int().min(2).max(50),
});

export type CreateGroupRideInput = z.infer<typeof CreateGroupRideInputSchema>;

// --- Update Group Ride ---

export const UpdateGroupRideInputSchema = z.object({
  groupRideId: z.string().uuid(),
  title: nullishToUndefined(z.string().min(1).max(100)),
  description: nullishToUndefined(z.string().min(1).max(1000)),
  dateTime: nullishToUndefined(
    z
      .string()
      .datetime()
      .refine((dt) => new Date(dt).getTime() > Date.now(), {
        message: 'dateTime must be in the future',
      }),
  ),
  meetingPointLat: nullishToUndefined(z.number().min(-90).max(90)),
  meetingPointLng: nullishToUndefined(z.number().min(-180).max(180)),
  meetingPointName: nullishToUndefined(z.string().max(200)),
  maxRiders: nullishToUndefined(z.number().int().min(2).max(50)),
});

export type UpdateGroupRideInput = z.infer<typeof UpdateGroupRideInputSchema>;
