import {
  DeleteMaintenanceTaskDocument,
  MaintenanceTaskStatus,
  MaintenanceTasksByMotorcycleDocument,
  MyMotorcyclesDocument,
} from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ParseKeys } from 'i18next';
import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, FadeOutLeft, LinearTransition } from 'react-native-reanimated';
import { HistoryTaskRow, ServiceTaskRow } from '@/components/bike-hub/service/task-row';
import type { HubTask } from '@/components/bike-hub/shell/use-bike-hub-data';
import { useToday } from '@/components/bike-hub/shell/use-today';
import { useHubBottomLayout } from '@/components/bike-hub/ui/bottom-layout';
import { HubCard } from '@/components/bike-hub/ui/hub-card';
import { SectionHeader } from '@/components/bike-hub/ui/section-header';
import { useHubTheme } from '@/components/bike-hub/ui/tokens';
import { ThemedSegmentedControl } from '@/components/ui/themed-segmented-control';
import { useMileageUnit } from '@/hooks/use-mileage-unit';
import {
  filterAndSortTasks,
  parseTaskFilter,
  TASK_FILTER,
  TASK_FILTERS,
  type TaskFilter,
} from '@/lib/bike-hub/all-tasks';
import { getTaskDue } from '@/lib/bike-hub/task-due';
import { gqlFetcher } from '@/lib/graphql-client';
import { queryKeys } from '@/lib/query-keys';
import { QUERY_META } from '@/lib/query-meta';
import { GUTTER, readableWidth, space, type } from '@/theme/type';
import { triggerImpact, triggerNotification } from '@/utils/haptics';

const NO_TASKS: HubTask[] = [];
/** Rows past this index enter together instead of waiting their turn. */
const MAX_STAGGERED = 5;
const STAGGER_MS = 50;
const ENTER_MS = 250;
const EXIT_MS = 250;
const LAYOUT_MS = 200;

const FILTER_LABEL_KEY: Record<TaskFilter, ParseKeys> = {
  [TASK_FILTER.ALL]: 'common.all',
  // Sentence case: `maintenance.overdue` is the old upper-case badge copy.
  [TASK_FILTER.OVERDUE]: 'bikeHub.service.group.overdue',
  [TASK_FILTER.UPCOMING]: 'bikeHub.upcomingTasks',
  [TASK_FILTER.COMPLETED]: 'maintenance.completed',
};

const EMPTY_COPY_KEY: Record<TaskFilter, { title: ParseKeys; subtitle: ParseKeys }> = {
  [TASK_FILTER.ALL]: { title: 'maintenance.noTasks', subtitle: 'maintenance.noTasksHint' },
  [TASK_FILTER.OVERDUE]: { title: 'maintenance.noOverdue', subtitle: 'maintenance.noOverdueHint' },
  [TASK_FILTER.UPCOMING]: {
    title: 'maintenance.noUpcoming',
    subtitle: 'maintenance.noUpcomingHint',
  },
  [TASK_FILTER.COMPLETED]: {
    title: 'maintenance.noCompleted',
    subtitle: 'maintenance.noCompletedHint',
  },
};

/** Staggered enter (index × 50 ms, capped), slide-out on delete, smooth reflow. */
function RowMotion({ index, children }: { index: number; children: ReactNode }) {
  return (
    <Animated.View
      entering={FadeInUp.delay(Math.min(index, MAX_STAGGERED) * STAGGER_MS).duration(ENTER_MS)}
      exiting={FadeOutLeft.duration(EXIT_MS)}
      layout={LinearTransition.duration(LAYOUT_MS)}
    >
      {children}
    </Animated.View>
  );
}

/** What is true for this filter, and what happens next — on a plain grouped card. */
function EmptyState({ filter }: { filter: TaskFilter }) {
  const { t } = useTranslation();
  const hub = useHubTheme();
  const copy = EMPTY_COPY_KEY[filter];
  return (
    <Animated.View entering={FadeIn.duration(ENTER_MS)} testID={`bike-tasks-empty-${filter}`}>
      <HubCard style={{ paddingVertical: space.md, paddingHorizontal: space.md, gap: space.xxs }}>
        <Text style={[type.bodyStrong, { color: hub.text }]}>{t(copy.title)}</Text>
        <Text style={[type.subhead, { color: hub.dim }]}>{t(copy.subtitle)}</Text>
      </HubCard>
    </Animated.View>
  );
}

