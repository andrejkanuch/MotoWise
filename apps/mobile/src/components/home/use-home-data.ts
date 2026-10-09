import {
  AllMaintenanceTasksDocument,
  MyMotorcyclesDocument,
  MyRidesDocument,
  type MyRidesQuery,
  MyTripsDocument,
} from '@motovault/graphql';
import { onlineManager, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { gqlFetcher } from '../../lib/graphql-client';
import { userFriendlyError } from '../../lib/graphql-errors';
import { reconcileMaintenanceReminders } from '../../lib/notifications';
import { queryKeys } from '../../lib/query-keys';
import { meOptions } from '../../lib/query-options';
import { getGreeting } from './home-helpers';

export function useHomeData() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();

  const meQuery = useQuery(meOptions());
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
  // Never the raw error: a graphql-request ClientError's message is the whole
  // response — headers, request id and query — and it was rendered verbatim.
  const criticalError = meQuery.error ?? bikesQuery.error;
  const errorMessage = criticalError ? userFriendlyError(criticalError) : undefined;
  const dataUpdatedAt = meQuery.dataUpdatedAt;

  const onRefresh = useCallback(() => {
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.user.me }),
      queryClient.invalidateQueries({ queryKey: queryKeys.motorcycles.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.odometer.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceTasks.allUser }),
      // Broaden to the rides root so every ride-list variant refreshes (MOT-268).
      queryClient.invalidateQueries({ queryKey: queryKeys.rides.all }),
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

  // Ensure every upcoming maintenance task actually has a local reminder
  // scheduled. Most tasks are auto-populated server-side (OEM schedules) or
  // created on another device, so they never pass through the add-task screen
  // that schedules reminders. This reconciles them once the task list + bike
  // names are loaded; it no-ops without notification permission and skips tasks
  // already scheduled, so it is cheap to run on each home load.
  useEffect(() => {
    if (allTasks.length === 0) return;
    void reconcileMaintenanceReminders(allTasks, bikeNames);
  }, [allTasks, bikeNames]);

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
    motorcycles,
    allTasks,
    recentRides,
    upcomingTrips,
    router,
  };
}
