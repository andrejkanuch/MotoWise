import { RegisterPushTokenDocument } from '@motovault/graphql';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { gqlFetcher } from './graphql-client';
import { logger } from './logger';
import { hasNotificationPermission } from './notifications';

/**
 * MOT-278: acquire this device's Expo push token and register it with the API so
 * the server can send maintenance-due push notifications. Idempotent and
 * best-effort — only runs when permission is granted, and never throws into the
 * UI (a failed registration must not disrupt onboarding or launch).
 */
export async function registerForPushNotifications(): Promise<void> {
  try {
    if (!(await hasNotificationPermission())) return;

    const platform = process.env.EXPO_OS;
    if (platform !== 'ios' && platform !== 'android') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId) return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return;

    await gqlFetcher(RegisterPushTokenDocument, { input: { token, platform } });
  } catch (err) {
    logger.warn('push-token: registration failed:', err);
  }
}
