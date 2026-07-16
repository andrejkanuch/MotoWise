import DateTimePicker from '@expo/ui/community/datetime-picker';
import { palette, withAlpha } from '@motovault/design-system';
import {
  type MaintenancePriority,
  MaintenanceTasksByMotorcycleDocument,
  UpdateMaintenanceTaskDocument,
} from '@motovault/graphql';
import { mileageToDisplayUnit } from '@motovault/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Calendar, Check, Gauge } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useMeasurementSystem } from '../../../hooks/use-measurement-system';
import { useMileageUnit } from '../../../hooks/use-mileage-unit';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import { gqlFetcher } from '../../../lib/graphql-client';
import { cancelTaskNotification, scheduleMaintenanceReminder } from '../../../lib/notifications';
import { queryKeys } from '../../../lib/query-keys';
import { useEditorialTheme } from '../../../theme/editorial';
import { triggerImpact } from '../../../utils/haptics';
import { buildTaskUpdateInput, resolveReminderAction } from '../../../utils/maintenance-task-form';
import { toISODateInput } from '../../../utils/trip-form-dates';

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
const PRIORITY_META: Record<string, { color: string }> = {
  low: { color: palette.success500 },
  medium: { color: palette.primary500 },
  high: { color: palette.warning500 },
  critical: { color: palette.danger500 },
};

export default function EditMaintenanceTaskScreen() {
  const { t } = useTranslation();
  const { taskId, motorcycleId, bikeName } = useLocalSearchParams<{
    taskId: string;
    motorcycleId: string;
    bikeName?: string;
  }>();
  const { t: theme, isDark } = useEditorialTheme();
  const queryClient = useQueryClient();
  const mileageUnit = useMileageUnit();
  // targetMileage is persisted as canonical km; convert at the edges.
  const system = useMeasurementSystem();

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
  const [hydrated, setHydrated] = useState(false);
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
  useEffect(() => {
    if (!task || hydrated) return;
    setTitle(task.title ?? '');
    setDescription(task.description ?? '');
    // Parse the stored YYYY-MM-DD as local midnight so it round-trips through
    // toISODateInput (date-fns `format`, local tz) without drifting a day.
    setDueDate(task.dueDate ? new Date(`${task.dueDate}T00:00:00`) : null);
    setTargetMileage(
      task.targetMileage
        ? String(Math.round(mileageToDisplayUnit(task.targetMileage, system)))
        : '',
    );
    setPriority((task.priority ?? 'medium') as MaintenancePriority);
    setNotes(task.notes ?? '');
    setHydrated(true);
  }, [task, hydrated, system]);

  const updateMutation = useMutation({
    mutationFn: () =>
      gqlFetcher(UpdateMaintenanceTaskDocument, {
        id: taskId,
        input: buildTaskUpdateInput(
          {
            title,
            description,
            notes,
            targetMileage,
            priority,
            dueDateISO: dueDate ? toISODateInput(dueDate) : null,
          },
          system,
        ),
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
              {t('maintenance.editPrefix', { defaultValue: 'Edit' })}{' '}
            </Text>
            <Text
              style={{
                fontFamily: 'InstrumentSerif-Italic',
                fontSize: 32,
                color: theme.warm,
                letterSpacing: -0.6,
              }}
            >
              {t('maintenance.taskSuffix', { defaultValue: 'task.' })}
            </Text>
          </View>
        </View>

        {/* Task Title */}
        <Animated.View entering={FadeIn.duration(250)}>
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
            />
          </View>
        </Animated.View>

        {/* Priority */}
        <Animated.View entering={FadeInDown.delay(50).duration(250)}>
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

        {/* Due Date + Mileage */}
        <Animated.View entering={FadeInDown.delay(100).duration(250)}>
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
            {t('maintenance.schedule', { defaultValue: 'Schedule' })}
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
                  {t('maintenance.dueDate', { defaultValue: 'Due Date' })}
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

            {showDatePicker && dueDate && (
              <View
                style={{
                  borderTopWidth: 0.5,
                  borderTopColor: isDark ? palette.dividerDark : palette.dividerLight,
                  paddingHorizontal: 8,
                }}
              >
                <DateTimePicker
                  value={dueDate}
                  mode="date"
                  display={process.env.EXPO_OS === 'ios' ? 'inline' : 'default'}
                  onChange={(event, selectedDate) => {
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
                {t('maintenance.targetMileage', { defaultValue: 'Mileage' })}
              </Text>
              <TextInput
                value={targetMileage}
                onChangeText={(val) => setTargetMileage(val.replace(/[^0-9]/g, ''))}
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
              {targetMileage ? (
                <Text style={{ fontSize: 13, color: palette.neutral400 }}>{mileageUnit}</Text>
              ) : null}
            </View>
          </View>
        </Animated.View>

        {/* Description + Notes */}
        <Animated.View entering={FadeInDown.delay(150).duration(250)}>
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
              updateMutation.mutate();
            }}
            disabled={updateMutation.isPending || !title.trim() || saved}
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
            {saved ? <Check size={18} color={palette.white} strokeWidth={2.5} /> : null}
            <Text style={{ fontSize: 16, fontWeight: '700', color: palette.white }}>
              {saved
                ? t('maintenance.taskUpdated', { defaultValue: 'Saved!' })
                : updateMutation.isPending
                  ? t('common.saving', { defaultValue: 'Saving...' })
                  : t('maintenance.saveChanges', { defaultValue: 'Save changes' })}
            </Text>
          </Pressable>
        </View>
      </KeyboardStickyView>
    </View>
  );
}
