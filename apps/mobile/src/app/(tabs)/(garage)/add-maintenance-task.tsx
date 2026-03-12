import { palette } from '@motovault/design-system';
import { CreateMaintenanceTaskDocument, type MaintenancePriority } from '@motovault/graphql';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Calendar, Check, Gauge, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, Text, TextInput, useColorScheme, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { gqlFetcher } from '../../../lib/graphql-client';
import { scheduleMaintenanceReminder } from '../../../lib/notifications';
import { queryKeys } from '../../../lib/query-keys';

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
const PRIORITY_META: Record<string, { color: string; emoji: string }> = {
  low: { color: palette.success500, emoji: '🟢' },
  medium: { color: palette.primary500, emoji: '🔵' },
  high: { color: palette.warning500, emoji: '🟠' },
  critical: { color: palette.danger500, emoji: '🔴' },
};

function haptic() {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function AddMaintenanceTaskScreen() {
  const { t } = useTranslation();
  const { motorcycleId, bikeName } = useLocalSearchParams<{
    motorcycleId: string;
    bikeName?: string;
  }>();
  const isDark = useColorScheme() === 'dark';
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [targetMileage, setTargetMileage] = useState('');
  const [priority, setPriority] = useState<MaintenancePriority>('medium' as MaintenancePriority);
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);

  const createMutation = useMutation({
    mutationFn: () =>
      gqlFetcher(CreateMaintenanceTaskDocument, {
        input: {
          motorcycleId,
          title: title.trim(),
          description: description.trim() || undefined,
          dueDate: dueDate ? formatDate(dueDate) : undefined,
          targetMileage: targetMileage ? Number.parseInt(targetMileage, 10) : undefined,
          priority,
          notes: notes.trim() || undefined,
        },
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.maintenanceTasks.byMotorcycle(motorcycleId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceTasks.allUser });

      // Schedule a notification reminder if the task has a due date
      if (dueDate) {
        const createdTask = data?.createMaintenanceTask;
        if (createdTask?.id) {
          scheduleMaintenanceReminder(
            {
              id: createdTask.id,
              title: title.trim(),
              dueDate: formatDate(dueDate),
              motorcycleId,
            },
            bikeName ?? 'Your bike',
          );
        }
      }

      setSaved(true);
      haptic();
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
  const cardBg = isDark ? palette.neutral800 : palette.white;
  const sectionGap = 24;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: sectionGap }}
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Task Title — prominent input */}
      <Animated.View entering={FadeIn.duration(250)}>
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
            fontSize: 13,
            fontWeight: '600',
            color: palette.neutral500,
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
                  haptic();
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
                <Text style={{ fontSize: 12, marginBottom: 2 }}>{meta.emoji}</Text>
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
            fontSize: 13,
            fontWeight: '600',
            color: palette.neutral500,
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
              haptic();
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
                value={dueDate}
                mode="date"
                display="inline"
                minimumDate={new Date()}
                onChange={(_, selectedDate) => {
                  if (selectedDate) setDueDate(selectedDate);
                }}
                style={{ height: 320 }}
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
                    haptic();
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
                    haptic();
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
              placeholder="e.g. 15000"
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

      {/* Description + Notes — grouped card */}
      <Animated.View entering={FadeInDown.delay(150).duration(250)}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: '600',
            color: palette.neutral500,
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

      {/* Save Button */}
      <Animated.View entering={FadeInDown.delay(200).duration(250)}>
        <Pressable
          onPress={() => {
            haptic();
            createMutation.mutate();
          }}
          disabled={createMutation.isPending || !title.trim() || saved}
          style={{
            backgroundColor: saved
              ? palette.success500
              : title.trim()
                ? palette.primary500
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
                : t('maintenance.addTask', { defaultValue: 'Add Task' })}
          </Text>
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
}
