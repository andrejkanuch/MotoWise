import { palette } from '@motovault/design-system';
import type { MaintenanceTasksByMotorcycleQuery } from '@motovault/graphql';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Wrench } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { PRIORITY_ORDER, SwipeableTaskCard } from './swipeable-task-card';

type Task = MaintenanceTasksByMotorcycleQuery['maintenanceTasks'][number];

function haptic() {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

interface MaintenanceSectionProps {
  tasks: Task[];
  isDark: boolean;
  motorcycleId: string;
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string, title: string) => void;
}

export function MaintenanceSection({
  tasks,
  isDark,
  motorcycleId,
  expandedId,
  onToggleExpand,
  onComplete,
  onDelete,
}: MaintenanceSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  const activeTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.status === 'pending' || task.status === 'in_progress')
        .sort((a, b) => {
          // Overdue first
          const aOverdue = a.dueDate ? new Date(a.dueDate) < new Date() : false;
          const bOverdue = b.dueDate ? new Date(b.dueDate) < new Date() : false;
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
        }),
    [tasks],
  );

  const completedTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.status === 'completed')
        .sort((a, b) => {
          const aDate = a.completedAt ? new Date(a.completedAt).getTime() : 0;
          const bDate = b.completedAt ? new Date(b.completedAt).getTime() : 0;
          return bDate - aDate;
        }),
    [tasks],
  );

  const overdueCount = useMemo(
    () =>
      activeTasks.filter((task) => {
        if (!task.dueDate) return false;
        return new Date(task.dueDate) < new Date();
      }).length,
    [activeTasks],
  );

  const displayedTasks =
    activeTab === 'active' ? activeTasks.slice(0, 5) : completedTasks.slice(0, 5);
  const totalCount = activeTab === 'active' ? activeTasks.length : completedTasks.length;
  const hasMore = totalCount > 5;

  const handleSeeAll = () => {
    haptic();
    router.push({
      pathname: '/(tabs)/(garage)/bike-tasks',
      params: { motorcycleId },
    });
  };

  if (tasks.length === 0) {
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
          {t('maintenance.noTasks', { defaultValue: 'No maintenance tasks yet' })}
        </Text>
        <Text
          style={{
            fontSize: 13,
            color: palette.neutral500,
            marginTop: 4,
            textAlign: 'center',
          }}
        >
          {t('maintenance.addFirstTask', { defaultValue: 'Add your first maintenance task' })}
        </Text>
      </Animated.View>
    );
  }

  return (
    <View style={{ paddingHorizontal: 20 }}>
      {/* Section header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: '700',
              color: isDark ? palette.neutral50 : palette.neutral950,
            }}
          >
            {t('bikeHub.maintenance', { defaultValue: 'Maintenance' })}
          </Text>
          {overdueCount > 0 && (
            <View
              style={{
                backgroundColor: palette.danger500,
                borderRadius: 10,
                borderCurve: 'continuous',
                paddingHorizontal: 7,
                paddingVertical: 2,
                minWidth: 20,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: palette.white }}>
                {overdueCount}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: isDark ? palette.neutral800 : palette.neutral100,
          borderRadius: 10,
          borderCurve: 'continuous',
          padding: 3,
          marginBottom: 12,
        }}
      >
        {(['active', 'history'] as const).map((tab) => {
          const isSelected = activeTab === tab;
          const label =
            tab === 'active'
              ? t('maintenance.activeTasks', { defaultValue: 'Active' })
              : t('maintenance.history', { defaultValue: 'History' });
          const count = tab === 'active' ? activeTasks.length : completedTasks.length;

          return (
            <Pressable
              key={tab}
              onPress={() => {
                haptic();
                setActiveTab(tab);
              }}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 8,
                borderCurve: 'continuous',
                backgroundColor: isSelected
                  ? isDark
                    ? palette.neutral700
                    : palette.white
                  : 'transparent',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: isSelected
                    ? isDark
                      ? palette.neutral50
                      : palette.neutral950
                    : palette.neutral500,
                }}
              >
                {label} ({count})
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Task list */}
      {displayedTasks.length === 0 ? (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={{
            alignItems: 'center',
            paddingVertical: 24,
            backgroundColor: isDark ? palette.neutral800 : palette.white,
            borderRadius: 14,
            borderCurve: 'continuous',
          }}
        >
          <Text
            style={{
              fontSize: 14,
              color: palette.neutral500,
            }}
          >
            {activeTab === 'active'
              ? t('bikeHub.allCaughtUp', { defaultValue: 'All caught up!' })
              : t('maintenance.noHistory', { defaultValue: 'No completed tasks yet' })}
          </Text>
        </Animated.View>
      ) : (
        displayedTasks.map((task, index) => (
          <SwipeableTaskCard
            key={task.id}
            task={task}
            index={index}
            isDark={isDark}
            expandedId={expandedId}
            motorcycleId={motorcycleId}
            onToggleExpand={onToggleExpand}
            onComplete={onComplete}
            onDelete={onDelete}
          />
        ))
      )}

      {/* See all link */}
      {hasMore && (
        <Pressable
          onPress={handleSeeAll}
          style={{
            alignItems: 'center',
            paddingVertical: 10,
            marginTop: 4,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: palette.primary500 }}>
            {t('bikeHub.seeAll', { defaultValue: 'See all tasks' })} ({totalCount})
          </Text>
        </Pressable>
      )}
    </View>
  );
}
