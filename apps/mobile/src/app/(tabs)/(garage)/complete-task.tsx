import {
  CompleteMaintenanceTaskDocument,
  MaintenanceTasksByMotorcycleDocument,
} from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Gauge, Repeat } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { expenseIconFor } from '@/components/bike-hub/sheets/log-options';
import { NativeToggle } from '@/components/ui/native-toggle';
import {
  FormCard,
  FormDivider,
  FormRow,
  FormSection,
  ROW_DIVIDER_INSET,
  RowNumberInput,
  SHEET_CONTENT_STYLE,
  SHEET_PRIMARY_STATE,
  SheetFooter,
  SheetTitle,
} from '@/components/ui/sheet-form';
import { useCurrency } from '@/hooks/use-currency';
import { useMeasurementSystem } from '@/hooks/use-measurement-system';
import { useMileageUnit } from '@/hooks/use-mileage-unit';
import { AnalyticsEvent, trackEvent } from '@/lib/analytics';
import { CORE_ACTION_KIND, recordCoreAction } from '@/lib/core-action-milestones';
import {
  EXPENSE_ENTRY_SOURCE,
  MAINTENANCE_EXPENSE_CATEGORY,
  taskCompletionExpenseAmount,
  trackExpenseAdded,
} from '@/lib/expense-analytics';
import { formatCurrencyInput, ZERO_DECIMAL_CURRENCIES } from '@/lib/expense-constants';
import { gqlFetcher } from '@/lib/graphql-client';
import { MAINTENANCE_COMPLETION_SURFACE } from '@/lib/maintenance-analytics';
import { cancelTaskNotification } from '@/lib/notifications';
import { queryKeys } from '@/lib/query-keys';
import { maybeRequestReview, REVIEW_MILESTONE } from '@/lib/store-review';
import { invalidateAfterTaskCompletion } from '@/lib/task-completion-cache';
import { useEditorialTheme } from '@/theme/editorial';
import { space, type } from '@/theme/type';
import { triggerImpact, triggerNotification } from '@/utils/haptics';
import { convertIntervalDistance } from '@/utils/maintenance-interval';

function humanizeInterval(days: number): string {
  if (days >= 365) {
    const years = Math.round(days / 365);
    return `~${years} ${years === 1 ? 'year' : 'years'}`;
  }
  if (days >= 30) {
    const months = Math.round(days / 30);
    return `~${months} ${months === 1 ? 'month' : 'months'}`;
  }
  return `${days} days`;
}

