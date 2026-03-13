import { palette } from '@motovault/design-system';
import {
  DeleteMaintenanceTaskDocument,
  MaintenanceTasksByMotorcycleDocument,
  type MaintenanceTasksByMotorcycleQuery,
} from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Wrench } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  PRIORITY_ORDER,
  SwipeableTaskCard,
} from '../../../components/bike-hub/swipeable-task-card';
import { gqlFetcher } from '../../../lib/graphql-client';
import { haptic } from '../../../lib/haptics';
import { queryKeys } from '../../../lib/query-keys';

type Task = MaintenanceTasksByMotorcycleQuery['maintenanceTasks'][number];
type FilterTab = 'all' | 'overdue' | 'upcoming' | 'completed';

export default function BikeTasksScreen() {
  const { t } = useTranslation();
  const { motorcycleId, bikeName } = useLocalSearchParams<{
    motorcycleId: string;
    bikeName?: string;
  }>();
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const {
    data: tasksData,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: queryKeys.maintenanceTasks.byMotorcycle(motorcycleId),
    queryFn: () => gqlFetcher(MaintenanceTasksByMotorcycleDocument, { motorcycleId }),
  });

  const tasks: Task[] = tasksData?.maintenanceTasks ?? [];

  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => gqlFetcher(DeleteMaintenanceTaskDocument, { id: taskId }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.maintenanceTasks.byMotorcycle(motorcycleId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceTasks.allUser });
    },
    onError: () => {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('maintenance.deleteFailed', { defaultValue: 'Failed to delete task.' }),
      );
    },
  });

  const filteredTasks = useMemo(() => {
    const now = Date.now();
    let filtered: Task[];

    switch (activeFilter) {
      case 'overdue':
        filtered = tasks.filter(
          (task) =>
            (task.status === 'pending' || task.status === 'in_progress') &&
            task.dueDate &&
            new Date(task.dueDate).getTime() < now,
        );
        break;
      case 'upcoming':
        filtered = tasks.filter(
          (task) =>
            (task.status === 'pending' || task.status === 'in_progress') &&
            (!task.dueDate || new Date(task.dueDate).getTime() >= now),
        );
        break;
      case 'completed':
        filtered = tasks.filter((task) => task.status === 'completed');
        break;
      default:
        filtered = tasks;
    }

    return filtered.sort((a, b) => {
      // Completed at bottom for 'all' tab
      if (activeFilter === 'all') {
        const aCompleted = a.status === 'completed';
        const bCompleted = b.status === 'completed';
        if (aCompleted && !bCompleted) return 1;
        if (!aCompleted && bCompleted) return -1;
      }

      // Overdue first
      const aOverdue = a.dueDate ? new Date(a.dueDate).getTime() < now : false;
      const bOverdue = b.dueDate ? new Date(b.dueDate).getTime() < now : false;
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;

      // Then by date
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;

      // Then by priority
      return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
    });
  }, [tasks, activeFilter]);

  const handleToggleExpand = useCallback(
    (taskId: string) => setExpandedId((prev) => (prev === taskId ? null : taskId)),
    [],
  );

  const handleComplete = (taskId: string) => {
    router.push({
      pathname: '/(tabs)/(garage)/complete-task',
      params: { taskId, motorcycleId, bikeName: bikeName ?? '' },
    });
  };

  const handleDelete = (taskId: string, taskTitle: string) => {
    Alert.alert(
      t('maintenance.deleteTask', { defaultValue: 'Delete Task' }),
      t('maintenance.confirmDeleteTask', {
        defaultValue: `Delete "${taskTitle}"?`,
        title: taskTitle,
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => deleteMutation.mutate(taskId),
        },
      ],
    );
  };

  const filters: { key: FilterTab; label: string }[] = [
    { key: 'all', label: t('common.all', { defaultValue: 'All' }) },
    { key: 'overdue', label: t('maintenance.overdue', { defaultValue: 'Overdue' }) },
    { key: 'upcoming', label: t('bikeHub.upcomingTasks', { defaultValue: 'Upcoming' }) },
    { key: 'completed', label: t('maintenance.completed', { defaultValue: 'Completed' }) },
  ];

  const emptyMessages: Record<FilterTab, { title: string; subtitle: string }> = {
    all: {
      title: t('maintenance.noTasks', { defaultValue: 'No maintenance tasks yet' }),
      subtitle: t('maintenance.noTasksHint', {
        defaultValue: 'Add tasks to track oil changes, tire wear, and more.',
      }),
    },
    overdue: {
      title: t('maintenance.noOverdue', { defaultValue: 'No overdue tasks' }),
      subtitle: t('maintenance.noOverdueHint', { defaultValue: "You're all caught up." }),
    },
    upcoming: {
      title: t('maintenance.noUpcoming', { defaultValue: 'No upcoming tasks' }),
      subtitle: t('maintenance.noUpcomingHint', {
        defaultValue: 'Nothing scheduled in the next 30 days.',
      }),
    },
    completed: {
      title: t('maintenance.noCompleted', { defaultValue: 'No completed tasks yet' }),
      subtitle: t('maintenance.noCompletedHint', {
        defaultValue: 'Completed tasks will appear here.',
      }),
    },
  };

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? palette.neutral900 : palette.neutral50 }}>
      {/* Filter tabs */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {filters.map((filter) => {
            const isSelected = activeFilter === filter.key;
            return (
              <Pressable
                key={filter.key}
                onPress={() => {
                  haptic();
                  setActiveFilter(filter.key);
                }}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  borderCurve: 'continuous',
                  backgroundColor: isSelected
                    ? palette.primary500
                    : isDark
                      ? palette.neutral800
                      : palette.neutral100,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: isSelected
                      ? palette.white
                      : isDark
                        ? palette.neutral300
                        : palette.neutral600,
                  }}
                >
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Task list */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 20,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={palette.primary500}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {filteredTasks.length === 0 ? (
          <Animated.View
            entering={FadeIn.duration(300)}
            style={{
              alignItems: 'center',
              paddingVertical: 60,
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                borderCurve: 'continuous',
                backgroundColor: isDark ? palette.neutral800 : palette.neutral100,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Wrench size={28} color={palette.neutral400} strokeWidth={1.5} />
            </View>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '700',
                color: isDark ? palette.neutral200 : palette.neutral800,
                marginTop: 16,
              }}
            >
              {emptyMessages[activeFilter].title}
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontWeight: '500',
                color: palette.neutral500,
                marginTop: 4,
                textAlign: 'center',
                maxWidth: 260,
              }}
            >
              {emptyMessages[activeFilter].subtitle}
            </Text>
          </Animated.View>
        ) : (
          filteredTasks.map((task, index) => (
            <SwipeableTaskCard
              key={task.id}
              task={task}
              index={index}
              isDark={isDark}
              isExpanded={expandedId === task.id}
              motorcycleId={motorcycleId}
              onToggleExpand={handleToggleExpand}
              onComplete={handleComplete}
              onDelete={handleDelete}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}