export default function BikeTasksScreen() {
  const { t } = useTranslation();
  const { motorcycleId, bikeName, initialFilter, expandTaskId } = useLocalSearchParams<{
    motorcycleId: string;
    bikeName?: string;
    // Deep-link params (e.g. from an expense's linked service record): open on a
    // given filter tab with a specific task already expanded.
    initialFilter?: TaskFilter;
    expandTaskId?: string;
  }>();
  // Unit follows the user's profile preference, not the deprecated per-bike field.
  const mileageUnit = useMileageUnit();
  const router = useRouter();
  const hub = useHubTheme();
  const queryClient = useQueryClient();
  const today = useToday();
  const { tabBarClearance } = useHubBottomLayout();

  const [activeFilter, setActiveFilter] = useState<TaskFilter>(() =>
    parseTaskFilter(initialFilter),
  );
  const [expandedId, setExpandedId] = useState<string | null>(expandTaskId ?? null);

  const {
    data: tasksData,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: queryKeys.maintenanceTasks.byMotorcycle(motorcycleId),
    queryFn: () => gqlFetcher(MaintenanceTasksByMotorcycleDocument, { motorcycleId }),
  });
  // Only the due line's wording ("In 1,833 km", "Honda schedule"); without it
  // the rows fall back to the target itself and a generic schedule name.
  const { data: bikesData } = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
    meta: QUERY_META.DECORATION,
  });

  const tasks = tasksData?.maintenanceTasks ?? NO_TASKS;
  const bike = bikesData?.myMotorcycles.find((motorcycle) => motorcycle.id === motorcycleId);
  const odometer = bike?.currentMileage;
  const make = bike?.make ?? '';

  // Set the moment a delete is confirmed: a second confirm (a second alert opened
  // while the first delete is in flight) is ignored instead of sent twice.
  const deletePendingRef = useRef(false);
  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => gqlFetcher(DeleteMaintenanceTaskDocument, { id: taskId }),
    onSettled: () => {
      deletePendingRef.current = false;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.maintenanceTasks.byMotorcycle(motorcycleId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceTasks.allUser });
      triggerNotification(Haptics.NotificationFeedbackType.Warning);
    },
    onError: () => {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('maintenance.deleteFailed', { defaultValue: 'Failed to delete task.' }),
      );
    },
  });

  // The same due context as the rows, so a row that reads overdue is filed under Overdue.
  const filteredTasks = useMemo(
    () => filterAndSortTasks(tasks, activeFilter, { odometer, today, unit: mileageUnit }),
    [tasks, activeFilter, odometer, today, mileageUnit],
  );
  // On "All" the sort already put completed work last, so splitting keeps the order.
  const openTasks = filteredTasks.filter((task) => task.status !== MaintenanceTaskStatus.Completed);
  const doneTasks = filteredTasks.filter((task) => task.status === MaintenanceTaskStatus.Completed);
  const showSectionTitles = activeFilter === TASK_FILTER.ALL;

  const handleToggleExpand = useCallback(
    (taskId: string) => setExpandedId((prev) => (prev === taskId ? null : taskId)),
    [],
  );

  const handleComplete = useCallback(
    (taskId: string) => {
      router.push({
        pathname: '/(tabs)/(garage)/complete-task',
        params: { taskId, motorcycleId, bikeName: bikeName ?? '' },
      });
    },
    [router, motorcycleId, bikeName],
  );

  const handleEdit = useCallback(
    (taskId: string) => {
      router.push({
        pathname: '/(tabs)/(garage)/edit-maintenance-task',
        params: { taskId, motorcycleId, bikeName: bikeName ?? '' },
      });
    },
    [router, motorcycleId, bikeName],
  );

  const { mutate: deleteTask } = deleteMutation;
  const handleDelete = useCallback(
    (taskId: string, taskTitle: string) => {
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
            onPress: () => {
              if (deletePendingRef.current) return;
              deletePendingRef.current = true;
              deleteTask(taskId);
            },
          },
        ],
      );
    },
    [deleteTask, t],
  );

  const handleFilterChange = (index: number) => {
    const next = TASK_FILTERS[index];
    if (!next || next === activeFilter) return;
    triggerImpact();
    setActiveFilter(next);
  };

  const openSection =
    openTasks.length > 0 ? (
      <View style={{ gap: space.xs }}>
        {showSectionTitles ? (
          <SectionHeader label={t('maintenance.activeTasks')} count={openTasks.length} />
        ) : null}
        <HubCard style={{ overflow: 'hidden' }}>
          {openTasks.map((task, index) => (
            <RowMotion key={task.id} index={index}>
              <ServiceTaskRow
                item={{ task, due: getTaskDue(task, { odometer, today, unit: mileageUnit }) }}
                unit={mileageUnit}
                make={make}
                expanded={expandedId === task.id}
                divider={index < openTasks.length - 1}
                onToggle={handleToggleExpand}
                onComplete={handleComplete}
                onEdit={handleEdit}
                onDelete={handleDelete}
                motorcycleId={motorcycleId}
              />
            </RowMotion>
          ))}
        </HubCard>
      </View>
    ) : null;

  const doneSection =
    doneTasks.length > 0 ? (
      <View style={{ gap: space.xs }}>
        {showSectionTitles ? (
          <SectionHeader label={t('maintenance.completed')} count={doneTasks.length} />
        ) : null}
        <HubCard style={{ overflow: 'hidden' }}>
          {doneTasks.map((task, index) => (
            <RowMotion key={task.id} index={openTasks.length + index}>
              <HistoryTaskRow
                task={task}
                unit={mileageUnit}
                expanded={expandedId === task.id}
                divider={index < doneTasks.length - 1}
                onToggle={handleToggleExpand}
                onDelete={handleDelete}
                motorcycleId={motorcycleId}
              />
            </RowMotion>
          ))}
        </HubCard>
      </View>
    ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: hub.ground }}>
      <View
        style={[
          readableWidth,
          { paddingHorizontal: GUTTER, paddingTop: space.sm, paddingBottom: space.xs },
        ]}
      >
        <ThemedSegmentedControl
          testID="bike-tasks-filter"
          values={TASK_FILTERS.map((filter) => t(FILTER_LABEL_KEY[filter]))}
          selectedIndex={TASK_FILTERS.indexOf(activeFilter)}
          onChange={handleFilterChange}
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          readableWidth,
          {
            paddingHorizontal: GUTTER,
            paddingTop: space.xs,
            paddingBottom: tabBarClearance + space.xl,
            gap: space.xl,
          },
        ]}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={hub.copper} />
        }
        showsVerticalScrollIndicator={false}
      >
        {filteredTasks.length === 0 ? (
          <EmptyState filter={activeFilter} />
        ) : (
          <>
            {openSection}
            {doneSection}
          </>
        )}
      </ScrollView>
    </View>
  );
}
