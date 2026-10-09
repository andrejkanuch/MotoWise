import {
  CreateMaintenanceTaskDocument,
  type MaintenancePriority,
  MaintenanceTaskStatus,
} from '@motovault/graphql';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { endOfDay, min, set, startOfDay, subYears } from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';
import { Calendar, CalendarCheck, Check, Gauge, Plus, Repeat } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { NativeToggle } from '../../../components/ui/native-toggle';
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
import { useMeasurementSystem } from '../../../hooks/use-measurement-system';
import { useMileageUnit } from '../../../hooks/use-mileage-unit';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import { CORE_ACTION_KIND, recordCoreAction } from '../../../lib/core-action-milestones';
import { gqlFetcher } from '../../../lib/graphql-client';
import { MetaAnalytics } from '../../../lib/meta-analytics';
import { scheduleMaintenanceReminder } from '../../../lib/notifications';
import { queryKeys } from '../../../lib/query-keys';
import { maybeRequestReview, REVIEW_MILESTONE } from '../../../lib/store-review';
import { useEditorialTheme } from '../../../theme/editorial';
import { radius, SYSTEM_WEIGHT, space, type } from '../../../theme/type';
import { triggerImpact } from '../../../utils/haptics';
import { intervalDistanceUnit } from '../../../utils/maintenance-interval';
import { toISODateInput } from '../../../utils/trip-form-dates';

/** Never let a "completed" timestamp run ahead of the current instant — the
 *  API rejects a future completedAt. Returns `now` when `date` is in the future,
 *  otherwise `date` unchanged. */
function clampToNow(date: Date): Date {
  return min([date, new Date()]);
}

const MULTILINE_INPUT = {
  paddingHorizontal: space.md,
  paddingVertical: space.sm,
  minHeight: 88,
} as const;

// The modal serves two intents on one screen: scheduling a future task,
// or logging work already completed (a historical maintenance record).
const TASK_MODES = { plan: 'plan', log: 'log' } as const;
type TaskMode = (typeof TASK_MODES)[keyof typeof TASK_MODES];

// Sane floor for backdating a logged record — far enough back to cover any
// real bike history without letting a fat-finger jump to 1970.
const MAX_BACKDATE_YEARS = 30;

