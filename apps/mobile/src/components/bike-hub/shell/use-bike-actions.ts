import { DeleteMotorcycleDocument, ImportOemScheduleDocument } from '@motovault/graphql';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import { gqlFetcher } from '../../../lib/graphql-client';
import { cancelDocumentNotificationsForBike } from '../../../lib/notifications';
import { queryKeys } from '../../../lib/query-keys';
import { useBikeHubStore } from '../../../stores/bike-hub.store';
import { triggerImpact, triggerNotification } from '../../../utils/haptics';
import type { HubBike } from './use-bike-hub-data';

export interface BikeActions {
  editBike: () => void;
  checkRecalls: () => void;
  importSchedule: () => void;
  isImportingSchedule: boolean;
  openServiceReport: () => void;
  removeBike: () => void;
}

/**
 * The bike-level actions that used to hang off the ⋯ menu and the two cards of
 * the old bike screen. Behaviour, copy and analytics (event names and
 * properties) are unchanged — only the entry points moved.
 */
export function useBikeActions(bike: HubBike, onRemoved: () => void): BikeActions {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const forgetBike = useBikeHubStore((state) => state.forgetBike);
  const id = bike.id;
  const bikeName = `${bike.year} ${bike.make} ${bike.model}`;

  const { mutateAsync: deleteBike } = useMutation({
    mutationFn: () => gqlFetcher(DeleteMotorcycleDocument, { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.motorcycles.all });
      // Soft-deleting a bike hides its documents — stop their expiry reminders
      // from firing for documents the rider can no longer see.
      void cancelDocumentNotificationsForBike(id);
      forgetBike(id);
      trackEvent(AnalyticsEvent.GARAGE_BIKE_REMOVED, { motorcycle_id: id });
      triggerNotification(Haptics.NotificationFeedbackType.Warning);
    },
    // `removeBike` shows "Failed to delete motorcycle" itself.
    meta: { showErrorAlert: false },
  });

  const importOem = useMutation({
    mutationFn: () => gqlFetcher(ImportOemScheduleDocument, { motorcycleId: id }),
    onSuccess: (data) => {
      const count = data?.importOemSchedule ?? 0;
      queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceTasks.byMotorcycle(id) });
      triggerNotification(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        t('oem.importedTitle', { defaultValue: 'OEM schedule imported' }),
        count > 0
          ? t('oem.importedCount', {
              defaultValue: `Added ${count} maintenance task${count === 1 ? '' : 's'} from the manufacturer schedule.`,
              count,
            })
          : t('oem.importedNone', {
              defaultValue: 'No new tasks to import — your schedule is already up to date.',
            }),
      );
    },
    onError: () => {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('oem.importFailed', { defaultValue: 'Failed to import OEM schedule. Please try again.' }),
      );
    },
  });

  const bikeProperties = { bike_make: bike.make, bike_model: bike.model, bike_year: bike.year };

  return {
    editBike: () => {
      triggerImpact();
      router.push({ pathname: '/(tabs)/(garage)/edit-bike', params: { id } });
    },
    checkRecalls: () => {
      triggerImpact();
      trackEvent(AnalyticsEvent.RECALLS_CHECKED, {
        motorcycle_id: id,
        ...bikeProperties,
        has_vin: !!bike.vin,
      });
      router.push({ pathname: '/(modals)/recalls', params: { motorcycleId: id, bikeName } });
    },
    importSchedule: () => {
      triggerImpact();
      trackEvent(AnalyticsEvent.OEM_SCHEDULE_IMPORTED, { motorcycle_id: id, ...bikeProperties });
      importOem.mutate();
    },
    isImportingSchedule: importOem.isPending,
    openServiceReport: () => {
      triggerImpact();
      trackEvent(AnalyticsEvent.HEALTH_REPORT_VIEWED, { motorcycle_id: id, ...bikeProperties });
      router.push({ pathname: '/(tabs)/(garage)/health-report', params: { bikeId: id } });
    },
    removeBike: () => {
      triggerImpact();
      Alert.alert(t('garage.deleteBike'), t('garage.confirmDelete'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBike();
              onRemoved();
            } catch (_error) {
              Alert.alert(
                t('common.error', { defaultValue: 'Error' }),
                t('garage.deleteFailed', {
                  defaultValue: 'Failed to delete motorcycle. Please try again.',
                }),
              );
            }
          },
        },
      ]);
    },
  };
}
