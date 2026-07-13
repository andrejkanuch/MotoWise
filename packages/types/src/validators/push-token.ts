import { z } from 'zod';

/** Device platforms we accept a push token for (mirrors the DB CHECK on device_push_tokens). */
export const DEVICE_PLATFORM = { IOS: 'ios', ANDROID: 'android' } as const;
export type DevicePlatform = (typeof DEVICE_PLATFORM)[keyof typeof DEVICE_PLATFORM];

export const RegisterPushTokenSchema = z.object({
  // Expo push tokens look like `ExponentPushToken[...]`; cap length defensively.
  token: z.string().min(1).max(255),
  platform: z.enum([DEVICE_PLATFORM.IOS, DEVICE_PLATFORM.ANDROID]),
});
export type RegisterPushTokenInput = z.infer<typeof RegisterPushTokenSchema>;
