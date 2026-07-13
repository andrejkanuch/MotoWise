import { z } from 'zod';

/** Device platforms we accept a push token for (mirrors the DB CHECK on device_push_tokens). */
export const DEVICE_PLATFORM = { IOS: 'ios', ANDROID: 'android' } as const;
export type DevicePlatform = (typeof DEVICE_PLATFORM)[keyof typeof DEVICE_PLATFORM];

/**
 * Expo push token shape — `ExponentPushToken[…]` / `ExpoPushToken[…]`. Mirrors what
 * expo-server-sdk's `Expo.isExpoPushToken` accepts (the send path filters on the same),
 * so registering a non-Expo string is rejected up front instead of stored as junk.
 */
export const EXPO_PUSH_TOKEN_REGEX = /^Ex(ponent|po)PushToken\[[^\]]+\]$/;

export const RegisterPushTokenSchema = z.object({
  // Cap length defensively and require the Expo token shape.
  token: z.string().min(1).max(255).regex(EXPO_PUSH_TOKEN_REGEX, 'Invalid Expo push token'),
  platform: z.enum([DEVICE_PLATFORM.IOS, DEVICE_PLATFORM.ANDROID]),
});
export type RegisterPushTokenInput = z.infer<typeof RegisterPushTokenSchema>;
