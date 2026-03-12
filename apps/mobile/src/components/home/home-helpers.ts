import { palette } from '@motovault/design-system';

export function getGreeting(): {
  key:
    | 'home.greetingMorning'
    | 'home.greetingAfternoon'
    | 'home.greetingEvening'
    | 'home.greetingNight';
  subtitleKey: string;
} {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { key: 'home.greetingMorning', subtitleKey: 'morning' };
  if (hour >= 12 && hour < 17) return { key: 'home.greetingAfternoon', subtitleKey: 'afternoon' };
  if (hour >= 17 && hour < 22) return { key: 'home.greetingEvening', subtitleKey: 'evening' };
  return { key: 'home.greetingNight', subtitleKey: 'night' };
}

export function getContextualSubtitleKey(
  subtitleTime: string,
  overdueTasks: number,
  upcomingThisWeek: number,
): { key: string; opts?: Record<string, unknown> } {
  if (overdueTasks > 0) {
    return { key: 'home.subtitleOverdue', opts: { count: overdueTasks } };
  }
  if (upcomingThisWeek > 0) {
    return { key: 'home.subtitleTasksThisWeek', opts: { count: upcomingThisWeek } };
  }
  switch (subtitleTime) {
    case 'morning':
      return { key: 'home.subtitleMorning' };
    case 'afternoon':
      return { key: 'home.subtitleAfternoon' };
    case 'evening':
      return { key: 'home.subtitleEvening' };
    default:
      return { key: 'home.subtitleNight' };
  }
}

export const DIFFICULTY_COLORS = {
  beginner: palette.success500,
  intermediate: palette.warning500,
  advanced: palette.danger500,
} as const;
