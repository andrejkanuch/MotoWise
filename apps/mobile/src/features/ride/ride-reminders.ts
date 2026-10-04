// Forgotten-ride reminders — a dead man's switch, not a sample-driven timer.
//
// The old nudge lived inside the auto-pause machine and could only fire when a GPS
// sample arrived. Recording asks for a fix every 5 m (`distanceInterval`), so a bike
// that is parked delivers no samples at all: the 10-minute "still riding?" nudge and
// the 30-minute auto-end never ran for exactly the rider they exist for. Riders who
// forgot to stop found out hours later from the server sweep, if at all.
//
// Here the OS does the counting. Every reminder is a scheduled local notification
// set to fire a fixed time after the last real movement. Each moving fix pushes the
// deadline back (throttled), so a rider in motion never sees one; the moment the
// bike stops — or the app is killed, or GPS dies — nothing pushes it back and the OS
// delivers it on time with no JS running.

import * as Notifications from 'expo-notifications';
import i18n from '../../i18n';
import { captureException } from '../../lib/analytics';
import {
  NOTIFICATION_CATEGORY,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_KIND,
} from '../../lib/notifications';
import { useRideStore } from '../../stores/ride.store';
import { rideMMKV } from '../../utils/ride-storage';

/** Reminder stages, by minutes without movement. */
export const RIDE_REMINDER_STAGE = {
  NUDGE: 'nudge',
  FINAL: 'final',
} as const;
export type RideReminderStage = (typeof RIDE_REMINDER_STAGE)[keyof typeof RIDE_REMINDER_STAGE];

export const RIDE_REMINDER_SCHEDULE: readonly {
  stage: RideReminderStage;
  afterMinutes: number;
}[] = [
  { stage: RIDE_REMINDER_STAGE.NUDGE, afterMinutes: 10 },
  { stage: RIDE_REMINDER_STAGE.FINAL, afterMinutes: 30 },
];

/** Re-scheduling costs a native round trip; a moving fix arrives about every second.
 *  Pushing the deadline back once a minute keeps every reminder within a minute of
 *  its nominal time while doing ~1/60th of the work. */
export const RIDE_REMINDER_REARM_THROTTLE_MS = 60_000;

const STAGE_COPY: Record<
  RideReminderStage,
  { titleKey: string; titleDefault: string; bodyKey: string; bodyDefault: (m: number) => string }
> = {
  [RIDE_REMINDER_STAGE.NUDGE]: {
    titleKey: 'rideHud.forgotToStopTitle',
    titleDefault: 'Still riding?',
    bodyKey: 'rideHud.reminderNudgeBody',
    bodyDefault: (m) =>
      `Your ride is still recording, but you haven't moved for ${m} minutes. End it or keep going.`,
  },
  [RIDE_REMINDER_STAGE.FINAL]: {
    titleKey: 'rideHud.reminderFinalTitle',
    titleDefault: 'Your ride is still recording',
    bodyKey: 'rideHud.reminderFinalBody',
    bodyDefault: (m) =>
      `No movement for ${m} minutes. End the ride to save it as it was when you stopped.`,
  },
};

/**
 * Content for one reminder stage. Pure + exported so tests can assert the payload.
 * `data` matches the server sweep's push (NOTIFICATION_KIND.RIDE_IDLE), so the tap
 * handler in _layout covers both sources with one branch.
 */
export function rideReminderContent(
  stage: RideReminderStage,
  rideId: string | undefined,
  afterMinutes: number,
): Notifications.NotificationContentInput {
  const copy = STAGE_COPY[stage];
  return {
    title: i18n.t(copy.titleKey, { defaultValue: copy.titleDefault }),
    body: i18n.t(copy.bodyKey, {
      minutes: afterMinutes,
      defaultValue: copy.bodyDefault(afterMinutes),
    }),
    categoryIdentifier: NOTIFICATION_CATEGORY.RIDE_IDLE,
    data: { kind: NOTIFICATION_KIND.RIDE_IDLE, rideId, autoEnded: false, stage },
  };
}

// Arm/cancel calls are serialised: an arm racing a cancel (End tapped a moment
// after a moving fix) must never leave a reminder scheduled for an ended ride.
let chain: Promise<void> = Promise.resolve();
let lastArmedAt = 0;

function enqueue(work: () => Promise<void>): Promise<void> {
  chain = chain.then(work).catch((err) => {
    captureException(err, { source: 'ride-reminders' });
  });
  return chain;
}

async function cancelIds(ids: readonly string[]): Promise<void> {
  await Promise.all(
    ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})),
  );
}

/** Take the stored ids and forget them, synchronously: a caller that clears all
 *  ride data right after ending (the headless auto-end) must not race the queue. */
function takeReminderIds(): string[] {
  const ids = rideMMKV.getReminderIds();
  rideMMKV.setReminderIds([]);
  return ids;
}

/**
 * (Re)schedule every reminder stage relative to `from` (the last movement, or now).
 * Cancels the previous set first. Silently a no-op without notification permission —
 * the ride still records, the rider just doesn't get nudged.
 */
export function armRideReminders(from: number = Date.now()): Promise<void> {
  lastArmedAt = from;
  return enqueue(async () => {
    await cancelIds(takeReminderIds());
    const rideId = rideMMKV.getCurrentId();
    // No reminders for a ride that is gone, or ended and waiting on its summary.
    if (!rideId || useRideStore.getState().status === 'ended') return;
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const ids: string[] = [];
    for (const { stage, afterMinutes } of RIDE_REMINDER_SCHEDULE) {
      const fireAt = from + afterMinutes * 60_000;
      const seconds = Math.max(1, Math.round((fireAt - Date.now()) / 1000));
      ids.push(
        await Notifications.scheduleNotificationAsync({
          content: rideReminderContent(stage, rideId, afterMinutes),
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds,
            channelId: NOTIFICATION_CHANNEL.RIDE_ALERTS,
          },
        }),
      );
    }
    rideMMKV.setReminderIds(ids);
  });
}

/** Drop every pending reminder for the current ride (end, discard, rollback). */
export function cancelRideReminders(): Promise<void> {
  lastArmedAt = 0;
  const ids = takeReminderIds();
  // Also sweep whatever an arm already queued ahead of us writes before we run.
  return enqueue(() => cancelIds([...ids, ...takeReminderIds()]));
}

/**
 * Record a fix the GPS filter accepted as real movement: persist it (so an end from
 * a reminder can trim to it) and push the reminder deadline back, at most once per
 * RIDE_REMINDER_REARM_THROTTLE_MS.
 */
export function noteRideMovement(at: number = Date.now()): void {
  rideMMKV.setLastMovementAt(at);
  if (at - lastArmedAt < RIDE_REMINDER_REARM_THROTTLE_MS) return;
  void armRideReminders(at);
}

/**
 * Where a ride ended from a reminder should stop: the last real movement, if there
 * was one after the start. Falls back to now when nothing moved (a ride that never
 * left the driveway has nothing to trim to).
 */
export function rideEndTrimTarget(now: number = Date.now()): number {
  const startedAt = rideMMKV.getStartedAt() ?? 0;
  const lastMovementAt = rideMMKV.getLastMovementAt();
  return lastMovementAt > startedAt && lastMovementAt < now ? lastMovementAt : now;
}

/** Test seam: reset module state between cases. */
export function __resetRideRemindersForTest(): void {
  chain = Promise.resolve();
  lastArmedAt = 0;
}
