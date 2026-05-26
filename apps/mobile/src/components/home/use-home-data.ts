import { palette } from '@motovault/design-system';
import {
  AllMaintenanceTasksDocument,
  MeDocument,
  MyMotorcyclesDocument,
  MyRidesDocument,
  type MyRidesQuery,
  MyTripsDocument,
} from '@motovault/graphql';
import { onlineManager, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { AlertTriangle, CheckCircle2, Wrench } from 'lucide-react-native';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { gqlFetcher } from '../../lib/graphql-client';
import { computeHealthScore, getRelativeDueDate } from '../../lib/health-score';
import { queryKeys } from '../../lib/query-keys';
import { getContextualSubtitleKey, getGreeting } from './home-helpers';
import type { FleetHealth, PriorityAction, TaskItem, TaskWithRelative } from './home-types';

export function useHomeData() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: queryKeys.user.me,
    queryFn: () => gqlFetcher(MeDocument),
    meta: { showErrorAlert: false },
  });
  const bikesQuery = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
    meta: { showErrorAlert: false },
  });
  const maintenanceQuery = useQuery({
    queryKey: queryKeys.maintenanceTasks.allUser,
    queryFn: () => gqlFetcher(AllMaintenanceTasksDocument),
    meta: { showErrorAlert: false },
  });
  const ridesQuery = useQuery({
    queryKey: queryKeys.rides.list('home'),
    queryFn: () => gqlFetcher(MyRidesDocument, { first: 10 }),
    meta: { showErrorAlert: false },
  });
  const tripsQuery = useQuery({
    queryKey: queryKeys.trips.list('home'),
    queryFn: () => gqlFetcher(MyTripsDocument, { first: 5 }),
    meta: { showErrorAlert: false },
  });

  const user = meQuery.data?.me;
  const _preferences = user?.preferences as
    | { onboardingCompleted?: boolean; experienceLevel?: string }
    | null
    | undefined;
  const motorcycles = bikesQuery.data?.myMotorcycles ?? [];
  const allTasks = maintenanceQuery.data?.allMaintenanceTasks ?? [];
  const ridesData = ridesQuery.data as MyRidesQuery | undefined;
  const ridesEdges = ridesData?.myRides?.edges ?? [];

  const hasMotorcycles = motorcycles.length > 0;
  const isLoading = meQuery.isLoading || bikesQuery.isLoading;
  const isOffline = !onlineManager.isOnline();
  const hasCriticalError = !isOffline && (meQuery.isError || bikesQuery.isError);
  const isOfflineEmpty = isOffline && !user && motorcycles.length === 0;
  const isRefreshing = meQuery.isRefetching || bikesQuery.isRefetching || ridesQuery.isRefetching;
  const errorMessage = (meQuery.error as Error)?.message ?? (bikesQuery.error as Error)?.message;
  const dataUpdatedAt = meQuery.dataUpdatedAt;

  const onRefresh = useCallback(() => {
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.user.me }),
      queryClient.invalidateQueries({ queryKey: queryKeys.motorcycles.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceTasks.allUser }),
      queryClient.invalidateQueries({ queryKey: queryKeys.rides.list('home') }),
    ]).then(() => {
      if (process.env.EXPO_OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    });
  }, [queryClient]);

  const firstName = user?.fullName?.split(' ')[0];
  const avatarInitial = user?.fullName?.charAt(0)?.toUpperCase() ?? '?';
  const greeting = getGreeting();

  const bikeNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const m of motorcycles) {
      names[m.id] = `${m.make} ${m.model}`;
    }
    return names;
  }, [motorcycles]);

  // Map rides — only fields consumed by FocusStats and FocusHistory
  const recentRides = useMemo(() => {
    return ridesEdges.map((edge) => {
      const node = edge.node;
      return {
        id: node.id,
        name: node.name ?? null,
        startedAt: node.startedAt,
        durationS: node.durationS ?? null,
        distanceM: node.distanceM ?? null,
        avgSpeedMps: node.avgSpeedMps ?? null,
        motorcycleId: node.motorcycleId ?? null,
        bikeName: node.motorcycleId ? (bikeNames[node.motorcycleId] ?? null) : null,
      };
    });
  }, [ridesEdges, bikeNames]);

  // Single pass: compute per-bike health scores AND fleet health together
  const { fleetHealth, bikeHealthScores } = useMemo(() => {
    if (motorcycles.length === 0) {
      return { fleetHealth: null, bikeHealthScores: {} as Record<string, number> };
    }

    const scores: Record<string, number> = {};
    let totalWeight = 0;
    let weightedScore = 0;
    let totalOverdue = 0;
    let totalUrgent = 0;
    let anyHasData = false;
    let needsAttention = 0;

    for (const bike of motorcycles) {
      const bikeTasks = allTasks.filter(
        (task: { motorcycleId: string }) => task.motorcycleId === bike.id,
      );
      const result = computeHealthScore(bikeTasks);
      scores[bike.id] = result.hasData ? result.score : 100;

      const weight = bike.isPrimary ? 1.5 : 1;
      if (result.hasData) {
        weightedScore += result.score * weight;
        totalWeight += weight;
        anyHasData = true;
      }
      totalOverdue += result.overdueTasks;
      totalUrgent += result.urgentTasks;
      if (result.overdueTasks > 0 || (result.hasData && result.score < 60)) {
        needsAttention++;
      }
    }

    const avgScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;

    const fleet: FleetHealth = {
      score: avgScore,
      hasData: anyHasData,
      bikeCount: motorcycles.length,
      needsAttention,
      totalOverdue,
      totalUrgent,
      upcomingTasks: allTasks.filter((task: { status: string; dueDate?: string | null }) => {
        if (task.status !== 'pending' && task.status !== 'in_progress') return false;
        if (!task.dueDate) return false;
        const days = Math.floor((new Date(task.dueDate).getTime() - Date.now()) / 86400000);
        return days >= 0 && days <= 7;
      }).length,
    };

    return { fleetHealth: fleet, bikeHealthScores: scores };
  }, [motorcycles, allTasks]);

  const sortedTasks: TaskWithRelative[] = useMemo(() => {
    return (allTasks as TaskItem[])
      .filter((t) => (t.status === 'pending' || t.status === 'in_progress') && t.dueDate)
      .map((t) => ({
        ...t,
        relative: getRelativeDueDate(t.dueDate as string),
      }))
      .sort((a, b) => {
        if (a.relative.isOverdue && !b.relative.isOverdue) return -1;
        if (!a.relative.isOverdue && b.relative.isOverdue) return 1;
        return a.relative.daysAway - b.relative.daysAway;
      })
      .slice(0, 5);
  }, [allTasks]);

  const priorityAction: PriorityAction | null = useMemo(() => {
    if (!hasMotorcycles) return null;

    const overdueTasks = sortedTasks.filter((t) => t.relative.isOverdue);
    if (overdueTasks.length > 0) {
      const task = overdueTasks[0];
      const bikeName = bikeNames[task.motorcycleId] ?? t('home.yourBike');
      const relativeText = t(task.relative.key as never, task.relative.params as never);
      return {
        type: 'overdue',
        title: task.title,
        subtitle: `${bikeName} — ${relativeText}`,
        ctaLabel: t('home.priorityCompleteTask'),
        accentColor: palette.danger500,
        icon: AlertTriangle,
        onPress: () =>
          router.navigate({
            pathname: '/(tabs)/(garage)/bike/[id]',
            params: {
              id: task.motorcycleId,
              highlightTask: task.id,
              _ts: Date.now().toString(),
            },
          }),
      };
    }

    const urgentTasks = sortedTasks.filter(
      (t) => !t.relative.isOverdue && t.relative.daysAway <= 3,
    );
    if (urgentTasks.length > 0) {
      const task = urgentTasks[0];
      const bikeName = bikeNames[task.motorcycleId] ?? t('home.yourBike');
      const relativeText = t(task.relative.key as never, task.relative.params as never);
      return {
        type: 'upcoming',
        title: task.title,
        subtitle: `${bikeName} — ${relativeText}`,
        ctaLabel: t('home.priorityViewTask'),
        accentColor: palette.warning500,
        icon: Wrench,
        onPress: () =>
          router.navigate({
            pathname: '/(tabs)/(garage)/bike/[id]',
            params: {
              id: task.motorcycleId,
              highlightTask: task.id,
              _ts: Date.now().toString(),
            },
          }),
      };
    }

    return {
      type: 'allClear',
      title: t('home.priorityAllClearTitle'),
      subtitle: t('home.priorityAllClearSubtitle'),
      ctaLabel: t('home.priorityViewGarage'),
      accentColor: palette.success500,
      icon: CheckCircle2,
      onPress: () => router.navigate('/(tabs)/(garage)'),
    };
  }, [hasMotorcycles, sortedTasks, bikeNames, t, router]);

  const nextService = useMemo(() => {
    const upcoming = sortedTasks.find((t) => !t.relative.isOverdue);
    return upcoming ?? null;
  }, [sortedTasks]);

  const _subtitleInfo = getContextualSubtitleKey(
    greeting.subtitleKey,
    fleetHealth?.totalOverdue ?? 0,
    fleetHealth?.upcomingTasks ?? 0,
  );

  const greetingText = firstName
    ? t(greeting.key, { name: firstName })
    : t('home.greetingFallback');

  const upcomingTrips = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const trips = tripsQuery.data?.myTrips?.edges?.map((e) => e.node) ?? [];
    return trips
      .filter((trip) => trip.startDate && trip.startDate >= today)
      .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));
  }, [tripsQuery.data]);

  return {
    isLoading,
    hasCriticalError,
    isOffline,
    isOfflineEmpty,
    dataUpdatedAt,
    errorMessage,
    isRefreshing,
    onRefresh,
    greetingText,
    avatarInitial,
    hasMotorcycles,
    priorityAction,
    motorcycles,
    nextService,
    sortedTasks,
    bikeNames,
    recentRides,
    bikeHealthScores,
    upcomingTrips,
    router,
  };
}
