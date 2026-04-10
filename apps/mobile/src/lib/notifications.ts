import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

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
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('maintenance', {
    name: 'Maintenance Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF6B35',
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
}

/**
 * Request notification permissions from the user.
 * Returns true if granted.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
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
  const daysUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

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

    const { title, body } = buildStageNotificationCopy(stage.label, task.title, bikeName);

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

const STAGE_COPY: Record<Stage, (taskTitle: string, bikeName: string) => { title: string; body: string }> = {
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

function buildStageNotificationCopy(
  stage: Stage,
  taskTitle: string,
  bikeName: string,
): { title: string; body: string } {
  return STAGE_COPY[stage](taskTitle, bikeName);
}

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
