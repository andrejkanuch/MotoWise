import DateTimePicker from '@expo/ui/community/datetime-picker';
import { palette } from '@motovault/design-system';
import { CreateMaintenanceTaskDocument, type MaintenancePriority } from '@motovault/graphql';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Calendar, Check, Gauge, Plus, Repeat } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { NativeToggle } from '../../../components/ui/native-toggle';
import { AnalyticsEvent, trackEventWithSurvey } from '../../../lib/analytics';
import { gqlFetcher } from '../../../lib/graphql-client';
import { MetaAnalytics } from '../../../lib/meta-analytics';
import { scheduleMaintenanceReminder } from '../../../lib/notifications';
import { queryKeys } from '../../../lib/query-keys';
import { maybeRequestReview } from '../../../lib/store-review';
import { useEditorialTheme } from '../../../theme/editorial';
import { triggerImpact } from '../../../utils/haptics';
import { toISODateInput } from '../../../utils/trip-form-dates';

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
const PRIORITY_META: Record<string, { color: string }> = {
  low: { color: palette.success500 },
  medium: { color: palette.primary500 },
  high: { color: palette.warning500 },
  critical: { color: palette.danger500 },
};

export default function AddMaintenanceTaskScreen() {
  const { t } = useTranslation();
  const { motorcycleId, bikeName } = useLocalSearchParams<{
    motorcycleId: string;
    bikeName?: string;
  }>();
  const { t: theme, isDark } = useEditorialTheme();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [targetMileage, setTargetMileage] = useState('');
  const [priority, setPriority] = useState<MaintenancePriority>('medium' as MaintenancePriority);
  const [notes, setNotes] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [intervalKm, setIntervalKm] = useState('');
  const [intervalDays, setIntervalDays] = useState('');
  const [saved, setSaved] = useState(false);

  const createMutation = useMutation({
    mutationFn: () =>
      gqlFetcher(CreateMaintenanceTaskDocument, {
        input: {
          motorcycleId,
          title: title.trim(),
          description: description.trim() || undefined,
          dueDate: dueDate ? toISODateInput(dueDate) : undefined,
          targetMileage: targetMileage ? Number.parseInt(targetMileage, 10) : undefined,
          priority,
          notes: notes.trim() || undefined,
          isRecurring,
          intervalKm: intervalKm ? parseInt(intervalKm, 10) : undefined,
          intervalDays: intervalDays ? parseInt(intervalDays, 10) : undefined,
        },
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.maintenanceTasks.byMotorcycle(motorcycleId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceTasks.allUser });

      // Schedule notification reminders if the task has a due date.
      // MOT-139: pass the multi-stage flags from the server response so the
      // scheduler fires 30d/7d/1d stages based on whatever defaults the API
      // applied (or explicit per-task overrides in a future iteration).
      if (dueDate) {
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
        }
      }

      trackEventWithSurvey(AnalyticsEvent.MAINTENANCE_TASK_CREATED, {
        priority,
        is_recurring: isRecurring,
        has_due_date: !!dueDate,
      });
      MetaAnalytics.trackLogMaintenance(title.trim());
      setSaved(true);
      maybeRequestReview();
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
    <KeyboardAwareScrollView
      bottomOffset={20}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: sectionGap }}
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
          — MAINTENANCE
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
            New{' '}
          </Text>
          <Text
            style={{
              fontFamily: 'InstrumentSerif-Italic',
              fontSize: 32,
              color: theme.warm,
              letterSpacing: -0.6,
            }}
          >
            task.
          </Text>
        </View>
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
            boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
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

      {/* Priority — pill selector */}
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
                    ? `${meta.color}18`
                    : isDark
                      ? palette.neutral800
                      : palette.white,
                  borderWidth: selected ? 1.5 : 1,
                  borderColor: selected
                    ? meta.color
                    : isDark
                      ? palette.neutral700
                      : palette.neutral200,
                  boxShadow: selected ? 'none' : isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.04)',
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
                    color: selected ? meta.color : isDark ? palette.neutral400 : palette.neutral600,
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

      {/* Due Date + Mileage — grouped card */}
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
            boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
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

          {/* Inline date picker */}
          {showDatePicker && dueDate && (
            <View
              style={{
                borderTopWidth: 0.5,
                borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                paddingHorizontal: 8,
              }}
            >
              <DateTimePicker
                value={dueDate && dueDate >= new Date() ? dueDate : new Date()}
                mode="date"
                display={process.env.EXPO_OS === 'ios' ? 'inline' : 'default'}
                minimumDate={new Date()}
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

          {/* Separator */}
          <View
            style={{
              height: 0.5,
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
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
              onChangeText={setTargetMileage}
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
              <Text style={{ fontSize: 13, color: palette.neutral400 }}>km</Text>
            ) : null}
          </View>
        </View>
      </Animated.View>

      {/* Recurring toggle */}
      <Animated.View entering={FadeInDown.delay(125).duration(250)}>
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
            boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
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
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
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
                  value={intervalKm}
                  onChangeText={(val) => setIntervalKm(val.replace(/[^0-9]/g, ''))}
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
                <Text style={{ fontSize: 13, color: palette.neutral400 }}>km</Text>
              </View>

              <View
                style={{
                  height: 0.5,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
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

      {/* Description + Notes — grouped card */}
      <Animated.View entering={FadeInDown.delay(175).duration(250)}>
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
            boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
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
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
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

      {/* Cancel + Save Footer */}
      <Animated.View entering={FadeInDown.delay(225).duration(250)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
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
            disabled={createMutation.isPending || !title.trim() || saved}
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
                ? t('maintenance.taskAdded', { defaultValue: 'Task Added!' })
                : createMutation.isPending
                  ? t('common.saving', { defaultValue: 'Saving...' })
                  : t('maintenance.saveTask', { defaultValue: 'Save task' })}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </KeyboardAwareScrollView>
  );
}
