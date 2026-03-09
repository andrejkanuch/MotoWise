import * as Haptics from 'expo-haptics';

export function triggerImpact(
  style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light,
): void {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(style);
  }
}

export function triggerNotification(type: Haptics.NotificationFeedbackType): void {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.notificationAsync(type);
  }
}
