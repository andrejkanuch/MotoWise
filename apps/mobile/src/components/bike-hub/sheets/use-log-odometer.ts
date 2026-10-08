import {
  LogOdometerReadingDocument,
  OdometerReadingsDocument,
  PendingRideDistanceDocument,
} from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useNavigation, usePreventRemove } from 'expo-router/react-navigation';
import type { TFunction } from 'i18next';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, BackHandler } from 'react-native';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import { ODOMETER_SOURCE, SHEET_DISMISS_GUARD_PLATFORMS } from '../../../lib/bike-hub/constants';
import { readingTimestamp } from '../../../lib/bike-hub/odometer-input';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { QUERY_META } from '../../../lib/query-meta';

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
 * swipe or Cancel: the rider is asked "Discard reading?" first, and Discard
 * leaves with exactly ONE navigation action (the sheet's modal-update race,
 * software-mansion/react-native-screens#4446, makes a second one unsafe).
 *
 * iOS: `usePreventRemove` sets react-native-screens' `preventNativeDismiss` on
 * the form sheet. UIKit then refuses the swipe-down (the sheet springs back),
 * screens reports `onNativeDismissCancelled`, native-stack dispatches a pop,
 * and the prevented pop lands in the callback below. Cancel takes the same
 * path through `router.back()`. Discard re-dispatches that very pop — which
 * the guard lets through — so the sheet leaves once.
 *
 * Android: screens 4.26 ignores `preventNativeDismiss` (the bottom sheet hides
 * itself before JS hears of it), so a prevented pop would leave JS holding a
 * sheet the OS already dismissed. There the guard covers Cancel and the
 * hardware Back button; a swipe-down still closes without asking.
 */
export function useDiscardReadingGuard(dirty: boolean) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const saved = useRef(false);
  const nativeGuard = SHEET_DISMISS_GUARD_PLATFORMS.has(process.env.EXPO_OS ?? '');

  usePreventRemove(nativeGuard && dirty, ({ data }) => {
    const leave = () => navigation.dispatch(data.action);
    if (saved.current) return leave();
    confirmDiscardReading(t, leave);
  });

  useEffect(() => {
    if (nativeGuard || !dirty) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      confirmDiscardReading(t, () => router.back());
      return true;
    });
    return () => subscription.remove();
  }, [nativeGuard, dirty, t]);

  return {
    /** Cancel: asks first when something was typed. */
    cancel: () => {
      if (dirty && !nativeGuard) return confirmDiscardReading(t, () => router.back());
      router.back();
    },
    /** After a successful save: leaves without asking. */
    closeAfterSave: () => {
      saved.current = true;
      router.back();
    },
  };
}
