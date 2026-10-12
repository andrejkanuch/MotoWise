import type { SendFeedbackInput } from '@motovault/graphql';
import {
  DEVICE_PLATFORM,
  type DevicePlatform,
  FEEDBACK_CONTACT_WORDING_VERSION,
  type FeedbackQuickPick,
} from '@motovault/types';
import * as Application from 'expo-application';
import Constants from 'expo-constants';

/** One draft of the form. `clientId` survives retries and is replaced after a confirmed send. */
export interface FeedbackDraft {
  clientId: string;
  message: string;
  quickPick: FeedbackQuickPick | null;
  contactOptIn: boolean;
  /** The parsed field: `null` means "use the account email". */
  contactEmail: string | null;
}

/** What travels with every message besides the rider's text (the server adds the bike). */
export interface FeedbackContext {
  platform: DevicePlatform;
  appVersion: string;
  updateId: string | null;
  locale: string;
}

/** Platform names as riders know them; proper nouns, the same in every locale. */
export const DEVICE_PLATFORM_LABEL = {
  [DEVICE_PLATFORM.IOS]: 'iOS',
  [DEVICE_PLATFORM.ANDROID]: 'Android',
} as const satisfies Record<DevicePlatform, string>;

const UNKNOWN_VERSION = 'unknown';

/** The store version of the running binary. */
export function currentAppVersion(): string {
  return Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? UNKNOWN_VERSION;
}

export function devicePlatform(os: string | undefined): DevicePlatform {
  return os === DEVICE_PLATFORM.ANDROID ? DEVICE_PLATFORM.ANDROID : DEVICE_PLATFORM.IOS;
}

/**
 * The mutation input. `contactEmail` is sent only while the rider opts in, so
 * unticking the checkbox never changes a stored email.
 */
export function buildSendFeedbackInput(
  draft: FeedbackDraft,
  context: FeedbackContext,
): SendFeedbackInput {
  return {
    clientId: draft.clientId,
    message: draft.message.trim(),
    quickPick: draft.quickPick,
    platform: context.platform,
    appVersion: context.appVersion,
    updateId: context.updateId,
    locale: context.locale,
    contactOptIn: draft.contactOptIn,
    ...(draft.contactOptIn && { contactEmail: draft.contactEmail }),
    contactWordingVersion: FEEDBACK_CONTACT_WORDING_VERSION,
  };
}
