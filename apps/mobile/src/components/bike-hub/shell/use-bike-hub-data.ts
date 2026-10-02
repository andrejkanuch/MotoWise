import {
  MaintenanceTasksByMotorcycleDocument,
  type MaintenanceTasksByMotorcycleQuery,
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
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';

export type HubBike = MyMotorcyclesQuery['myMotorcycles'][number];
export type HubTask = MaintenanceTasksByMotorcycleQuery['maintenanceTasks'][number];

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
  tasksLoading: boolean;
  tasksError: boolean;
  refetchTasks: () => void;
  documents: ReturnType<typeof useMotorcycleDocuments>['documents'];
  documentsLoading: boolean;
  ridesCount: number;
  /** Overdue Critical / High tasks — the Service segment badge. */
  serviceBadge: number;
  isRefreshing: boolean;
  /** Pull-to-refresh: bike, tasks, expenses, rides and documents. */
  refresh: () => Promise<void>;
}

/**
 * The queries the shell needs. Each uses the shared `queryKeys`, so the wrapped
 * legacy sections and the Overview read the same cache entries.
 */
export function useBikeHubData(id: string): BikeHubData {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshingRef = useRef(false);

  const bikes = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });
  const tasksQuery = useQuery({
    queryKey: queryKeys.maintenanceTasks.byMotorcycle(id),
    queryFn: () => gqlFetcher(MaintenanceTasksByMotorcycleDocument, { motorcycleId: id }),
  });
  const rides = useQuery({
    queryKey: queryKeys.rides.byMotorcycle(id),
    queryFn: () => gqlFetcher(MyRidesDocument, { first: 1, motorcycleId: id }),
  });
  const { documents, isLoading: documentsLoading } = useMotorcycleDocuments(id);

  const bike = bikes.data?.myMotorcycles.find((motorcycle) => motorcycle.id === id) ?? null;
  const unit = toHubUnit(bike?.distanceUnit);
  const tasks = tasksQuery.data?.maintenanceTasks ?? NO_TASKS;
  const odometer = bike?.currentMileage;

  const serviceBadge = useMemo(
    () => getServiceBadgeCount(tasks, { odometer, today: new Date(), unit }),
    [tasks, odometer, unit],
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
    tasksLoading: tasksQuery.isLoading,
    tasksError: tasksQuery.isError && !tasksQuery.data,
    refetchTasks: () => void tasksQuery.refetch(),
    documents,
    documentsLoading,
    ridesCount: rides.data?.myRides.totalCount ?? 0,
    serviceBadge,
    isRefreshing,
    refresh,
  };
}
