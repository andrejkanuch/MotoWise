import { z } from 'zod';

export const RESERVED_HANDLES = [
  'admin',
  'api',
  'settings',
  'explore',
  'route',
  'u',
  'auth',
  'account',
  'search',
  'feed',
] as const;

export const HandleSchema = z
  .string()
  .min(3)
  .max(20)
  .regex(/^[a-z0-9_]+$/, 'Handle must be 3-20 lowercase letters, numbers, or underscores')
  .refine((val) => !(RESERVED_HANDLES as readonly string[]).includes(val), {
    message: 'This handle is reserved',
  });
export type Handle = z.infer<typeof HandleSchema>;

export const UpdateHandleInputSchema = z.object({
  handle: HandleSchema,
});
export type UpdateHandleInput = z.infer<typeof UpdateHandleInputSchema>;
