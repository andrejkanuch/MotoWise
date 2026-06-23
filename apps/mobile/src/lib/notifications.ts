import { palette } from '@motovault/design-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { differenceInCalendarDays } from 'date-fns';
import * as Notifications from 'expo-notifications';

/** Notification `data.kind` discriminator — shared with the tap handler in _layout. */
export const NOTIFICATION_KIND = { DOCUMENT: 'document' } as const;

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
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync('documents', {
    name: 'Document Renewal Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: palette.signature500,
    sound: 'default',
  });
}

/**
 * Register actionable notification categories (Mark Done / Snooze).
 */
export async function setupNotificationCategories(): Promise<void> {
  await Notifications.setNotificationCategoryAsync('MAINTENANCE_REMINDER', [
    {
      buttonTitle: 'Mark Done',
      identifier: 'MARK_DONE',
      options: { opensAppToForeground: false },
    },
    {
      buttonTitle: 'Snooze 1 Day',
      identifier: 'SNOOZE_1D',
      options: { opensAppToForeground: false },
    },
  ]);
  // Document expiry — informational/renewal; no "Mark Done" (R8: keyed off expiry).
  await Notifications.setNotificationCategoryAsync('DOCUMENT_EXPIRY', [
    {
      buttonTitle: 'View',
      identifier: 'VIEW_DOCUMENT',
      options: { opensAppToForeground: true },
    },
    {
      buttonTitle: 'Snooze 1 Day',
      identifier: 'SNOOZE_1D',
      options: { opensAppToForeground: false },
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
  const now = new Date();
  const daysUntilDue = differenceInCalendarDays(dueDate, now);

  if (daysUntilDue < 0 || daysUntilDue > 90) return;

  // Cancel any existing stages for this task first
  await cancelTaskNotification(task.id);

  const stages: Array<{ daysBefore: number; enabled: boolean; label: Stage }> = [
    { daysBefore: 30, enabled: task.remind30d ?? false, label: '30d' },
    { daysBefore: 7, enabled: task.remind7d ?? false, label: '7d' },
    { daysBefore: 1, enabled: task.remind1d ?? true, label: '1d' },
  ];

  const scheduledIds: string[] = [];

  for (const stage of stages) {
    if (!stage.enabled) continue;

    const reminderDate = new Date(dueDate);
    reminderDate.setDate(reminderDate.getDate() - stage.daysBefore);
    reminderDate.setHours(9, 0, 0, 0);

    // Skip stages whose reminder date is already in the past
    if (reminderDate <= now) continue;

    const { title, body } = STAGE_COPY[stage.label](task.title, bikeName);

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { motorcycleId: task.motorcycleId, taskId: task.id, stage: stage.label },
        // Only the 1-day notification keeps the actionable category — earlier
        // stages are informational (per PRD open questions).
        ...(stage.label === '1d' ? { categoryIdentifier: 'MAINTENANCE_REMINDER' } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderDate,
        channelId: 'maintenance',
      },
    });

    scheduledIds.push(id);
  }

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
  const expiry = new Date(doc.expiryDate);
  const now = new Date();
  const daysUntil = differenceInCalendarDays(expiry, now);

  // Always clear existing stages first so an expiry edit reschedules cleanly.
  await cancelDocumentNotifications(doc.id);
  if (daysUntil < 0 || daysUntil > 90) return;

  const stages: Array<{ daysBefore: number; label: Stage }> = [
    { daysBefore: 30, label: '30d' },
    { daysBefore: 7, label: '7d' },
    { daysBefore: 1, label: '1d' },
  ];

  const scheduledIds: string[] = [];
  try {
    for (const stage of stages) {
      const reminderDate = new Date(expiry);
      reminderDate.setDate(reminderDate.getDate() - stage.daysBefore);
      reminderDate.setHours(9, 0, 0, 0);
      if (reminderDate <= now) continue;

      const { title, body } = DOC_STAGE_COPY[stage.label](doc.title, bikeName);
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: {
            kind: NOTIFICATION_KIND.DOCUMENT,
            documentId: doc.id,
            motorcycleId: doc.motorcycleId,
            stage: stage.label,
          },
          ...(stage.label === '1d' ? { categoryIdentifier: 'DOCUMENT_EXPIRY' } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminderDate,
          channelId: 'documents',
        },
      });
      scheduledIds.push(id);
    }
  } finally {
    // Persist whatever was scheduled — even if a stage failed mid-loop — so
    // cancelDocumentNotifications can later cancel every stage we registered.
    if (scheduledIds.length > 0) {
      await setNotificationIds(docKey(doc.id), scheduledIds);
    }
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
      categoryIdentifier: 'MAINTENANCE_REMINDER',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: snoozeDate,
      channelId: 'maintenance',
    },
  });

  await setNotificationIds(task.id, [id]);
}
