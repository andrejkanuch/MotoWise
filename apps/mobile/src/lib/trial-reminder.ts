// Day-5 trial-ending reminder (R8, KTD5).
//
// A rider in a renewing 7-day Pro trial gets one local notification 48 h before
// the store bills them. The reminder is derived from RevenueCat customer info and
// reconciled on every customer-info update, so cancelling the trial in the store,
// converting early or the entitlement lapsing clears it on the next update.
//
// The scheduled id lives under its OWN storage key: the shared notification map is
// swept by reconcileMaintenanceReminders, which would cancel anything it does not
// recognise. And the stored id alone is not proof the reminder exists — sign-out
// runs cancelAllScheduledNotificationsAsync — so an unchanged target is only
// skipped when the OS still holds the notification.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAfter, parseISO, subHours } from 'date-fns';
import * as Notifications from 'expo-notifications';
import i18n from '../i18n';
import { logger } from './logger';
import {
  hasNotificationPermission,
  IOS_NOTIFICATION_BUDGET,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_KIND,
} from './notifications';

/** How long before the trial converts the reminder fires (day 5 of a 7-day trial). */
export const TRIAL_REMINDER_LEAD_HOURS = 48;

/** RevenueCat `EntitlementInfo.periodType` for a free trial. */
const PERIOD_TYPE_TRIAL = 'TRIAL';

const TRIAL_REMINDER_STORAGE_KEY = '@motovault/trial-reminder';

/** The fields of RevenueCat's Pro `EntitlementInfo` the reminder depends on. */
export interface TrialEntitlementSnapshot {
  periodType?: string;
  willRenew?: boolean;
  expirationDate?: string | null;
}

interface StoredTrialReminder {
  id: string;
  /** ISO fire time the stored notification was scheduled for. */
  fireAt: string;
}

/**
 * When the reminder should fire, or null when the rider should get none: not in a
 * trial, trial set not to renew, no expiration, or the fire time already passed.
 */
export function trialReminderFireDate(
  entitlement: TrialEntitlementSnapshot | undefined,
  now: Date,
): Date | null {
  if (entitlement?.periodType !== PERIOD_TYPE_TRIAL) return null;
  if (!entitlement.willRenew || !entitlement.expirationDate) return null;
  const fireAt = subHours(parseISO(entitlement.expirationDate), TRIAL_REMINDER_LEAD_HOURS);
  return isAfter(fireAt, now) ? fireAt : null;
}

/**
 * Conditional by design: a rider who cancelled in the store's settings and has
 * not opened the app since still holds the scheduled reminder (nothing
 * reconciled it), so the copy must not promise a charge.
 */
function trialReminderContent(): Notifications.NotificationContentInput {
  return {
    title: i18n.t('notifications.trialReminder.title', {
      defaultValue: 'Your Pro trial ends in 2 days',
    }),
    body: i18n.t('notifications.trialReminder.body', {
      defaultValue:
        "If you keep Pro, your subscription starts when it ends. Manage or cancel anytime in your store's subscription settings.",
    }),
    data: { kind: NOTIFICATION_KIND.TRIAL_REMINDER },
  };
}

async function readStored(): Promise<StoredTrialReminder | null> {
  const raw = await AsyncStorage.getItem(TRIAL_REMINDER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredTrialReminder;
  } catch {
    return null;
  }
}

/** Every pending trial reminder the OS holds (normally zero or one). */
async function scheduledTrialReminders(): Promise<{
  trial: string[];
  total: number;
}> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const trial = all
    .filter((n) => n.content.data?.kind === NOTIFICATION_KIND.TRIAL_REMINDER)
    .map((n) => n.identifier);
  return { trial, total: all.length };
}

/** Cancel each id; returns true only when every cancellation succeeded. */
async function cancelIds(ids: readonly string[]): Promise<boolean> {
  const results = await Promise.allSettled(
    ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)),
  );
  return results.every((r) => r.status === 'fulfilled');
}

async function reconcile(entitlement: TrialEntitlementSnapshot | undefined, now: Date) {
  const fireAt = trialReminderFireDate(entitlement, now);
  const stored = await readStored();

  const { trial, total } = await scheduledTrialReminders();
  // Sweep by kind as well as by stored id: a reminder whose id never reached
  // storage would otherwise tell a rider who cancelled that they will be billed.
  const existing = stored ? [...new Set([...trial, stored.id])] : trial;

  if (!fireAt) {
    // Keep the stored id when the OS refused a cancellation, so the next
    // reconcile retries instead of believing the "you'll be billed" reminder
    // is gone.
    if (await cancelIds(existing)) await AsyncStorage.removeItem(TRIAL_REMINDER_STORAGE_KEY);
    return;
  }

  // Never prompt: a rider who has not granted notifications gets no reminder.
  if (!(await hasNotificationPermission())) return;

  const target = fireAt.toISOString();
  if (stored?.fireAt === target && trial.includes(stored.id)) return;

  // Never schedule a second reminder next to one the OS would not cancel.
  if (!(await cancelIds(existing))) return;
  await AsyncStorage.removeItem(TRIAL_REMINDER_STORAGE_KEY);

  if (total - trial.length >= IOS_NOTIFICATION_BUDGET) {
    logger.warn(
      `trial-reminder: iOS budget (${IOS_NOTIFICATION_BUDGET}) reached; skipping trial reminder`,
    );
    return;
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: trialReminderContent(),
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
      channelId: NOTIFICATION_CHANNEL.ACCOUNT,
    },
  });
  const next: StoredTrialReminder = { id, fireAt: target };
  await AsyncStorage.setItem(TRIAL_REMINDER_STORAGE_KEY, JSON.stringify(next));
}

// Reconciles are serialised: the customer-info listener and the initial fetch fire
// back to back at launch, and two interleaved runs would each schedule a reminder.
let chain: Promise<void> = Promise.resolve();

/**
 * Bring the scheduled trial reminder in line with the Pro entitlement: schedule it,
 * move it to a new expiration, re-arm it if the OS lost it, or cancel it. Pass the
 * ACTIVE Pro entitlement (undefined when there is none). Rejects on native failure;
 * callers fire and forget with their own logging.
 */
export function reconcileTrialReminder(
  entitlement: TrialEntitlementSnapshot | undefined,
  now: Date = new Date(),
): Promise<void> {
  const run = chain.then(() => reconcile(entitlement, now));
  chain = run.catch(() => {});
  return run;
}
