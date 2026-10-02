import {
  LogOdometerReadingDocument,
  OdometerReadingsDocument,
  PendingRideDistanceDocument,
} from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isSameDay, set } from 'date-fns';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import { ODOMETER_SOURCE } from '../../../lib/bike-hub/constants';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';

const LATEST_ONLY = 1;
const NOON = { hours: 12, minutes: 0, seconds: 0, milliseconds: 0 };

/** The latest logged reading and the ride distance not yet on the odometer. */
export function useOdometerContext(motorcycleId: string) {
  const readings = useQuery({
    queryKey: queryKeys.odometer.readings(motorcycleId),
    queryFn: () => gqlFetcher(OdometerReadingsDocument, { motorcycleId, limit: LATEST_ONLY }),
    enabled: !!motorcycleId,
  });
  const pendingRides = useQuery({
    queryKey: queryKeys.odometer.pendingRides(motorcycleId),
    queryFn: () => gqlFetcher(PendingRideDistanceDocument, { motorcycleId }),
    enabled: !!motorcycleId,
  });
  return {
    latest: readings.data?.odometerReadings[0] ?? null,
    readingsLoading: readings.isLoading,
    pendingRides: pendingRides.data?.pendingRideDistance ?? null,
  };
}

export interface LogOdometerVariables {
  value: number;
  recordedAt: Date;
  today: Date;
  /** Signed difference to the last reading, for analytics. */
  delta: number | null;
  backdated: boolean;
  usedQuickAdd: boolean;
}

/**
 * Saves a reading through `logOdometerReading` (an `odometer_readings` row; the
 * bike's odometer moves unless the reading is older than the latest one). A
 * reading for today carries no timestamp — the server stamps it; another day is
 * sent as that day at noon so it never lands on a neighbouring date.
 */
export function useLogOdometer(motorcycleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ value, recordedAt, today }: LogOdometerVariables) =>
      gqlFetcher(LogOdometerReadingDocument, {
        input: {
          motorcycleId,
          value,
          recordedAt: isSameDay(recordedAt, today)
            ? undefined
            : set(recordedAt, NOON).toISOString(),
        },
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.motorcycles.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.odometer.readings(motorcycleId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.odometer.pendingRides(motorcycleId) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.maintenanceTasks.byMotorcycle(motorcycleId),
      });
      trackEvent(AnalyticsEvent.ODOMETER_UPDATED, {
        motorcycle_id: motorcycleId,
        source: ODOMETER_SOURCE.SHEET,
        delta: variables.delta,
        backdated: variables.backdated,
        used_quick_add: variables.usedQuickAdd,
      });
    },
  });
}
