import { palette } from '@motovault/design-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { differenceInCalendarDays } from 'date-fns';
import * as Notifications from 'expo-notifications';
import { logger } from './logger';

/** Notification `data.kind` discriminator — shared with the tap handler in _layout. */
export const NOTIFICATION_KIND = {
  DOCUMENT: 'document',
  MAINTENANCE: 'maintenance',
  /** A receipt scan parked for later review (U6 review-later). */
  RECEIPT_SCAN: 'receiptScan',
  /**
   * A ride has been stationary (or silent) long enough that the rider probably
   * forgot to stop it. Fired from two places, with the same payload so one tap
   * handler covers both:
   *   * locally by the auto-pause machine, when GPS proves the bike hasn't moved
   *   * remotely by the server sweep, when the device stopped reporting entirely
   * `autoEnded: true` means the ride is already closed — the tap goes to the saved
   * ride rather than the live HUD. Must match `NOTIFICATION_KIND.RIDE_IDLE` in
   * @motovault/types, which the API sends.
   */
  RIDE_IDLE: 'ride_idle',
} as const;

/** iOS UNNotificationCategory identifiers (also the Android channel-less category key). */
export const NOTIFICATION_CATEGORY = {
  MAINTENANCE_REMINDER: 'MAINTENANCE_REMINDER',
  DOCUMENT_EXPIRY: 'DOCUMENT_EXPIRY',
} as const;

/** Notification action-button identifiers — shared with the tap handler in _layout. */
export const NOTIFICATION_ACTION = {
  MARK_DONE: 'MARK_DONE',
  SNOOZE_1D: 'SNOOZE_1D',
  VIEW_DOCUMENT: 'VIEW_DOCUMENT',
} as const;

// MOT-139: Map now stores an ARRAY of notification ids per task so we can
// cancel all scheduled stages (30d / 7d / 1d) atomically.
const NOTIFICATION_MAP_KEY = '@motovault/notification-map';

// --- Internal helpers for taskId -> notificationId[] mapping ---

async function getNotificationMap(): Promise<Record<string, string[]>> {
  const raw = await AsyncStorage.getItem(NOTIFICATION_MAP_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string | string[]>;
    // Backwards compat: old shape was Record<string, string>. Migrate on read.
    const out: Record<string, string[]> = {};
    for (const [taskId, value] of Object.entries(parsed)) {
      out[taskId] = Array.isArray(value) ? value : [value];
    }
    return out;
  } catch {
    return {};
  }
}

async function setNotificationIds(taskId: string, notificationIds: string[]): Promise<void> {
  const map = await getNotificationMap();
  map[taskId] = notificationIds;
  await AsyncStorage.setItem(NOTIFICATION_MAP_KEY, JSON.stringify(map));
}

async function removeNotificationIds(taskId: string): Promise<void> {
  const map = await getNotificationMap();
  delete map[taskId];
  await AsyncStorage.setItem(NOTIFICATION_MAP_KEY, JSON.stringify(map));
}

// --- Scheduling primitives (shared by maintenance + document reminders) ---

// iOS hard-limits an app to 64 pending local notifications. Stay under it with
// headroom so a burst of tasks/documents never silently overflows — once the OS
// cap is hit, further scheduleNotificationAsync calls are dropped without error.
const IOS_NOTIFICATION_BUDGET = 60;

/** Current count of pending scheduled notifications (across all features). */
async function getScheduledCount(): Promise<number> {
  try {
    return (await Notifications.getAllScheduledNotificationsAsync()).length;
  } catch {
    return 0;
  }
}

/** True only when the OS notification permission is granted. */
export async function hasNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

interface StagePlan {
  daysBefore: number;
  enabled: boolean;
  label: Stage;
}

/**
 * Shared multi-stage scheduler. For each enabled stage it computes the 09:00-local
 * fire date, skips past-due stages, and schedules the rest — returning the created
 * ids for the caller to persist under its own keyspace. Enforces the iOS budget
 * ACROSS ALL features (documents + maintenance share the 64 cap), and surfaces
 * per-stage failures via the dev logger instead of swallowing them.
 */
