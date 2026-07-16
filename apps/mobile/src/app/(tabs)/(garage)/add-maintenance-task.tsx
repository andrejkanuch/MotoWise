import DateTimePicker from '@expo/ui/community/datetime-picker';
import { palette, withAlpha } from '@motovault/design-system';
import {
  CreateMaintenanceTaskDocument,
  type MaintenancePriority,
  MaintenanceTaskStatus,
} from '@motovault/graphql';
import { mileageFromDisplayUnit } from '@motovault/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { endOfDay, set, startOfDay, subYears } from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';
import { Calendar, CalendarCheck, Check, Gauge, Plus, Repeat } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { NativeToggle } from '../../../components/ui/native-toggle';
import { useMeasurementSystem } from '../../../hooks/use-measurement-system';
import { useMileageUnit } from '../../../hooks/use-mileage-unit';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import { gqlFetcher } from '../../../lib/graphql-client';
import { MetaAnalytics } from '../../../lib/meta-analytics';
import { scheduleMaintenanceReminder } from '../../../lib/notifications';
import { queryKeys } from '../../../lib/query-keys';
import { maybeRequestReview, REVIEW_MILESTONE } from '../../../lib/store-review';
import { useEditorialTheme } from '../../../theme/editorial';
import { triggerImpact } from '../../../utils/haptics';
import { intervalDistanceUnit } from '../../../utils/maintenance-interval';
import { toISODateInput } from '../../../utils/trip-form-dates';

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
const PRIORITY_META: Record<string, { color: string }> = {
  low: { color: palette.success500 },
  medium: { color: palette.primary500 },
  high: { color: palette.warning500 },
  critical: { color: palette.danger500 },
};

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
  const { t: theme, isDark } = useEditorialTheme();
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
      // All persisted odometer/mileage integers are canonical KILOMETRES
      // (target/completed/current mileage + intervalKm). The rider types in
      // their measurement system's unit, so convert to km on write here and
      // back to the display unit on read. The recurrence engine computes
      // completedMileage + intervalKm, both km, so they stay in sync.
      const mileageKm =
        mileageNum != null && !Number.isNaN(mileageNum)
          ? Math.round(mileageFromDisplayUnit(mileageNum, system))
          : undefined;
      const intervalValue = intervalInput ? Number.parseInt(intervalInput, 10) : undefined;
      const intervalKmValue =
        intervalValue != null && !Number.isNaN(intervalValue)
          ? Math.round(mileageFromDisplayUnit(intervalValue, system))
          : undefined;

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
            completedAt: (dueDate
              ? set(dueDate, { hours: 12, minutes: 0, seconds: 0, milliseconds: 0 })
              : new Date()
            ).toISOString(),
            completedMileage: mileageKm,
            isRecurring: false,
          }
        : {
            ...base,
            dueDate: dueDate ? toISODateInput(dueDate) : undefined,
            targetMileage: mileageKm,
            isRecurring,
            intervalKm: intervalKmValue,
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
      MetaAnalytics.trackLogMaintenance(title.trim());
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

  // Grouped card background
  const cardBg = theme.surface;
  const sectionGap = 24;

  return (
    <View style={{ flex: 1 }}>
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        bottomOffset={20}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: sectionGap }}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Editorial header */}
        <View style={{ paddingTop: 8, marginBottom: 8 }}>
          <Text
            style={{
              fontSize: 10,
              fontWeight: '700',
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: theme.ink3,
              marginBottom: 6,
            }}
          >
            — {t('maintenance.headerLabel', { defaultValue: 'MAINTENANCE' })}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text
              style={{
                fontFamily: 'InstrumentSerif-Regular',
                fontSize: 32,
                color: theme.ink,
                letterSpacing: -0.6,
              }}
            >
              {isLog
                ? t('maintenance.logPrefix', { defaultValue: 'Log' })
                : t('maintenance.newPrefix', { defaultValue: 'New' })}{' '}
            </Text>
            <Text
              style={{
                fontFamily: 'InstrumentSerif-Italic',
                fontSize: 32,
                color: theme.warm,
                letterSpacing: -0.6,
              }}
            >
              {isLog
                ? t('maintenance.logSuffix', { defaultValue: 'work.' })
                : t('maintenance.taskSuffix', { defaultValue: 'task.' })}
            </Text>
          </View>
        </View>

        {/* Mode switch — schedule a future task, or log work already done */}
        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            backgroundColor: isDark ? palette.neutral800 : palette.neutral100,
            borderRadius: 14,
            borderCurve: 'continuous',
            padding: 4,
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
                onPress={() => switchMode(key)}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingVertical: 10,
                  borderRadius: 11,
                  borderCurve: 'continuous',
                  backgroundColor: active ? theme.warm : 'transparent',
                }}
              >
                <Icon size={15} color={active ? palette.white : theme.ink3} strokeWidth={2.25} />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: active ? '700' : '500',
                    color: active ? palette.white : theme.ink2,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Task Title — prominent input */}
        <Animated.View entering={FadeIn.duration(250)}>
          {/* TASK section label */}
          <Text
            style={{
              fontSize: 10,
              fontWeight: '700',
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              color: theme.ink3,
              marginBottom: 8,
              marginLeft: 4,
            }}
          >
            {t('maintenance.task', { defaultValue: 'Task' })}
          </Text>
          <View
            style={{
              backgroundColor: cardBg,
              borderRadius: 14,
              borderCurve: 'continuous',
              padding: 16,
              boxShadow: isDark ? 'none' : `0 1px 3px ${withAlpha(palette.black, 0.06)}`,
            }}
          >
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={t('maintenance.taskTitlePlaceholder', {
                defaultValue: 'e.g. Oil Change, Chain Adjustment',
              })}
              placeholderTextColor={palette.neutral400}
              style={{
                fontSize: 18,
                fontWeight: '600',
                color: isDark ? palette.neutral50 : palette.neutral950,
                paddingVertical: 2,
              }}
              autoFocus
            />
          </View>
        </Animated.View>

        {/* Priority — pill selector. Hidden when logging done work: priority is
            the urgency of a pending item, meaningless for finished work. */}
        {!isLog && (
          <Animated.View
            entering={FadeInDown.delay(50).duration(250)}
            exiting={FadeOut.duration(150)}
            layout={LinearTransition.duration(220)}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                color: theme.ink3,
                marginBottom: 8,
                marginLeft: 4,
              }}
            >
              {t('maintenance.priority', { defaultValue: 'Priority' })}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {PRIORITIES.map((p) => {
                const selected = priority === p;
                const meta = PRIORITY_META[p];
                return (
                  <Pressable
                    key={p}
                    onPress={() => {
                      triggerImpact();
                      setPriority(p as MaintenancePriority);
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 12,
                      borderCurve: 'continuous',
                      alignItems: 'center',
                      backgroundColor: selected
                        ? withAlpha(meta.color, 0.094)
                        : isDark
                          ? palette.neutral800
                          : palette.white,
                      borderWidth: selected ? 1.5 : 1,
                      borderColor: selected
                        ? meta.color
                        : isDark
                          ? palette.neutral700
                          : palette.neutral200,
                      boxShadow: selected
                        ? 'none'
                        : isDark
                          ? 'none'
                          : `0 1px 2px ${withAlpha(palette.black, 0.04)}`,
                    }}
                  >
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: meta.color,
                        marginBottom: 4,
                      }}
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: selected ? '700' : '500',
                        color: selected
                          ? meta.color
                          : isDark
                            ? palette.neutral400
                            : palette.neutral600,
                        textTransform: 'capitalize',
                      }}
                    >
                      {t(`maintenance.priority_${p}`, { defaultValue: p })}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* Due Date + Mileage — grouped card */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(250)}
          layout={LinearTransition.duration(220)}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: '700',
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              color: theme.ink3,
              marginBottom: 8,
              marginLeft: 4,
            }}
          >
            {isLog
              ? t('maintenance.logSection', { defaultValue: 'Record' })
              : t('maintenance.schedule', { defaultValue: 'Schedule' })}
          </Text>
          <View
            style={{
              backgroundColor: cardBg,
              borderRadius: 14,
              borderCurve: 'continuous',
              overflow: 'hidden',
              boxShadow: isDark ? 'none' : `0 1px 3px ${withAlpha(palette.black, 0.06)}`,
            }}
          >
            {/* Due Date row */}
            <Pressable
              onPress={() => {
                triggerImpact();
                if (!dueDate) setDueDate(new Date());
                setShowDatePicker(!showDatePicker);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 14,
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  borderCurve: 'continuous',
                  backgroundColor: isDark ? palette.primary900 : palette.primary50,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Calendar size={16} color={palette.primary500} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '500',
                    color: isDark ? palette.neutral50 : palette.neutral950,
                  }}
                >
                  {isLog
                    ? t('maintenance.dateDone', { defaultValue: 'Date completed' })
                    : t('maintenance.dueDate', { defaultValue: 'Due Date' })}
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 14,
                  color: dueDate ? palette.primary500 : palette.neutral400,
                  fontWeight: dueDate ? '600' : '400',
                }}
              >
                {dueDate
                  ? dueDate.toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : t('maintenance.noneSet', { defaultValue: 'None' })}
              </Text>
            </Pressable>

            {/* Inline date picker */}
            {showDatePicker && dueDate && (
              <View
                style={{
                  borderTopWidth: 0.5,
                  borderTopColor: isDark ? palette.dividerDark : palette.dividerLight,
                  paddingHorizontal: 8,
                }}
              >
                <DateTimePicker
                  value={dueDate ?? new Date()}
                  mode="date"
                  display={process.env.EXPO_OS === 'ios' ? 'inline' : 'default'}
                  // Log mode allows backdating (down to a 30-year floor) but not
                  // the future; Plan mode schedules forward from today.
                  minimumDate={isLog ? subYears(new Date(), MAX_BACKDATE_YEARS) : new Date()}
                  maximumDate={isLog ? new Date() : undefined}
                  onChange={(event, selectedDate) => {
                    // On Android, the native dialog fires onChange on both "OK" and "Cancel"
                    // and must be dismissed by hiding the picker immediately
                    if (process.env.EXPO_OS === 'android') {
                      setShowDatePicker(false);
                    }
                    if (event.type === 'set' && selectedDate) {
                      setDueDate(selectedDate);
                    }
                  }}
                  style={process.env.EXPO_OS === 'ios' ? { height: 320 } : undefined}
                />
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'flex-end',
                    paddingBottom: 8,
                    paddingRight: 8,
                    gap: 16,
                  }}
                >
                  {/* A logged (completed) record must carry a date, so no Clear
                      in Log mode — otherwise completedAt would silently fall back
                      to now() while the row reads "None". */}
                  {!isLog && (
                    <Pressable
                      onPress={() => {
                        triggerImpact();
                        setDueDate(null);
                        setShowDatePicker(false);
                      }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '600', color: palette.danger500 }}>
                        {t('maintenance.clearDate', { defaultValue: 'Clear' })}
                      </Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => {
                      triggerImpact();
                      setShowDatePicker(false);
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '600', color: palette.primary500 }}>
                      {t('common.done', { defaultValue: 'Done' })}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Separator */}
            <View
              style={{
                height: 0.5,
                backgroundColor: isDark ? palette.dividerDark : palette.dividerLight,
                marginLeft: 60,
              }}
            />

            {/* Target Mileage row */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 10,
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  borderCurve: 'continuous',
                  backgroundColor: isDark ? palette.successBgDark : palette.successBgLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Gauge size={16} color={palette.success500} strokeWidth={2} />
              </View>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '500',
                  color: isDark ? palette.neutral50 : palette.neutral950,
                  flex: 1,
                }}
              >
                {isLog
                  ? t('maintenance.odometer', { defaultValue: 'Odometer' })
                  : t('maintenance.targetMileage', { defaultValue: 'Target mileage' })}
              </Text>
              <TextInput
                value={mileage}
                onChangeText={(val) => setMileage(val.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder={t('garage.distanceIntervalPlaceholder')}
                placeholderTextColor={palette.neutral400}
                textAlign="right"
                style={{
                  fontSize: 15,
                  fontWeight: '500',
                  color: isDark ? palette.neutral50 : palette.neutral950,
                  minWidth: 100,
                  paddingVertical: 4,
                }}
              />
              {mileage ? (
                <Text style={{ fontSize: 13, color: palette.neutral400 }}>{mileageUnit}</Text>
              ) : null}
            </View>
          </View>
        </Animated.View>

        {/* Recurring toggle. Hidden when logging done work — you don't repeat
            something you already finished. */}
        {!isLog && (
          <Animated.View
            entering={FadeInDown.delay(125).duration(250)}
            exiting={FadeOut.duration(150)}
            layout={LinearTransition.duration(220)}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                color: theme.ink3,
                marginBottom: 8,
                marginLeft: 4,
              }}
            >
              {t('maintenance.options', { defaultValue: 'Options' })}
            </Text>
            <View
              style={{
                backgroundColor: cardBg,
                borderRadius: 14,
                borderCurve: 'continuous',
                overflow: 'hidden',
                boxShadow: isDark ? 'none' : `0 1px 3px ${withAlpha(palette.black, 0.06)}`,
              }}
            >
              {/* Toggle row */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      borderCurve: 'continuous',
                      backgroundColor: isDark ? palette.indigoBg : palette.primary50,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Repeat size={16} color={palette.indigo500} strokeWidth={2} />
                  </View>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '500',
                      color: isDark ? palette.neutral50 : palette.neutral950,
                    }}
                  >
                    {t('maintenance.repeatTask', { defaultValue: 'Repeat this task' })}
                  </Text>
                </View>
                <NativeToggle value={isRecurring} onValueChange={setIsRecurring} />
              </View>

              {/* Interval inputs (shown when recurring) */}
              {isRecurring && (
                <>
                  <Text
                    style={{
                      fontSize: 12,
                      color: palette.neutral500,
                      paddingHorizontal: 16,
                      paddingBottom: 8,
                    }}
                  >
                    {t('maintenance.recurringHint', {
                      defaultValue: 'Set a distance or time interval, whichever comes first',
                    })}
                  </Text>
                  <View
                    style={{
                      height: 0.5,
                      backgroundColor: isDark ? palette.dividerDark : palette.dividerLight,
                      marginLeft: 60,
                    }}
                  />
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        borderCurve: 'continuous',
                        backgroundColor: isDark ? palette.successBgDark : palette.successBgLight,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Gauge size={16} color={palette.success500} strokeWidth={2} />
                    </View>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '500',
                        color: isDark ? palette.neutral50 : palette.neutral950,
                        flex: 1,
                      }}
                    >
                      {t('maintenance.everyKm', { defaultValue: 'Distance interval' })}
                    </Text>
                    <TextInput
                      value={intervalInput}
                      onChangeText={(val) => setIntervalInput(val.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      placeholder={t('garage.mileageIntervalPlaceholder')}
                      placeholderTextColor={palette.neutral400}
                      textAlign="right"
                      style={{
                        fontSize: 15,
                        fontWeight: '500',
                        color: isDark ? palette.neutral50 : palette.neutral950,
                        minWidth: 80,
                        paddingVertical: 4,
                      }}
                    />
                    <Text style={{ fontSize: 13, color: palette.neutral400 }}>{intervalUnit}</Text>
                  </View>

                  <View
                    style={{
                      height: 0.5,
                      backgroundColor: isDark ? palette.dividerDark : palette.dividerLight,
                      marginLeft: 60,
                    }}
                  />
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        borderCurve: 'continuous',
                        backgroundColor: isDark ? palette.primary900 : palette.primary50,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Calendar size={16} color={palette.primary500} strokeWidth={2} />
                    </View>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '500',
                        color: isDark ? palette.neutral50 : palette.neutral950,
                        flex: 1,
                      }}
                    >
                      {t('maintenance.everyDays', { defaultValue: 'Time interval' })}
                    </Text>
                    <TextInput
                      value={intervalDays}
                      onChangeText={(val) => setIntervalDays(val.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      placeholder={t('garage.timeIntervalPlaceholder')}
                      placeholderTextColor={palette.neutral400}
                      textAlign="right"
                      style={{
                        fontSize: 15,
                        fontWeight: '500',
                        color: isDark ? palette.neutral50 : palette.neutral950,
                        minWidth: 80,
                        paddingVertical: 4,
                      }}
                    />
                    <Text style={{ fontSize: 13, color: palette.neutral400 }}>
                      {t('maintenance.days', { defaultValue: 'days' })}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </Animated.View>
        )}

        {/* Description + Notes — grouped card */}
        <Animated.View
          entering={FadeInDown.delay(175).duration(250)}
          layout={LinearTransition.duration(220)}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: '700',
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              color: theme.ink3,
              marginBottom: 8,
              marginLeft: 4,
            }}
          >
            {t('maintenance.details', { defaultValue: 'Details' })}
          </Text>
          <View
            style={{
              backgroundColor: cardBg,
              borderRadius: 14,
              borderCurve: 'continuous',
              overflow: 'hidden',
              boxShadow: isDark ? 'none' : `0 1px 3px ${withAlpha(palette.black, 0.06)}`,
            }}
          >
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={t('maintenance.descriptionPlaceholder', {
                defaultValue: 'What needs to be done...',
              })}
              placeholderTextColor={palette.neutral400}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={{
                fontSize: 15,
                color: isDark ? palette.neutral50 : palette.neutral950,
                paddingHorizontal: 16,
                paddingTop: 14,
                paddingBottom: 14,
                minHeight: 80,
              }}
            />
            <View
              style={{
                height: 0.5,
                backgroundColor: isDark ? palette.dividerDark : palette.dividerLight,
                marginLeft: 16,
              }}
            />
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={t('maintenance.notesPlaceholder', {
                defaultValue: 'Parts needed, tips, references...',
              })}
              placeholderTextColor={palette.neutral400}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={{
                fontSize: 15,
                color: isDark ? palette.neutral50 : palette.neutral950,
                paddingHorizontal: 16,
                paddingTop: 14,
                paddingBottom: 14,
                minHeight: 80,
              }}
            />
          </View>
        </Animated.View>
      </KeyboardAwareScrollView>

      {/* Cancel + Save Footer — pinned above the keyboard so Save is always
          reachable while typing (KeyboardStickyView rises with the keyboard). */}
      <KeyboardStickyView>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 16,
            backgroundColor: isDark ? palette.neutral900 : palette.neutral50,
            borderTopWidth: 0.5,
            borderTopColor: isDark ? palette.dividerDark : palette.dividerLight,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{ paddingVertical: 16, paddingHorizontal: 12 }}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: theme.ink2 }}>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              triggerImpact();
              createMutation.mutate();
            }}
            disabled={createMutation.isPending || !title.trim() || (isLog && !dueDate) || saved}
            style={{
              flex: 1,
              backgroundColor: saved
                ? palette.success500
                : title.trim()
                  ? theme.warm
                  : isDark
                    ? palette.neutral700
                    : palette.neutral300,
              borderRadius: 14,
              borderCurve: 'continuous',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 16,
              gap: 8,
            }}
          >
            {saved ? (
              <Check size={18} color={palette.white} strokeWidth={2.5} />
            ) : (
              <Plus size={18} color={palette.white} strokeWidth={2.5} />
            )}
            <Text style={{ fontSize: 16, fontWeight: '700', color: palette.white }}>
              {saved
                ? isLog
                  ? t('maintenance.workLogged', { defaultValue: 'Logged!' })
                  : t('maintenance.taskAdded', { defaultValue: 'Task Added!' })
                : createMutation.isPending
                  ? t('common.saving', { defaultValue: 'Saving...' })
                  : isLog
                    ? t('maintenance.logWork', { defaultValue: 'Log it' })
                    : t('maintenance.saveTask', { defaultValue: 'Save task' })}
            </Text>
          </Pressable>
        </View>
      </KeyboardStickyView>
    </View>
  );
}