export default function AddMaintenanceTaskScreen() {
  const { t } = useTranslation();
  const {
    motorcycleId,
    bikeName,
    mode: initialMode,
  } = useLocalSearchParams<{
    motorcycleId: string;
    bikeName?: string;
    // Entry points can deep-link straight into "log done work" (e.g. a Log CTA).
    mode?: string;
  }>();
  const startsInLog = initialMode === TASK_MODES.log;
  const { t: theme } = useEditorialTheme();
  const queryClient = useQueryClient();
  const system = useMeasurementSystem();
  const mileageUnit = useMileageUnit();
  const intervalUnit = intervalDistanceUnit(system);

  const [mode, setMode] = useState<TaskMode>(startsInLog ? TASK_MODES.log : TASK_MODES.plan);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  // Log mode records history, so seed the completion date to today up front.
  const [dueDate, setDueDate] = useState<Date | null>(startsInLog ? new Date() : null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [mileage, setMileage] = useState('');
  const [priority, setPriority] = useState<MaintenancePriority>('medium' as MaintenancePriority);
  const [notes, setNotes] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [intervalInput, setIntervalInput] = useState('');
  const [intervalDays, setIntervalDays] = useState('');
  const [saved, setSaved] = useState(false);

  const isLog = mode === TASK_MODES.log;

  // Switch intent, keeping the date coherent with the target mode so a value
  // entered in one mode can't produce an invalid record in the other:
  //  - into Log: a completed record can't be in the future → clamp to today
  //    (and seed today if unset); also drop the scheduling-only recurring flag.
  //  - back to Plan: a past date would render as instantly overdue → clear it.
  const switchMode = (next: TaskMode) => {
    triggerImpact();
    setMode(next);
    const now = new Date();
    if (next === TASK_MODES.log) {
      if (!dueDate || dueDate > endOfDay(now)) setDueDate(now);
      setIsRecurring(false);
    } else if (dueDate && dueDate < startOfDay(now)) {
      setDueDate(null);
    }
  };

  const createMutation = useMutation({
    mutationFn: () => {
      const mileageNum = mileage ? Number.parseInt(mileage, 10) : undefined;
      // Stored raw in the user's unit — the same convention odometer values
      // (target/completed/current mileage) follow everywhere in the app. The
      // recurrence engine computes completedMileage + intervalKm, so both must
      // share one unit; the label reflects the unit, we do NOT normalise to km
      // (that would desync from the raw odometers and inflate every next-due).
      const intervalValue = intervalInput ? Number.parseInt(intervalInput, 10) : undefined;

      const base = {
        motorcycleId,
        title: title.trim(),
        description: description.trim() || undefined,
        notes: notes.trim() || undefined,
        priority,
      };

      const input = isLog
        ? {
            ...base,
            // A logged record lands in history as completed on the chosen date.
            // Anchor the timestamp at local noon so the calendar day survives
            // the UTC conversion regardless of timezone.
            status: MaintenanceTaskStatus.Completed,
            // Anchor the timestamp at local noon so the calendar day survives the
            // UTC conversion, then clamp to "now": logging work for *today* before
            // local noon would otherwise send a completedAt ahead of the current
            // UTC instant, which the server rejects as a future completion
            // (MOTO-VAULT-REACT-NATIVE-1M). A past date keeps its noon anchor.
            completedAt: clampToNow(
              dueDate
                ? set(dueDate, { hours: 12, minutes: 0, seconds: 0, milliseconds: 0 })
                : new Date(),
            ).toISOString(),
            completedMileage: mileageNum,
            isRecurring: false,
          }
        : {
            ...base,
            dueDate: dueDate ? toISODateInput(dueDate) : undefined,
            targetMileage: mileageNum,
            isRecurring,
            intervalKm: intervalValue,
            intervalDays: intervalDays ? Number.parseInt(intervalDays, 10) : undefined,
          };

      return gqlFetcher(CreateMaintenanceTaskDocument, { input });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.maintenanceTasks.byMotorcycle(motorcycleId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceTasks.allUser });

      // Schedule notification reminders if the task has a due date.
      // A logged (already-completed) record has nothing to remind, so skip.
      // MOT-139: pass the multi-stage flags from the server response so the
      // scheduler fires 30d/7d/1d stages based on whatever defaults the API
      // applied (or explicit per-task overrides in a future iteration).
      if (dueDate && !isLog) {
        const createdTask = data?.createMaintenanceTask;
        if (createdTask?.id) {
          scheduleMaintenanceReminder(
            {
              id: createdTask.id,
              title: title.trim(),
              dueDate: toISODateInput(dueDate),
              motorcycleId,
              remind30d: createdTask.remind30d ?? false,
              remind7d: createdTask.remind7d ?? false,
              remind1d: createdTask.remind1d ?? true,
            },
            bikeName ?? 'Your bike',
          );
          // MOT-272: measure the reminder loop — paired with REMINDER_OPENED.
          trackEvent(AnalyticsEvent.REMINDER_SCHEDULED, {
            remind30d: createdTask.remind30d ?? false,
            remind7d: createdTask.remind7d ?? false,
            remind1d: createdTask.remind1d ?? true,
          });
        }
      }

      trackEvent(AnalyticsEvent.MAINTENANCE_TASK_CREATED, {
        priority,
        is_recurring: !isLog && isRecurring,
        has_due_date: !!dueDate,
        mode,
      });
      // Meta mirror only (FB SDK, ad optimisation) — never PostHog. The PostHog
      // event is maintenance_task_created above; see its doc in lib/analytics.ts.
      MetaAnalytics.trackLogMaintenance(title.trim());
      // Logging past work is a serviced bike; planning a future task is not.
      if (isLog) recordCoreAction(CORE_ACTION_KIND.SERVICE_LOGGED);
      setSaved(true);
      maybeRequestReview(REVIEW_MILESTONE.MAINTENANCE_TASK_ADDED);
      triggerImpact();
      setTimeout(() => router.back(), 600);
    },
    onError: () => {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('maintenance.createFailed', { defaultValue: 'Failed to create task. Please try again.' }),
      );
    },
  });

  const canSave = !!title.trim() && !(isLog && !dueDate) && !createMutation.isPending;
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
        <SheetTitle>
          {isLog ? t('maintenance.logWorkTitle') : t('maintenance.newTaskTitle')}
        </SheetTitle>

        {/* Mode switch — schedule a future task, or log work already done */}
        <View
          accessibilityRole="tablist"
          style={{
            flexDirection: 'row',
            gap: space.xxs,
            backgroundColor: theme.surface2,
            borderRadius: radius.control,
            borderCurve: 'continuous',
            padding: space.xxs,
          }}
        >
          {(
            [
              {
                key: TASK_MODES.plan,
                label: t('maintenance.modePlan', { defaultValue: 'Plan ahead' }),
                Icon: Calendar,
              },
              {
                key: TASK_MODES.log,
                label: t('maintenance.modeLog', { defaultValue: 'Log past work' }),
                Icon: CalendarCheck,
              },
            ] as const
          ).map(({ key, label, Icon }) => {
            const active = mode === key;
            return (
              <Pressable
                key={key}
                testID={`task-mode-${key}`}
                onPress={() => switchMode(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={{
                  flex: 1,
                  minHeight: 40,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  borderRadius: radius.control - space.xxs,
                  borderCurve: 'continuous',
                  backgroundColor: active ? theme.warm : 'transparent',
                }}
              >
                <Icon size={15} color={active ? theme.onWarm : theme.ink3} strokeWidth={2.25} />
                <Text
                  style={[
                    type.label,
                    active ? SYSTEM_WEIGHT.semibold : null,
                    { color: active ? theme.onWarm : theme.ink2 },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Task title */}
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
              autoFocus
            />
          </FormSection>
        </Animated.View>

        {/* Priority. Hidden when logging done work: priority is the urgency of
            a pending item, meaningless for finished work. */}
        {!isLog && (
          <Animated.View exiting={FadeOut.duration(150)} layout={LinearTransition.duration(220)}>
            <FormSection
              label={t('maintenance.priority', { defaultValue: 'Priority' })}
              card={false}
            >
              <PriorityPicker value={priority} onChange={setPriority} />
            </FormSection>
          </Animated.View>
        )}

        {/* Date + mileage */}
        <Animated.View layout={LinearTransition.duration(220)}>
          <FormSection
            label={
              isLog
                ? t('maintenance.logSection', { defaultValue: 'Record' })
                : t('maintenance.schedule', { defaultValue: 'Schedule' })
            }
          >
            <FormDateRow
              label={
                isLog
                  ? t('maintenance.dateDone', { defaultValue: 'Date completed' })
                  : t('maintenance.dueDate', { defaultValue: 'Due Date' })
              }
              value={dueDate}
              emptyLabel={t('maintenance.noneSet', { defaultValue: 'None' })}
              open={showDatePicker}
              onToggle={() => {
                if (!dueDate) setDueDate(new Date());
                setShowDatePicker(!showDatePicker);
              }}
              onClose={() => setShowDatePicker(false)}
              onChange={setDueDate}
              // A logged (completed) record must carry a date, so no Clear in
              // Log mode — otherwise completedAt would silently fall back to
              // now() while the row reads "None".
              onClear={
                isLog
                  ? undefined
                  : () => {
                      setDueDate(null);
                      setShowDatePicker(false);
                    }
              }
              // Log mode allows backdating (down to a 30-year floor) but not
              // the future; Plan mode schedules forward from today.
              minimumDate={isLog ? subYears(new Date(), MAX_BACKDATE_YEARS) : new Date()}
              maximumDate={isLog ? new Date() : undefined}
              testID="task-date"
            />
            <FormDivider inset={ROW_DIVIDER_INSET} />
            <FormRow
              icon={Gauge}
              label={
                isLog
                  ? t('maintenance.odometer', { defaultValue: 'Odometer' })
                  : t('maintenance.targetMileage', { defaultValue: 'Target mileage' })
              }
            >
              <RowNumberInput
                value={mileage}
                onChangeText={(val) => setMileage(val.replace(/[^0-9]/g, ''))}
                placeholder={t('garage.distanceIntervalPlaceholder')}
                unit={mileage ? mileageUnit : undefined}
              />
            </FormRow>
          </FormSection>
        </Animated.View>

        {/* Recurring toggle. Hidden when logging done work — you don't repeat
            something you already finished. */}
        {!isLog && (
          <Animated.View exiting={FadeOut.duration(150)} layout={LinearTransition.duration(220)}>
            <FormSection label={t('maintenance.options', { defaultValue: 'Options' })}>
              <FormRow
                icon={Repeat}
                label={t('maintenance.repeatTask', { defaultValue: 'Repeat this task' })}
                hint={
                  isRecurring
                    ? t('maintenance.recurringHint', {
                        defaultValue: 'Set a distance or time interval, whichever comes first',
                      })
                    : undefined
                }
              >
                <NativeToggle
                  value={isRecurring}
                  onValueChange={setIsRecurring}
                  tint={theme.warm}
                />
              </FormRow>

              {isRecurring && (
                <>
                  <FormDivider inset={ROW_DIVIDER_INSET} />
                  <FormRow
                    icon={Gauge}
                    label={t('maintenance.everyKm', { defaultValue: 'Distance interval' })}
                  >
                    <RowNumberInput
                      value={intervalInput}
                      onChangeText={(val) => setIntervalInput(val.replace(/[^0-9]/g, ''))}
                      placeholder={t('garage.mileageIntervalPlaceholder')}
                      unit={intervalUnit}
                      style={{ minWidth: 80 }}
                    />
                  </FormRow>
                  <FormDivider inset={ROW_DIVIDER_INSET} />
                  <FormRow
                    icon={Calendar}
                    label={t('maintenance.everyDays', { defaultValue: 'Time interval' })}
                  >
                    <RowNumberInput
                      value={intervalDays}
                      onChangeText={(val) => setIntervalDays(val.replace(/[^0-9]/g, ''))}
                      placeholder={t('garage.timeIntervalPlaceholder')}
                      unit={t('maintenance.days', { defaultValue: 'days' })}
                      style={{ minWidth: 80 }}
                    />
                  </FormRow>
                </>
              )}
            </FormSection>
          </Animated.View>
        )}

        {/* Description + notes */}
        <Animated.View layout={LinearTransition.duration(220)}>
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
        </Animated.View>
      </KeyboardAwareScrollView>

      <SheetFooter
        primaryTestID="task-save"
        primaryState={primaryState}
        primaryIcon={saved ? Check : Plus}
        primaryLabel={
          saved
            ? isLog
              ? t('maintenance.workLogged', { defaultValue: 'Logged!' })
              : t('maintenance.taskAdded', { defaultValue: 'Task Added!' })
            : createMutation.isPending
              ? t('common.saving', { defaultValue: 'Saving...' })
              : isLog
                ? t('maintenance.logWork', { defaultValue: 'Log it' })
                : t('maintenance.saveTask', { defaultValue: 'Save task' })
        }
        onPrimary={() => {
          triggerImpact();
          createMutation.mutate();
        }}
        onCancel={() => router.back()}
      />
    </View>
  );
}
