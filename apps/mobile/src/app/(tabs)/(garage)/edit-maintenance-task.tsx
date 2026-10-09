import {
  type MaintenancePriority,
  MaintenanceTasksByMotorcycleDocument,
  UpdateMaintenanceTaskDocument,
} from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, Gauge } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  FormDateRow,
  FormDivider,
  FormRow,
  FormSection,
  inputTextStyle,
  PriorityPicker,
  ROW_DIVIDER_INSET,
  RowNumberInput,
  SHEET_CONTENT_STYLE,
  SHEET_CONTROL_HEIGHT,
  SHEET_PRIMARY_STATE,
  SheetFooter,
  SheetTitle,
} from '../../../components/ui/sheet-form';
import { useHydratedFormState } from '../../../hooks/use-hydrated-form-state';
import { useMileageUnit } from '../../../hooks/use-mileage-unit';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import { gqlFetcher } from '../../../lib/graphql-client';
import { cancelTaskNotification, scheduleMaintenanceReminder } from '../../../lib/notifications';
import { queryKeys } from '../../../lib/query-keys';
import { useEditorialTheme } from '../../../theme/editorial';
import { space, type } from '../../../theme/type';
import { triggerImpact } from '../../../utils/haptics';
import { buildTaskUpdateInput, resolveReminderAction } from '../../../utils/maintenance-task-form';
import { toISODateInput } from '../../../utils/trip-form-dates';

const MULTILINE_INPUT = {
  paddingHorizontal: space.md,
  paddingVertical: space.sm,
  minHeight: 88,
} as const;

