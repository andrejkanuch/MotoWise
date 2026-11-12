import { RegisterPushTokenDocument, UnregisterPushTokenDocument } from '@motovault/graphql';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AnalyticsEvent, captureException, trackEvent } from './analytics';
import { gqlFetcher } from './graphql-client';
import { isMissingGqlSessionError } from './graphql-error-classification';
import { logger } from './logger';
import { isNetworkError } from './network-error';
import { hasNotificationPermission } from './notifications';
import { supabase } from './supabase';

/** Upper bound on the sign-out unregister — signing out must never wait on the network. */
export const SIGN_OUT_UNREGISTER_TIMEOUT_MS = 3000;

/** Where a registration failed: `stage` on `push_token_registration_failed` and in Sentry extras. */
export const PUSH_TOKEN_STAGE = {
  /** Asking the OS / Expo for this device's push token (on Android: FCM). */
  DEVICE_TOKEN: 'device_token',
  /** The RegisterPushToken mutation threw (network, auth, server error). */
  CLAIM: 'claim',
  /** The API answered `success: false` (no user in the database, or a non-Expo token). */
  CLAIM_REJECTED: 'claim_rejected',
} as const;

export type PushTokenStage = (typeof PUSH_TOKEN_STAGE)[keyof typeof PUSH_TOKEN_STAGE];

/** `extra.source` for Sentry triage (issue titles are not reliable for grouping). */
const SENTRY_SOURCE = 'push-token-register';

/** `error_code` for an offline/flaky-network claim, so it is not read as a push setup failure. */
const NETWORK_ERROR_CODE = 'network';

function errorCode(err: unknown): string | null {
  // Sentry's beforeSend already drops these; PostHog still counts them, labelled.
  if (err && isNetworkError(err)) return NETWORK_ERROR_CODE;
  const code = (err as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && code) return code;
  return err instanceof Error ? err.name : null;
}

/**
 * A registration that failed must be visible in production: PostHog for the rate
 * per platform, Sentry for the error itself. Never throws.
 */
function reportRegistrationFailure(stage: PushTokenStage, platform: string, err: unknown): void {
  const code = errorCode(err);
  trackEvent(AnalyticsEvent.PUSH_TOKEN_REGISTRATION_FAILED, { platform, stage, error_code: code });
  captureException(err ?? new Error(`push-token: ${stage}`), {
    source: SENTRY_SOURCE,
    stage,
    platform,
    error_code: code,
  });
}

/** The token this runtime last registered, so sign-out can remove it without asking Expo again. */
let registeredToken: string | null = null;

/**
 * Bumped by every registration and every sign-out unregister. A sign-out
 * unregister that finishes after its cap compares the value it captured: any
 * registration since then (the same rider signing back in included) wins.
 */
let pushGeneration = 0;

/** Bumped by sign-out unregisters only: decides whether a landed claim may be remembered. */
let signOutCount = 0;

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
 * Claims already sent to the API and not yet answered. A sign-out waits for
 * exactly these (all of them, not just the latest), so the unregister always
 * lands after them. A registration still looking up its token is not here: it
 * sees the sign-out's generation bump and never sends.
 */
const claimsOnTheWire = new Set<Promise<unknown>>();

/**
 * MOT-278: acquire this device's Expo push token and register it with the API so
 * the server can send maintenance-due push notifications. Idempotent and
 * best-effort — only runs when permission is granted, and never throws into the
 * UI (a failed registration must not disrupt onboarding or launch).
 */
export async function registerForPushNotifications(): Promise<void> {
  pushGeneration += 1;
  const generation = pushGeneration;
  const signOutsAtStart = signOutCount;
  // Which step failed, for the failure report. Android could not get a device
  // token from July to 2026-11-12 (no FCM config) and nobody knew: the old
  // logger.warn is a no-op in production builds.
  let stage: PushTokenStage = PUSH_TOKEN_STAGE.DEVICE_TOKEN;
  try {
    const device = await getDevicePushToken();
    if (!device) return;
    // A sign-out started while the token was being looked up: do not claim it
    // back for the account that is signing out.
    if (pushGeneration !== generation) return;

    stage = PUSH_TOKEN_STAGE.CLAIM;
    const claim = gqlFetcher(RegisterPushTokenDocument, { input: device });
    claimsOnTheWire.add(claim);
    let claimed: boolean;
    try {
      claimed = (await claim).registerPushToken.success;
    } finally {
      claimsOnTheWire.delete(claim);
    }
    if (!claimed) {
      reportRegistrationFailure(PUSH_TOKEN_STAGE.CLAIM_REJECTED, device.platform, null);
      return;
    }
    // Remember it unless a sign-out started meanwhile (that sign-out owns it now).
    // A newer overlapping registration must not stop this: if it ends up sending
    // nothing, sign-out still needs this token.
    if (signOutCount === signOutsAtStart) registeredToken = device.token;
    trackEvent(AnalyticsEvent.PUSH_TOKEN_REGISTERED, { platform: device.platform });
  } catch (err) {
    // The launch-time call runs before anyone has signed in; that claim can only
    // be refused, and sign-in registers again (`shouldRegisterPush` in _layout).
    if (isMissingGqlSessionError(err)) return;
    reportRegistrationFailure(stage, process.env.EXPO_OS ?? 'unknown', err);
  }
}

/** The signed-in user id, or null. Never throws. */
async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

/**
 * User-initiated sign-out, called BEFORE the session ends (the mutation needs it):
 * removes this device's token from the account so the signed-out device stops
 * receiving that account's notifications. Waits at most
 * `SIGN_OUT_UNREGISTER_TIMEOUT_MS` and never throws. A forced sign-out cannot run
 * this; the next account to sign in on the device takes the token over instead.
 *
 * Sign-out does not wait past the cap, so the work below can finish late. It is
 * bound to the sign-out it belongs to: if a registration has run since (a new
 * account, or the same rider signing back in) or a different session is current
 * by the time the mutation would go out, it is skipped, so a late call can never
 * remove a token that was just claimed again.
 */
export async function unregisterPushTokenForSignOut(): Promise<void> {
  const token = registeredToken;
  registeredToken = null;
  signOutCount += 1;
  pushGeneration += 1;
  const generation = pushGeneration;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, SIGN_OUT_UNREGISTER_TIMEOUT_MS);
  });
  const sentClaims = [...claimsOnTheWire];
  const unregister = async () => {
    // Claims already on the wire must land first, or one would re-attach the
    // token to the account that is signing out after the unregister removed it.
    await Promise.allSettled(sentClaims);
    const owner = await currentUserId();
    if (!owner) return;
    const deviceToken = token ?? (await getDevicePushToken())?.token;
    if (!deviceToken) return;
    // Generation last: a registration can start during the session read.
    if ((await currentUserId()) !== owner || pushGeneration !== generation) return;
    await gqlFetcher(UnregisterPushTokenDocument, { input: { token: deviceToken } });
  };
  try {
    await Promise.race([unregister(), timeout]);
  } catch (err) {
    logger.warn('push-token: unregister on sign-out failed:', err);
  } finally {
    clearTimeout(timer);
  }
}
