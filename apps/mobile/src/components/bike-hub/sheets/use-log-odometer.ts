import {
  LogOdometerReadingDocument,
  OdometerReadingsDocument,
  PendingRideDistanceDocument,
} from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import { ODOMETER_SOURCE } from '../../../lib/bike-hub/constants';
import { readingTimestamp } from '../../../lib/bike-hub/odometer-input';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { QUERY_META } from '../../../lib/query-meta';
import { useSheetDiscardGuard } from './use-sheet-discard-guard';

const LATEST_ONLY = 1;
/**
 * The sheet works without these two (no delta line, no rides chip), so a failed
 * first load must not raise the query client's global "Error" alert. That alert
 * — not the save mutation — is what appeared beside the inline save error when
 * the API was down: both queries fail with nothing cached, and their retries
 * end a few seconds after the sheet opens.
 */
const { OWN_ERROR_UI } = QUERY_META;

/** The latest logged reading and the ride distance not yet on the odometer. */
export function useOdometerContext(motorcycleId: string) {
  const readings = useQuery({
    queryKey: queryKeys.odometer.readings(motorcycleId),
    queryFn: () => gqlFetcher(OdometerReadingsDocument, { motorcycleId, limit: LATEST_ONLY }),
    enabled: !!motorcycleId,
    meta: OWN_ERROR_UI,
  });
  const pendingRides = useQuery({
    queryKey: queryKeys.odometer.pendingRides(motorcycleId),
    queryFn: () => gqlFetcher(PendingRideDistanceDocument, { motorcycleId }),
    enabled: !!motorcycleId,
    meta: OWN_ERROR_UI,
  });
  return {
    latest: readings.data?.odometerReadings[0] ?? null,
    readingsLoading: readings.isLoading,
    /** No reading history: the first load failed and nothing is cached. */
    readingsError: readings.isError && !readings.data,
    refetchReadings: () => void readings.refetch(),
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
    // The sheet shows the failure inline and keeps the entry: no global alert on top.
    meta: OWN_ERROR_UI,
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

/** "Discard reading?" — Keep editing (cancel) / Discard (destructive). */
export function confirmDiscardReading(t: TFunction, onDiscard: () => void): void {
  Alert.alert(t('bikeHub.odometer.discardTitle'), t('bikeHub.odometer.discardMessage'), [
    { text: t('bikeHub.odometer.keepEditing'), style: 'cancel' },
    { text: t('bikeHub.odometer.discard'), style: 'destructive', onPress: onDiscard },
  ]);
}

/**
 * Keeps a typed reading (digits or a picked date) from being lost to a stray
 * swipe, Cancel or Back: the rider is asked "Discard reading?" first, through
 * the hub's one sheet guard (`useSheetDiscardGuard` — one navigation action per
 * decision, react-native-screens#4446). While the reading saves the sheet is
 * locked: a swipe or Back is swallowed without a prompt, and the save closes
 * the sheet itself. A save that lands after the sheet is gone navigates nowhere.
 */
export function useDiscardReadingGuard(dirty: boolean, saving = false) {
  const { t } = useTranslation();
  const guard = useSheetDiscardGuard({
    unsaved: dirty,
    saving,
    confirmDiscard: (discard) => confirmDiscardReading(t, discard),
  });

  return {
    /** Cancel: one `router.back()`; the guard asks first when something was typed. */
    cancel: () => {
      if (saving) return;
      router.back();
    },
    /** After a successful save: leaves without asking (only while the sheet is up). */
    closeAfterSave: () => {
      guard.leaveAfterSave(() => router.back());
    },
  };
}
