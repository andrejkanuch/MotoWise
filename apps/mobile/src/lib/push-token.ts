import { RegisterPushTokenDocument, UnregisterPushTokenDocument } from '@motovault/graphql';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { gqlFetcher } from './graphql-client';
import { logger } from './logger';
import { hasNotificationPermission } from './notifications';

/** Upper bound on the sign-out unregister — signing out must never wait on the network. */
export const SIGN_OUT_UNREGISTER_TIMEOUT_MS = 3000;

/** The token this runtime last registered, so sign-out can remove it without asking Expo again. */
let registeredToken: string | null = null;

/** This device's Expo push token, or null when push is unavailable here. */
async function getDevicePushToken(): Promise<{
  token: string;
  platform: 'ios' | 'android';
} | null> {
  if (!(await hasNotificationPermission())) return null;

  const platform = process.env.EXPO_OS;
  if (platform !== 'ios' && platform !== 'android') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) return null;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  return token ? { token, platform } : null;
}

/**
 * MOT-278: acquire this device's Expo push token and register it with the API so
 * the server can send maintenance-due push notifications. Idempotent and
 * best-effort — only runs when permission is granted, and never throws into the
 * UI (a failed registration must not disrupt onboarding or launch).
 */
export async function registerForPushNotifications(): Promise<void> {
  try {
    const device = await getDevicePushToken();
    if (!device) return;

    await gqlFetcher(RegisterPushTokenDocument, { input: device });
    registeredToken = device.token;
  } catch (err) {
    logger.warn('push-token: registration failed:', err);
  }
}

/**
 * User-initiated sign-out, called BEFORE the session ends (the mutation needs it):
 * removes this device's token from the account so the signed-out device stops
 * receiving that account's notifications. Waits at most
 * `SIGN_OUT_UNREGISTER_TIMEOUT_MS` and never throws. A forced sign-out cannot run
 * this; the next account to sign in on the device takes the token over instead.
 */
export async function unregisterPushTokenForSignOut(): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, SIGN_OUT_UNREGISTER_TIMEOUT_MS);
  });
  const unregister = async () => {
    const token = registeredToken ?? (await getDevicePushToken())?.token;
    if (!token) return;
    await gqlFetcher(UnregisterPushTokenDocument, { input: { token } });
  };
  try {
    await Promise.race([unregister(), timeout]);
  } catch (err) {
    logger.warn('push-token: unregister on sign-out failed:', err);
  } finally {
    clearTimeout(timer);
    registeredToken = null;
  }
}
