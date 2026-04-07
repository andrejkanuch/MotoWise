import { z } from 'zod';
import {
  BIO_MAX_LENGTH,
  CITY_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  RESERVED_USERNAMES,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_REGEX,
} from '../constants/profile';

export const UsernameSchema = z
  .string()
  .min(USERNAME_MIN_LENGTH)
  .max(USERNAME_MAX_LENGTH)
  .regex(USERNAME_REGEX, 'Username must be 3-20 lowercase letters, numbers, or underscores')
  .refine((val) => !(RESERVED_USERNAMES as readonly string[]).includes(val), {
    message: 'This username is reserved',
  });
export type Username = z.infer<typeof UsernameSchema>;

export const UpdateProfileInputSchema = z.object({
  publicUsername: UsernameSchema.optional(),
  displayName: z.string().max(DISPLAY_NAME_MAX_LENGTH).optional(),
  bio: z.string().max(BIO_MAX_LENGTH).optional(),
  city: z.string().max(CITY_MAX_LENGTH).optional(),
  isPublic: z.boolean().optional(),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileInputSchema>;
