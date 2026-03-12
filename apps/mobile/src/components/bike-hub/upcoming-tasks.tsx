import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { Calendar, ChevronRight, Gauge, Wrench } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { getRelativeDueDate } from '../../lib/health-score';

const PRIORITY_COLORS: Record<string, string> = {
  critical: palette.danger500,
  high: palette.warning500,
  medium: palette.primary500,
  low: palette.success500,
};

interface Task {
  id: string;
  title: string;
  dueDate?: string | null;
  targetMileage?: number | null;
  priority: string;
  status: string;
}

interface UpcomingTasksProps {
  tasks: Task[];
  isDark: boolean;
  onTaskPress: (taskId: string) => void;
  onSeeAllPress: () => void;
}

export function UpcomingTasks({ tasks, isDark, onTaskPress, onSeeAllPress }: UpcomingTasksProps) {
  const { t } = useTranslation();

  // Filter active tasks and sort by urgency
  const activeTasks = tasks
    .filter((task) => task.status === 'pending' || task.status === 'in_progress')
    .sort((a, b) => {
      // Overdue first
      const aOverdue = a.dueDate ? new Date(a.dueDate) < new Date() : false;
      const bOverdue = b.dueDate ? new Date(b.dueDate) < new Date() : false;
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;

      // Then by date (nearest first)
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;

      // Then by priority
      const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99);
    })
    .slice(0, 5);

  if (activeTasks.length === 0) {
    return (
      <Animated.View
        entering={FadeInUp.duration(400)}
        style={{ paddingHorizontal: 20, alignItems: 'center', paddingVertical: 30 }}
      >
        <Wrench size={32} color={palette.neutral400} strokeWidth={1.5} />
        <Text
          style={{
            fontSize: 15,
            fontWeight: '600',
            color: isDark ? palette.neutral300 : palette.neutral600,
            marginTop: 12,
          }}
        >
          {t('bikeHub.allCaughtUp', { defaultValue: 'All caught up!' })}
        </Text>
      </Animated.View>
    );
  }

  return (
    <View style={{ paddingHorizontal: 20 }}>
      <Text
        style={{
          fontSize: 13,
          fontWeight: '700',
          color: palette.neutral500,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: 10,
          marginLeft: 4,
        }}
      >
        {t('bikeHub.upcomingTasks', { defaultValue: 'Upcoming' })}
      </Text>

      {activeTasks.map((task, index) => {
        const relative = task.dueDate ? getRelativeDueDate(task.dueDate) : null;
        const priorityColor = PRIORITY_COLORS[task.priority] ?? palette.neutral500;

        return (
          <Animated.View key={task.id} entering={FadeInUp.delay(index * 50).duration(300)}>
            <Pressable
              onPress={() => {
                if (process.env.EXPO_OS === 'ios')
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onTaskPress(task.id);
              }}
              style={{
                backgroundColor: relative?.isOverdue
                  ? isDark
                    ? 'rgba(239,68,68,0.08)'
                    : 'rgba(239,68,68,0.05)'
                  : isDark
                    ? palette.neutral800
                    : palette.white,
                borderRadius: 12,
                borderCurve: 'continuous',
                padding: 14,
                marginBottom: 8,
                flexDirection: 'row',
                alignItems: 'center',
                borderLeftWidth: relative?.isOverdue ? 3 : 0,
                borderLeftColor: palette.danger500,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '600',
                    color: isDark ? palette.neutral50 : palette.neutral950,
                  }}
                >
                  {task.title}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  {relative && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Calendar
                        size={11}
                        color={relative.isOverdue ? palette.danger500 : palette.neutral400}
                      />
                      <Text
                        style={{
                          fontSize: 12,
                          color: relative.isOverdue ? palette.danger500 : palette.neutral400,
                        }}
                      >
                        {String(t(relative.key as never, relative.params as never))}
                      </Text>
                    </View>
                  )}
                  {task.targetMileage && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Gauge size={11} color={palette.neutral400} />
                      <Text style={{ fontSize: 12, color: palette.neutral400 }}>
                        {task.targetMileage.toLocaleString()} mi
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <View
                style={{
                  backgroundColor: `${priorityColor}20`,
                  borderRadius: 6,
                  borderCurve: 'continuous',
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  marginRight: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    color: priorityColor,
                    textTransform: 'uppercase',
                    letterSpacing: 0.3,
                  }}
                >
                  {String(
                    t(
                      `maintenance.priority${task.priority.charAt(0).toUpperCase()}${task.priority.slice(1)}` as never,
                    ),
                  )}
                </Text>
              </View>

              <ChevronRight size={16} color={palette.neutral400} />
            </Pressable>
          </Animated.View>
        );
      })}

      {tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').length > 5 && (
        <Pressable onPress={onSeeAllPress} style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: palette.primary500 }}>
            {t('bikeHub.seeAll', { defaultValue: 'See all tasks' })}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