async function scheduleStages(params: {
  targetDate: Date;
  stages: StagePlan[];
  channelId: string;
  buildContent: (label: Stage) => Notifications.NotificationContentInput;
}): Promise<string[]> {
  const now = new Date();
  const scheduledIds: string[] = [];
  let remainingBudget = IOS_NOTIFICATION_BUDGET - (await getScheduledCount());

  for (const stage of params.stages) {
    if (!stage.enabled) continue;

    const reminderDate = new Date(params.targetDate);
    reminderDate.setDate(reminderDate.getDate() - stage.daysBefore);
    reminderDate.setHours(9, 0, 0, 0);
    if (reminderDate <= now) continue;

    if (remainingBudget <= 0) {
      logger.warn(
        `notifications: iOS budget (${IOS_NOTIFICATION_BUDGET}) reached; skipping "${stage.label}" stage`,
      );
      continue;
    }

    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: params.buildContent(stage.label),
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminderDate,
          channelId: params.channelId,
        },
      });
      scheduledIds.push(id);
      remainingBudget -= 1;
    } catch (err) {
      // One failed stage must not abort the rest — but surface it (not silent).
      logger.warn(`notifications: failed to schedule "${stage.label}" stage:`, err);
    }
  }

  return scheduledIds;
}

// --- Public API ---

/**
 * Create Android notification channel for maintenance reminders.
 * No-op on iOS.
 */
export async function setupNotificationChannels(): Promise<void> {
  if (process.env.EXPO_OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('maintenance', {
    name: 'Maintenance Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: palette.signature500,
    // Omit `sound` to use the OS default channel sound. Passing a string here
    // (e.g. 'default') makes expo-notifications look for a bundled custom sound
    // file of that name — none exists, so it errors. A HIGH-importance channel
    // plays the default sound without this field.
  });
  await Notifications.setNotificationChannelAsync('documents', {
    name: 'Document Renewal Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: palette.signature500,
    // See note above — omit `sound` for the OS default channel sound.
  });
  await Notifications.setNotificationChannelAsync('receipt-scans', {
    name: 'Receipt Scans',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200, 200, 200],
    lightColor: palette.signature500,
    // See note above — omit `sound` for the OS default channel sound.
  });
}

/**
 * Register actionable notification categories (Mark Done / Snooze).
 */
export async function setupNotificationCategories(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORY.MAINTENANCE_REMINDER, [
    {
      buttonTitle: 'Mark Done',
      identifier: NOTIFICATION_ACTION.MARK_DONE,
      options: { opensAppToForeground: false },
    },
    {
      buttonTitle: 'Snooze 1 Day',
      identifier: NOTIFICATION_ACTION.SNOOZE_1D,
      options: { opensAppToForeground: false },
    },
  ]);
  // Document expiry — informational/renewal; no "Mark Done" and no "Snooze". R8:
  // reminders key off the document's expiry_date, so there is nothing to snooze —
  // the only action is a deep-link to view the document. (A standalone "Snooze 1
  // Day" button here was inert: the tap handler has no document snooze path.)
  await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORY.DOCUMENT_EXPIRY, [
    {
      buttonTitle: 'View',
      identifier: NOTIFICATION_ACTION.VIEW_DOCUMENT,
      options: { opensAppToForeground: true },
    },
  ]);
}

interface ReminderTask {
  id: string;
  title: string;
  dueDate: string;
  motorcycleId: string;
  /** MOT-139 stage flags (default: only 1-day enabled) */
  remind30d?: boolean;
  remind7d?: boolean;
  remind1d?: boolean;
}

/**
 * MOT-139: Schedule multi-stage reminders (30d / 7d / 1d) for a maintenance task.
 *
 * Respects the task's `remind_30d` / `remind_7d` / `remind_1d` flags. Default
 * behaviour (only 1-day enabled) preserves legacy behaviour for tasks created
 * before MOT-139. Each stage fires at 9:00 AM local time on its target day.
 *
 * Only schedules stages that:
 * - are enabled
 * - fall within the next 90 days (keeps us well under the iOS 64-notification cap)
 * - are in the future
 */
