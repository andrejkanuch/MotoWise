import { z } from 'zod';
import { UserPreferencesSchema } from './user-preferences';

export const UpdateUserSchema = z.object({
  fullName: z.string().min(1).max(200).optional(),
  preferences: UserPreferencesSchema.optional(),
});
export type UpdateUser = z.infer<typeof UpdateUserSchema>;
