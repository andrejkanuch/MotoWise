import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const NOTIFICATION_MAP_KEY = '@motovault/notification-map';

// --- Internal helpers for taskId -> notificationId mapping ---

async function getNotificationMap(): Promise<Record<string, string>> {
  const raw = await AsyncStorage.getItem(NOTIFICATION_MAP_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

async function setNotificationId(taskId: string, notificationId: string): Promise<void> {
  const map = await getNotificationMap();
  map[taskId] = notificationId;
  await AsyncStorage.setItem(NOTIFICATION_MAP_KEY, JSON.stringify(map));
}

async function removeNotificationId(taskId: string): Promise<void> {
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

/**
 * Schedule a local push notification 1 day before a maintenance task is due.
 * Only schedules if the due date is within 30 days and in the future.
 */
export async function scheduleMaintenanceReminder(
  task: { id: string; title: string; dueDate: string; motorcycleId: string },
  bikeName: string,
): Promise<void> {
  const dueDate = new Date(task.dueDate);
  const now = new Date();
  const daysUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  if (daysUntilDue < 0 || daysUntilDue > 30) return;

  // Cancel any existing notification for this task
  await cancelTaskNotification(task.id);

  // Schedule 1 day before at 9:00 AM local time
  let reminderDate = new Date(dueDate);
  reminderDate.setDate(reminderDate.getDate() - 1);
  reminderDate.setHours(9, 0, 0, 0);

  // If the reminder date is already past, schedule 1 minute from now
  if (reminderDate <= now) {
    reminderDate = new Date(now.getTime() + 60_000);
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: `${task.title} due tomorrow`,
      body: `${bikeName} — tap to view details`,
      data: { motorcycleId: task.motorcycleId, taskId: task.id },
      categoryIdentifier: 'MAINTENANCE_REMINDER',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminderDate,
      channelId: 'maintenance',
    },
  });

  await setNotificationId(task.id, id);
}

/**
 * Cancel a scheduled notification for a specific task.
 */
export async function cancelTaskNotification(taskId: string): Promise<void> {
  const map = await getNotificationMap();
  const notificationId = map[taskId];
  if (notificationId) {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    await removeNotificationId(taskId);
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

  await setNotificationId(task.id, id);
}
