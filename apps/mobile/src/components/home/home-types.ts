import type { AlertTriangle } from 'lucide-react-native';

export type PriorityAction = {
  type: 'overdue' | 'upcoming' | 'learning' | 'allClear';
  title: string;
  subtitle: string;
  ctaLabel: string;
  accentColor: string;
  icon: typeof AlertTriangle;
  onPress: () => void;
};

export type TaskItem = {
  id: string;
  motorcycleId: string;
  title: string;
  dueDate?: string | null;
  priority: string;
  status: string;
};

export type TaskWithRelative = TaskItem & {
  relative: { text: string; isOverdue: boolean; daysAway: number };
};

export type FleetHealth = {
  score: number;
  hasData: boolean;
  bikeCount: number;
  needsAttention: number;
  totalOverdue: number;
  totalUrgent: number;
  upcomingTasks: number;
};

export type QuickAction = {
  key: string;
  icon: typeof AlertTriangle;
  titleKey: string;
  route: string;
  color: string;
  bgLight: string;
  bgDark: string;
};
