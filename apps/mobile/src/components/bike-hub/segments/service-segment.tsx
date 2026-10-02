import { DeleteMaintenanceTaskDocument } from '@motovault/graphql';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import type { HubUnit } from '../../../lib/bike-hub/constants';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { useEditorialTheme } from '../../../theme/editorial';
import { triggerNotification } from '../../../utils/haptics';
import { OemDisclaimerCard } from '../../maintenance/oem-disclaimer-card';
import { MaintenanceSection } from '../maintenance-section';
import type { HubBike, HubTask } from '../shell/use-bike-hub-data';

interface ServiceSegmentProps {
  bike: HubBike;
  tasks: HubTask[];
  unit: HubUnit;
  /** Task to expand on arrival (Home card, notification, an Overview row). */
  highlightTaskId: string | null;
  /** Changes with every highlight request so the same task can be highlighted again. */
  highlightKey: string;
}

/**
 * Interim Service segment (R1): today's `MaintenanceSection` and OEM disclaimer,
 * unchanged, with the complete / edit / delete handlers that used to live on the
 * bike screen. R2 replaces it with the Active / History redesign.
 */
export function ServiceSegment({
  bike,
  tasks,
  unit,
  highlightTaskId,
  highlightKey,
}: ServiceSegmentProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isDark } = useEditorialTheme();
  const id = bike.id;
  const bikeName = `${bike.year} ${bike.make} ${bike.model}`;

  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => gqlFetcher(DeleteMaintenanceTaskDocument, { id: taskId }),
    onSuccess: (_data, taskId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceTasks.byMotorcycle(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceTasks.allUser });
      trackEvent(AnalyticsEvent.MAINTENANCE_TASK_DELETED, { motorcycle_id: id, task_id: taskId });
      triggerNotification(Haptics.NotificationFeedbackType.Warning);
    },
    onError: () => {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('maintenance.deleteError', { defaultValue: 'Failed to delete task. Please try again.' }),
      );
    },
  });

  const handleComplete = useCallback(
    (taskId: string) => {
      router.push({
        pathname: '/(tabs)/(garage)/complete-task',
        params: {
          taskId,
          motorcycleId: id,
          bikeName,
          currentMileage: bike.currentMileage ? String(bike.currentMileage) : '',
          mileageUnit: unit,
        },
      });
    },
    [bike.currentMileage, bikeName, id, router, unit],
  );

  const handleEdit = useCallback(
    (taskId: string) => {
      router.push({
        pathname: '/(tabs)/(garage)/edit-maintenance-task',
        params: { taskId, motorcycleId: id, bikeName },
      });
    },
    [bikeName, id, router],
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
          { text: t('common.delete'), style: 'destructive', onPress: () => deleteTask(taskId) },
        ],
      );
    },
    [deleteTask, t],
  );

  return (
    <View style={{ paddingTop: 16 }}>
      <MaintenanceSection
        // Remounts on a new highlight request: the section only honours
        // `initialExpandedId` once per mount.
        key={highlightKey}
        tasks={tasks}
        isDark={isDark}
        motorcycleId={id}
        initialExpandedId={highlightTaskId}
        onComplete={handleComplete}
        onDelete={handleDelete}
        onEdit={handleEdit}
        mileageUnit={unit}
      />
      <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
        <OemDisclaimerCard isDark={isDark} delay={0} />
      </View>
    </View>
  );
}