export default function EditMaintenanceTaskScreen() {
  const { t } = useTranslation();
  const { taskId, motorcycleId, bikeName } = useLocalSearchParams<{
    taskId: string;
    motorcycleId: string;
    bikeName?: string;
  }>();
  const { t: theme } = useEditorialTheme();
  const queryClient = useQueryClient();
  const mileageUnit = useMileageUnit();

  // Prefill from the already-fetched task list (warm cache): the rider always
  // reaches Edit from a list that has loaded this task. Mirrors complete-task.
  const tasksQuery = useQuery({
    queryKey: queryKeys.maintenanceTasks.byMotorcycle(motorcycleId),
    queryFn: () => gqlFetcher(MaintenanceTasksByMotorcycleDocument, { motorcycleId }),
    initialData: () =>
      queryClient.getQueryData(queryKeys.maintenanceTasks.byMotorcycle(motorcycleId)),
    initialDataUpdatedAt: () =>
      queryClient.getQueryState(queryKeys.maintenanceTasks.byMotorcycle(motorcycleId))
        ?.dataUpdatedAt,
  });
  const task = tasksQuery.data?.maintenanceTasks?.find((item) => item.id === taskId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [targetMileage, setTargetMileage] = useState('');
  const [priority, setPriority] = useState<MaintenancePriority>('medium' as MaintenancePriority);
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const backTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the post-save auto-dismiss timer if the rider leaves first, so it
  // can't pop an already-unmounted screen.
  useEffect(
    () => () => {
      if (backTimerRef.current) clearTimeout(backTimerRef.current);
    },
    [],
  );

  // Hydrate form state once, the moment the task is available in cache.
  useHydratedFormState(task, (item) => {
    setTitle(item.title ?? '');
    setDescription(item.description ?? '');
    // Parse the stored YYYY-MM-DD as local midnight so it round-trips through
    // toISODateInput (date-fns `format`, local tz) without drifting a day.
    setDueDate(item.dueDate ? new Date(`${item.dueDate}T00:00:00`) : null);
    setTargetMileage(item.targetMileage ? String(item.targetMileage) : '');
    setPriority((item.priority ?? 'medium') as MaintenancePriority);
    setNotes(item.notes ?? '');
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      gqlFetcher(UpdateMaintenanceTaskDocument, {
        id: taskId,
        input: buildTaskUpdateInput({
          title,
          description,
          notes,
          targetMileage,
          priority,
          dueDateISO: dueDate ? toISODateInput(dueDate) : null,
        }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.maintenanceTasks.byMotorcycle(motorcycleId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceTasks.allUser });

      // Keep the local reminder consistent with the edited due date.
      const updated = data?.updateMaintenanceTask;
      if (resolveReminderAction(dueDate) === 'cancel') {
        void cancelTaskNotification(taskId);
      } else if (dueDate) {
        // 'schedule' — dueDate is guaranteed present here; the check also
        // narrows the type for toISODateInput. scheduleMaintenanceReminder
        // cancels any prior stages before rescheduling, so this is idempotent.
        void scheduleMaintenanceReminder(
          {
            id: taskId,
            title: title.trim(),
            dueDate: toISODateInput(dueDate),
            motorcycleId,
            remind30d: updated?.remind30d ?? false,
            remind7d: updated?.remind7d ?? false,
            remind1d: updated?.remind1d ?? true,
          },
          bikeName ?? 'Your bike',
        );
      }

      trackEvent(AnalyticsEvent.MAINTENANCE_TASK_UPDATED, {
        priority,
        has_due_date: !!dueDate,
      });
      setSaved(true);
      triggerImpact();
      backTimerRef.current = setTimeout(() => router.back(), 600);
    },
    onError: () => {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('maintenance.updateFailed', {
          defaultValue: 'Failed to update task. Please try again.',
        }),
      );
    },
  });

  const canSave = !!title.trim() && !updateMutation.isPending;
  const primaryState = saved
    ? SHEET_PRIMARY_STATE.DONE
    : canSave
      ? SHEET_PRIMARY_STATE.READY
      : SHEET_PRIMARY_STATE.DISABLED;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        bottomOffset={20}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={SHEET_CONTENT_STYLE}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SheetTitle>{t('maintenance.editTaskTitle')}</SheetTitle>

        <Animated.View entering={FadeIn.duration(250)}>
          <FormSection label={t('maintenance.task', { defaultValue: 'Task' })}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={t('maintenance.taskTitlePlaceholder', {
                defaultValue: 'e.g. Oil Change, Chain Adjustment',
              })}
              placeholderTextColor={theme.ink4}
              style={[
                type.bodyStrong,
                { color: theme.ink, minHeight: SHEET_CONTROL_HEIGHT, paddingHorizontal: space.md },
              ]}
            />
          </FormSection>
        </Animated.View>

        <FormSection label={t('maintenance.priority', { defaultValue: 'Priority' })} card={false}>
          <PriorityPicker value={priority} onChange={setPriority} />
        </FormSection>

        <FormSection label={t('maintenance.schedule', { defaultValue: 'Schedule' })}>
          <FormDateRow
            label={t('maintenance.dueDate', { defaultValue: 'Due Date' })}
            value={dueDate}
            emptyLabel={t('maintenance.noneSet', { defaultValue: 'None' })}
            open={showDatePicker}
            onToggle={() => {
              if (!dueDate) setDueDate(new Date());
              setShowDatePicker(!showDatePicker);
            }}
            onClose={() => setShowDatePicker(false)}
            onChange={setDueDate}
            onClear={() => {
              setDueDate(null);
              setShowDatePicker(false);
            }}
            testID="task-date"
          />
          <FormDivider inset={ROW_DIVIDER_INSET} />
          <FormRow icon={Gauge} label={t('maintenance.targetMileage', { defaultValue: 'Mileage' })}>
            <RowNumberInput
              value={targetMileage}
              onChangeText={(val) => setTargetMileage(val.replace(/[^0-9]/g, ''))}
              placeholder={t('garage.distanceIntervalPlaceholder')}
              unit={targetMileage ? mileageUnit : undefined}
            />
          </FormRow>
        </FormSection>

        <FormSection label={t('maintenance.details', { defaultValue: 'Details' })}>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={t('maintenance.descriptionPlaceholder', {
              defaultValue: 'What needs to be done...',
            })}
            placeholderTextColor={theme.ink4}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={[inputTextStyle(theme), MULTILINE_INPUT]}
          />
          <FormDivider />
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder={t('maintenance.notesPlaceholder', {
              defaultValue: 'Parts needed, tips, references...',
            })}
            placeholderTextColor={theme.ink4}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={[inputTextStyle(theme), MULTILINE_INPUT]}
          />
        </FormSection>
      </KeyboardAwareScrollView>

      <SheetFooter
        primaryTestID="task-save"
        primaryState={primaryState}
        primaryIcon={saved ? Check : undefined}
        primaryLabel={
          saved
            ? t('maintenance.taskUpdated', { defaultValue: 'Saved!' })
            : updateMutation.isPending
              ? t('common.saving', { defaultValue: 'Saving...' })
              : t('maintenance.saveChanges', { defaultValue: 'Save changes' })
        }
        onPrimary={() => {
          triggerImpact();
          updateMutation.mutate();
        }}
        onCancel={() => router.back()}
      />
    </View>
  );
}
