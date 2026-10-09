import {
  MaintenanceTasksByMotorcycleDocument,
  MyMotorcyclesDocument,
  type MyMotorcyclesQuery,
  MyRidesDocument,
} from '@motovault/graphql';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useMotorcycleDocuments } from '../../../hooks/use-motorcycle-documents';
import { getServiceBadgeCount } from '../../../lib/bike-hub/attention';
import type { HubUnit } from '../../../lib/bike-hub/constants';
import { toHubUnit } from '../../../lib/bike-hub/format';
import type { HubTask } from '../../../lib/bike-hub/task-due';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { QUERY_META } from '../../../lib/query-meta';
import { useToday } from './use-today';

export type HubBike = MyMotorcyclesQuery['myMotorcycles'][number];
// Lives in lib so `lib/bike-hub/all-tasks.ts` can share it without reaching into components.
export type { HubTask } from '../../../lib/bike-hub/task-due';

const NO_TASKS: HubTask[] = [];

export interface BikeHubData {
  bike: HubBike | null;
  /** The bike's own unit (`distanceUnit`). A label only — values are never converted. */
  unit: HubUnit;
  /** True until the first bike list arrives. */
  isLoading: boolean;
  /** The bike list failed and there is nothing cached to show. */
  isError: boolean;
  retry: () => void;
  tasks: HubTask[];
  /** No task list yet and no error — loading, or paused offline. */
  tasksLoading: boolean;
  tasksError: boolean;
  refetchTasks: () => void;
  /** Tasks are shown from the cache: the latest refetch failed. */
  tasksRefreshFailed: boolean;
  documents: ReturnType<typeof useMotorcycleDocuments>['documents'];
  /** No document list yet and no error — loading, or paused offline. */
  documentsLoading: boolean;
  documentsError: boolean;
  refetchDocuments: () => void;
  ridesCount: number;
  /** Overdue Critical / High tasks — the Service segment badge. */
  serviceBadge: number;
  isRefreshing: boolean;
  /** Pull-to-refresh: bike, tasks, expenses, rides, documents, notes and recalls. */
  refresh: () => Promise<void>;
}

/**
 * The queries the shell needs. Each uses the shared `queryKeys`, so the wrapped
 * legacy sections and the Overview read the same cache entries.
 *
 * None of them raises the global alert — each failure has its own UI. That
 * holds only while every other mounted observer of the key opts out too (see
 * `resolveFailureHandling` in `lib/query-client.ts`); one that does not keeps
 * the alert.
 */
export function useBikeHubData(id: string): BikeHubData {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const today = useToday();
  const refreshingRef = useRef(false);

  // The full-screen error state covers a bike list that failed with nothing cached.
  const bikes = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
    meta: QUERY_META.OWN_ERROR_UI,
  });
  const tasksQuery = useQuery({
    queryKey: queryKeys.maintenanceTasks.byMotorcycle(id),
    queryFn: () => gqlFetcher(MaintenanceTasksByMotorcycleDocument, { motorcycleId: id }),
    meta: QUERY_META.OWN_ERROR_UI,
  });
  // Only the photo band's rides chip, which is hidden while the count is absent.
  const rides = useQuery({
    queryKey: queryKeys.rides.byMotorcycle(id),
    queryFn: () => gqlFetcher(MyRidesDocument, { first: 1, motorcycleId: id }),
    meta: QUERY_META.DECORATION,
  });
  const {
    documents,
    isPending: documentsLoading,
    isError: documentsError,
    refetch: refetchDocuments,
  } = useMotorcycleDocuments(id, { meta: QUERY_META.OWN_ERROR_UI });

  const bike = bikes.data?.myMotorcycles.find((motorcycle) => motorcycle.id === id) ?? null;
  const unit = toHubUnit(bike?.distanceUnit);
  const tasks = tasksQuery.data?.maintenanceTasks ?? NO_TASKS;
  const odometer = bike?.currentMileage;

  const serviceBadge = useMemo(
    () => getServiceBadgeCount(tasks, { odometer, today, unit }),
    [tasks, odometer, today, unit],
  );

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setIsRefreshing(true);
    const keys = [
      queryKeys.motorcycles.all,
      queryKeys.maintenanceTasks.byMotorcycle(id),
      // Prefix of every `[...byMotorcycle(id), year]` expenses entry.
      queryKeys.expenses.byMotorcycle(id),
      queryKeys.rides.byMotorcycle(id),
      queryKeys.documents.byMotorcycle(id),
      queryKeys.notes.byMotorcycle(id),
      queryKeys.motorcycleRecalls.byMotorcycle(id),
      queryKeys.odometer.readings(id),
      queryKeys.odometer.pendingRides(id),
    ];
    try {
      await Promise.allSettled(
        keys.map((queryKey) => queryClient.invalidateQueries({ queryKey, refetchType: 'active' })),
      );
    } finally {
      refreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, [queryClient, id]);

  return {
    bike,
    unit,
    isLoading: bikes.isLoading && !bikes.data,
    isError: bikes.isError && !bikes.data,
    retry: () => void bikes.refetch(),
    tasks,
    // "No data yet", not `isLoading`: with `networkMode: 'offlineFirst'` an
    // offline cold open leaves the query pending but paused (not fetching, no
    // error) — an empty list then must not read as "this bike has no tasks".
    tasksLoading: tasksQuery.data === undefined && !tasksQuery.isError,
    tasksError: tasksQuery.isError && !tasksQuery.data,
    refetchTasks: () => void tasksQuery.refetch(),
    tasksRefreshFailed: tasksQuery.isError && !!tasksQuery.data,
    documents,
    documentsLoading,
    documentsError,
    refetchDocuments,
    ridesCount: rides.data?.myRides.totalCount ?? 0,
    serviceBadge,
    isRefreshing,
    refresh,
  };
}