export async function scheduleMaintenanceReminder(
  task: ReminderTask,
  bikeName: string,
): Promise<void> {
  const dueDate = new Date(task.dueDate);
  const daysUntilDue = differenceInCalendarDays(dueDate, new Date());

  if (daysUntilDue < 0 || daysUntilDue > 90) return;

  // Cancel any existing stages for this task first
  await cancelTaskNotification(task.id);

  const scheduledIds = await scheduleStages({
    targetDate: dueDate,
    channelId: 'maintenance',
    stages: [
      { daysBefore: 30, enabled: task.remind30d ?? false, label: '30d' },
      { daysBefore: 7, enabled: task.remind7d ?? false, label: '7d' },
      { daysBefore: 1, enabled: task.remind1d ?? true, label: '1d' },
    ],
    buildContent: (label) => {
      const { title, body } = STAGE_COPY[label](task.title, bikeName);
      return {
        title,
        body,
        data: { motorcycleId: task.motorcycleId, taskId: task.id, stage: label },
        // Only the 1-day notification keeps the actionable category — earlier
        // stages are informational (per PRD open questions).
        ...(label === '1d'
          ? { categoryIdentifier: NOTIFICATION_CATEGORY.MAINTENANCE_REMINDER }
          : {}),
      };
    },
  });

  if (scheduledIds.length > 0) {
    await setNotificationIds(task.id, scheduledIds);
  }
}

// P3-118/119: exhaustive union type kills the dead default case and gives
// us a compile error if a new stage is added without matching copy.
type Stage = '30d' | '7d' | '1d';

const STAGE_COPY: Record<
  Stage,
  (taskTitle: string, bikeName: string) => { title: string; body: string }
> = {
  '30d': (taskTitle, bikeName) => ({
    title: `${taskTitle} in 30 days`,
    body: `${bikeName} — time to order parts if needed`,
  }),
  '7d': (taskTitle, bikeName) => ({
    title: `${taskTitle} in 7 days`,
    body: `${bikeName} — book your shop appointment`,
  }),
  '1d': (taskTitle, bikeName) => ({
    title: `${taskTitle} due tomorrow`,
    body: `${bikeName} — tap to view details`,
  }),
};

/**
 * Cancel all scheduled notification stages for a specific task.
 */
export async function cancelTaskNotification(taskId: string): Promise<void> {
  const map = await getNotificationMap();
  const notificationIds = map[taskId] ?? [];
  for (const id of notificationIds) {
    await Notifications.cancelScheduledNotificationAsync(id);
  }
  if (notificationIds.length > 0) {
    await removeNotificationIds(taskId);
  }
}

/**
 * Cancel all scheduled notifications and clear the mapping.
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.removeItem(NOTIFICATION_MAP_KEY);
}

// ============================================================================
// Document expiry reminders (Bike Document Vault, U11)
//
// Mirrors scheduleMaintenanceReminder: 30/7/1 stages at 09:00 local, skip past
// stages, bail when the expiry is <0 or >90 days out (iOS 64-budget guard).
// Uses a SEPARATE `doc:` keyspace in the same notification map and a
// DOCUMENT_EXPIRY action category (no "Mark Done"). Reminders key off the
// document's expiry_date only — category rename/hide never affects them (R8).
// ============================================================================

/** Map key namespace so document ids never collide with maintenance task ids. */
const docKey = (documentId: string) => `doc:${documentId}`;

interface DocumentReminder {
  id: string;
  title: string;
  expiryDate: string;
  motorcycleId: string;
}

const DOC_STAGE_COPY: Record<
  Stage,
  (title: string, bikeName: string) => { title: string; body: string }
> = {
  '30d': (title, bikeName) => ({
    title: `${title} expires in 30 days`,
    body: `${bikeName} — start the renewal`,
  }),
  '7d': (title, bikeName) => ({
    title: `${title} expires in 7 days`,
    body: `${bikeName} — renew this week`,
  }),
  '1d': (title, bikeName) => ({
    title: `${title} expires tomorrow`,
    body: `${bikeName} — tap to view the document`,
  }),
};

