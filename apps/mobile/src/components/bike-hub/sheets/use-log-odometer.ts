import {
  LogOdometerReadingDocument,
  OdometerReadingsDocument,
  PendingRideDistanceDocument,
} from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import { ODOMETER_SOURCE } from '../../../lib/bike-hub/constants';
import { readingTimestamp } from '../../../lib/bike-hub/odometer-input';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';

const LATEST_ONLY = 1;

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
 * bike's odometer moves unless a later reading is already logged). The timestamp
 * comes from `readingTimestamp` — the same value `isBackdated` decides on, so the
 * sheet's back-dated notice and the server's behaviour cannot disagree.
 */
export function useLogOdometer(motorcycleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ value, recordedAt, today }: LogOdometerVariables) =>
      gqlFetcher(LogOdometerReadingDocument, {
        input: {
          motorcycleId,
          value,
          recordedAt: readingTimestamp(recordedAt, today)?.toISOString(),
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