export default function CompleteTaskScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { t: theme } = useEditorialTheme();
  const queryClient = useQueryClient();

  const { taskId, motorcycleId, bikeName, currentMileage } = useLocalSearchParams<{
    taskId: string;
    motorcycleId: string;
    bikeName: string;
    currentMileage?: string;
  }>();
  // Unit follows the user's profile preference, not the deprecated per-bike field.
  const mileageUnit = useMileageUnit();
  // Odometer values are stored raw in the user's unit; system drives the
  // OEM interval display conversion + labels.
  const system = useMeasurementSystem();

  const [scheduleNext, setScheduleNext] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [completedMileage, setCompletedMileage] = useState('');
  const [cost, setCost] = useState('');
  const { currency, symbol } = useCurrency();
  const mutatingRef = useRef(false);

  const tasksQuery = useQuery({
    queryKey: queryKeys.maintenanceTasks.byMotorcycle(motorcycleId),
    queryFn: () => gqlFetcher(MaintenanceTasksByMotorcycleDocument, { motorcycleId }),
    initialData: () =>
      queryClient.getQueryData(queryKeys.maintenanceTasks.byMotorcycle(motorcycleId)),
    initialDataUpdatedAt: () =>
      queryClient.getQueryState(queryKeys.maintenanceTasks.byMotorcycle(motorcycleId))
        ?.dataUpdatedAt,
  });

  const task = tasksQuery.data?.maintenanceTasks?.find((t: { id: string }) => t.id === taskId);

  const completeMutation = useMutation({
    mutationFn: () =>
      gqlFetcher(CompleteMaintenanceTaskDocument, {
        id: taskId,
        input: {
          completedMileage: completedMileage ? parseInt(completedMileage, 10) : undefined,
          cost: cost ? parseFloat(cost) : undefined,
          currency: cost ? currency : undefined,
        },
        createNextOccurrence: task?.isRecurring ? scheduleNext : false,
      }),
    onSuccess: () => {
      // Cancel the completed task's pending reminder stages so a stale "due
      // tomorrow" notification can't fire after it's done. A recurring next
      // occurrence (new task id) is picked up by the launch reconciliation.
      void cancelTaskNotification(taskId);
      triggerNotification(Haptics.NotificationFeedbackType.Success);
      trackEvent(AnalyticsEvent.MAINTENANCE_TASK_COMPLETED, {
        has_cost: !!cost,
        scheduled_next: task?.isRecurring ? scheduleNext : false,
        surface: MAINTENANCE_COMPLETION_SURFACE.COMPLETE_TASK_SCREEN,
      });
      // A cost makes the server add a linked expense — count it like any other.
      const costValue = taskCompletionExpenseAmount(cost);
      if (costValue !== null) {
        trackExpenseAdded({
          entrySource: EXPENSE_ENTRY_SOURCE.MAINTENANCE_COST,
          bikeId: motorcycleId,
          date: new Date(),
          properties: { category: MAINTENANCE_EXPENSE_CATEGORY, amount: costValue, currency },
        });
      }
      recordCoreAction(CORE_ACTION_KIND.SERVICE_LOGGED);
      setCompleted(true);

      maybeRequestReview(REVIEW_MILESTONE.MAINTENANCE_COMPLETED);

      setTimeout(() => router.back(), 800);
    },
    onSettled: () => {
      invalidateAfterTaskCompletion(queryClient, motorcycleId, {
        hasCost: taskCompletionExpenseAmount(cost) !== null,
      });
    },
    onError: (_err: Error) => {
      mutatingRef.current = false;
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('maintenance.completeError', {
          defaultValue: 'Failed to complete task. Please try again.',
        }),
      );
    },
  });

  if (!task) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.bg,
        }}
      >
        <Text style={[type.body, { color: theme.ink3 }]}>
          {t('maintenance.taskNotFound', { defaultValue: 'Task not found' })}
        </Text>
      </View>
    );
  }

  const CostIcon = expenseIconFor(currency);
  const primaryState = completed
    ? SHEET_PRIMARY_STATE.DONE
    : completeMutation.isPending
      ? SHEET_PRIMARY_STATE.DISABLED
      : SHEET_PRIMARY_STATE.READY;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        bottomOffset={20}
        contentContainerStyle={SHEET_CONTENT_STYLE}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: space.xxs }}>
          <SheetTitle>{task.title}</SheetTitle>
          {bikeName ? <Text style={[type.subhead, { color: theme.ink3 }]}>{bikeName}</Text> : null}
        </View>

        <Animated.View entering={FadeInDown.delay(50).duration(250)}>
          <FormSection
            label={t('maintenance.completionDetails', { defaultValue: 'Completion Details' })}
          >
            <FormRow
              icon={Gauge}
              label={t('maintenance.odometer', { defaultValue: 'Odometer' })}
              hint={
                currentMileage
                  ? t('maintenance.currentReading', {
                      defaultValue: `Current: ${Number(currentMileage).toLocaleString()} ${mileageUnit}`,
                      value: Number(currentMileage).toLocaleString(),
                      unit: mileageUnit,
                    })
                  : undefined
              }
            >
              <RowNumberInput
                value={completedMileage}
                onChangeText={(val) => setCompletedMileage(val.replace(/[^0-9]/g, ''))}
                placeholder={t('garage.taskMileagePlaceholder')}
                unit={completedMileage ? mileageUnit : undefined}
              />
            </FormRow>
            <FormDivider inset={ROW_DIVIDER_INSET} />
            <FormRow icon={CostIcon} label={t('maintenance.totalCost', { defaultValue: 'Cost' })}>
              <Text style={[type.body, { color: theme.ink3 }]}>{symbol}</Text>
              <RowNumberInput
                value={cost}
                onChangeText={(val) => setCost(formatCurrencyInput(val, currency))}
                keyboardType={ZERO_DECIMAL_CURRENCIES.has(currency) ? 'number-pad' : 'decimal-pad'}
                placeholder={ZERO_DECIMAL_CURRENCIES.has(currency) ? '0' : '0.00'}
                style={{ minWidth: 80 }}
              />
            </FormRow>
          </FormSection>
        </Animated.View>

        {task.isRecurring && (
          <FormCard>
            <FormRow
              icon={Repeat}
              label={t('maintenance.scheduleNext', { defaultValue: 'Schedule next' })}
              hint={
                task.intervalDays
                  ? t('maintenance.scheduleNextDays', {
                      defaultValue: humanizeInterval(task.intervalDays),
                      count: task.intervalDays,
                    })
                  : task.intervalKm
                    ? t('maintenance.scheduleNextDistance', {
                        defaultValue: 'In {{count}} {{unit}}',
                        count: convertIntervalDistance(task.intervalKm, system),
                        unit: mileageUnit,
                      })
                    : t('maintenance.scheduleNextAuto', {
                        defaultValue: 'Auto-calculated',
                      })
              }
            >
              <NativeToggle
                value={scheduleNext}
                onValueChange={setScheduleNext}
                tint={theme.warm}
              />
            </FormRow>
          </FormCard>
        )}
      </KeyboardAwareScrollView>

      <SheetFooter
        primaryTestID="task-complete"
        primaryState={primaryState}
        primaryIcon={Check}
        primaryLabel={
          completed
            ? t('maintenance.completed', { defaultValue: 'Completed!' })
            : completeMutation.isPending
              ? t('maintenance.completing', { defaultValue: 'Completing...' })
              : t('maintenance.markComplete', { defaultValue: 'Mark as Complete' })
        }
        onPrimary={() => {
          if (mutatingRef.current) return;
          mutatingRef.current = true;
          triggerImpact();
          completeMutation.mutate();
        }}
        onCancel={() => router.back()}
        cancelDisabled={completeMutation.isPending || completed}
      />
    </View>
  );
}