export async function scheduleDocumentExpiryReminder(
  doc: DocumentReminder,
  bikeName: string,
): Promise<void> {
  // expiryDate is a date-only string (YYYY-MM-DD). `new Date('2026-08-01')` parses
  // as UTC midnight, which in negative-UTC (Americas) timezones is the PREVIOUS
  // calendar day locally — shifting every reminder stage one day early. Append a
  // local time component so the date anchors to local midnight on the right day.
  const expiry = new Date(`${doc.expiryDate}T00:00:00`);
  const now = new Date();
  const daysUntil = differenceInCalendarDays(expiry, now);

  // Always clear existing stages first so an expiry edit reschedules cleanly.
  await cancelDocumentNotifications(doc.id);
  if (daysUntil < 0 || daysUntil > 90) return;

  const scheduledIds = await scheduleStages({
    targetDate: expiry,
    channelId: 'documents',
    stages: [
      { daysBefore: 30, enabled: true, label: '30d' },
      { daysBefore: 7, enabled: true, label: '7d' },
      { daysBefore: 1, enabled: true, label: '1d' },
    ],
    buildContent: (label) => {
      const { title, body } = DOC_STAGE_COPY[label](doc.title, bikeName);
      return {
        title,
        body,
        data: {
          kind: NOTIFICATION_KIND.DOCUMENT,
          documentId: doc.id,
          motorcycleId: doc.motorcycleId,
          stage: label,
        },
        ...(label === '1d' ? { categoryIdentifier: NOTIFICATION_CATEGORY.DOCUMENT_EXPIRY } : {}),
      };
    },
  });

  if (scheduledIds.length > 0) {
    await setNotificationIds(docKey(doc.id), scheduledIds);
  }
}

/** Cancel all scheduled expiry stages for a document (on delete or expiry clear). */
export async function cancelDocumentNotifications(documentId: string): Promise<void> {
  const map = await getNotificationMap();
  const key = docKey(documentId);
  const ids = map[key] ?? [];
  for (const id of ids) {
    await Notifications.cancelScheduledNotificationAsync(id);
  }
  if (ids.length > 0) {
    await removeNotificationIds(key);
  }
}

/**
 * Cancel every scheduled document-expiry reminder for one bike. Used when a bike
 * is (soft-)deleted: its documents are hidden from the rider, so their reminders
 * must stop firing even though the document rows are retained server-side. The map
 * is keyed by document id, so we scan scheduled notifications by data.motorcycleId.
 */
export async function cancelDocumentNotificationsForBike(motorcycleId: string): Promise<void> {
  let scheduled: Notifications.NotificationRequest[];
  try {
    scheduled = await Notifications.getAllScheduledNotificationsAsync();
  } catch {
    return;
  }

  const clearedDocumentIds = new Set<string>();
  for (const n of scheduled) {
    const data = n.content.data as { kind?: string; motorcycleId?: string; documentId?: string };
    if (data?.kind === NOTIFICATION_KIND.DOCUMENT && data.motorcycleId === motorcycleId) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
      if (data.documentId) clearedDocumentIds.add(data.documentId);
    }
  }

  if (clearedDocumentIds.size > 0) {
    const map = await getNotificationMap();
    for (const id of clearedDocumentIds) delete map[docKey(id)];
    await AsyncStorage.setItem(NOTIFICATION_MAP_KEY, JSON.stringify(map));
  }
}

/**
 * Reschedule a notification for +1 day from now at 9:00 AM.
 */
export async function snoozeTaskNotification(
  task: { id: string; title: string; motorcycleId: string },
  bikeName: string,
): Promise<void> {
  await cancelTaskNotification(task.id);

  const snoozeDate = new Date();
  snoozeDate.setDate(snoozeDate.getDate() + 1);
  snoozeDate.setHours(9, 0, 0, 0);

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Reminder: ${task.title}`,
      body: `${bikeName} — snoozed reminder`,
      data: { motorcycleId: task.motorcycleId, taskId: task.id },
      categoryIdentifier: NOTIFICATION_CATEGORY.MAINTENANCE_REMINDER,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: snoozeDate,
      channelId: 'maintenance',
    },
  });

  await setNotificationIds(task.id, [id]);
}

// ============================================================================
// Parked receipt-scan reminders (U6 review-later)
//
// When a rider parks a successfully-extracted scan for later, we fire a single
// next-day 09:00 local reminder — the same primitive as snoozeTaskNotification.
// The home priority card is the guaranteed recovery surface (works even when
// notifications are denied); this reminder is the nudge on top of it.
// ============================================================================

/** Map key namespace so scan ids never collide with task/document ids. */
const scanKey = (scanId: string) => `scan:${scanId}`;

/**
 * Schedule a next-day 09:00 reminder to review a parked scan. No-op without
 * notification permission (the home card still surfaces it — the card is the
 * fallback, the notification is the nudge).
 */
export async function scheduleParkedScanReminder(
  scanId: string,
  bikeName: string,
  vendor?: string | null,
): Promise<void> {
  if (!(await hasNotificationPermission())) return;

  await cancelScanNotification(scanId);

  const reminderDate = new Date();
  reminderDate.setDate(reminderDate.getDate() + 1);
  reminderDate.setHours(9, 0, 0, 0);

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Finish your receipt',
        body: vendor
          ? `${vendor} — tap to review and save to ${bikeName}`
          : `Tap to review and save to ${bikeName}`,
        data: { kind: NOTIFICATION_KIND.RECEIPT_SCAN, scanId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderDate,
        channelId: 'receipt-scans',
      },
    });
    await setNotificationIds(scanKey(scanId), [id]);
  } catch (err) {
    logger.warn('notifications: failed to schedule parked-scan reminder', err);
  }
}

/** Cancel a parked-scan reminder once the scan is reviewed/saved or dismissed. */
export async function cancelScanNotification(scanId: string): Promise<void> {
  const map = await getNotificationMap();
  const key = scanKey(scanId);
  const ids = map[key] ?? [];
  for (const id of ids) {
    await Notifications.cancelScheduledNotificationAsync(id);
  }
  if (ids.length > 0) {
    await removeNotificationIds(key);
  }
}

// ============================================================================
// Launch-time reconciliation
//
// Reminders are scheduled at task/document mutation time, but the dominant
// sources of tasks never pass through those screens: OEM tasks auto-populated
// server-side on bike add, recurring next-occurrences created on completion,
// tasks that predate the user granting notification permission, and edits made
// on another device. Without reconciliation those tasks have NO local reminder.
// This runs on app launch (and after task refreshes) to guarantee every
// upcoming, incomplete, date-based task has its reminder scheduled, and clears
// reminders for tasks that are no longer upcoming (completed / deleted / past).
// ============================================================================

interface ReconcileTask {
  id: string;
  title: string;
  dueDate?: string | null;
  status: string;
  motorcycleId: string;
  remind30d?: boolean | null;
  remind7d?: boolean | null;
  remind1d?: boolean | null;
}

const ACTIVE_TASK_STATUSES = new Set(['pending', 'in_progress']);

/**
 * Idempotently ensure every upcoming, incomplete, date-based maintenance task has
 * its reminder scheduled, and cancel reminders for tasks that are no longer active.
 * No-op without notification permission. Safe to call on every launch: already
 * scheduled tasks are skipped (no churn), and scheduleMaintenanceReminder itself
 * cancels+reschedules per task.
 */
export async function reconcileMaintenanceReminders(
  tasks: ReconcileTask[],
  bikeNames: Record<string, string>,
): Promise<void> {
  if (!(await hasNotificationPermission())) return;

  const map = await getNotificationMap();
  const activeIds = new Set<string>();

  for (const task of tasks) {
    const isActive = ACTIVE_TASK_STATUSES.has(task.status) && !!task.dueDate;
    if (!isActive) continue;
    activeIds.add(task.id);
    // Already scheduled — leave it (avoids re-scheduling churn on every launch).
    if (map[task.id]?.length) continue;
    await scheduleMaintenanceReminder(
      {
        id: task.id,
        title: task.title,
        dueDate: task.dueDate as string,
        motorcycleId: task.motorcycleId,
        remind30d: task.remind30d ?? undefined,
        remind7d: task.remind7d ?? undefined,
        remind1d: task.remind1d ?? undefined,
      },
      bikeNames[task.motorcycleId] ?? 'Your bike',
    );
  }

  // Clear reminders for maintenance tasks no longer active (completed, deleted,
  // or now past-due). Skip the document keyspace, which reconciles separately.
  for (const key of Object.keys(map)) {
    // Skip other feature keyspaces — documents and parked scans reconcile
    // separately and must not be swept by the maintenance reconciler.
    if (key.startsWith('doc:') || key.startsWith('scan:')) continue;
    if (!activeIds.has(key)) {
      await cancelTaskNotification(key);
    }
  }
}
