import { palette } from '@motolearn/design-system';
import { CreateMaintenanceTaskDocument, type MaintenancePriority } from '@motolearn/graphql';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
const PRIORITY_COLORS: Record<string, string> = {
  low: palette.success500,
  medium: palette.primary500,
  high: palette.warning500,
  critical: palette.danger500,
};

function haptic() {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

export default function AddMaintenanceTaskScreen() {
  const { t } = useTranslation();
  const { motorcycleId } = useLocalSearchParams<{ motorcycleId: string }>();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
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
          dueDate: dueDate.trim() || undefined,
          targetMileage: targetMileage ? Number.parseInt(targetMileage, 10) : undefined,
          priority,
          notes: notes.trim() || undefined,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.maintenanceTasks.byMotorcycle(motorcycleId),
      });
      setSaved(true);
      setTimeout(() => router.back(), 800);
    },
    onError: () => {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('maintenance.createFailed', { defaultValue: 'Failed to create task. Please try again.' }),
      );
    },
  });

  const inputStyle = {
    backgroundColor: isDark ? palette.neutral800 : palette.white,
    borderRadius: 14,
    borderCurve: 'continuous' as const,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: isDark ? palette.neutral50 : palette.neutral950,
  };

  const labelStyle = {
    fontSize: 13,
    fontWeight: '600' as const,
    color: palette.neutral500,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: isDark ? palette.neutral900 : palette.neutral50 }}
      behavior="padding"
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInUp.duration(400)} style={{ gap: 20 }}>
          {/* Title */}
          <View>
            <Text style={labelStyle}>
              {t('maintenance.taskTitle', { defaultValue: 'Task Title' })}
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={t('maintenance.taskTitlePlaceholder', {
                defaultValue: 'e.g. Oil Change, Chain Adjustment',
              })}
              placeholderTextColor={palette.neutral400}
              style={inputStyle}
            />
          </View>

          {/* Priority */}
          <View>
            <Text style={labelStyle}>
              {t('maintenance.priority', { defaultValue: 'Priority' })}
            </Text>
            <View
              style={{
                backgroundColor: isDark ? palette.neutral800 : palette.white,
                borderRadius: 14,
                borderCurve: 'continuous',
                flexDirection: 'row',
                padding: 4,
              }}
            >
              {PRIORITIES.map((p) => {
                const selected = priority === p;
                return (
                  <Pressable
                    key={p}
                    onPress={() => {
                      haptic();
                      setPriority(p as MaintenancePriority);
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 10,
                      borderCurve: 'continuous',
                      alignItems: 'center',
                      backgroundColor: selected ? PRIORITY_COLORS[p] : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: selected
                          ? palette.white
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
          </View>

          {/* Due Date */}
          <View>
            <Text style={labelStyle}>
              {t('maintenance.dueDate', { defaultValue: 'Due Date (optional)' })}
            </Text>
            <TextInput
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={palette.neutral400}
              style={inputStyle}
            />
          </View>

          {/* Target Mileage */}
          <View>
            <Text style={labelStyle}>
              {t('maintenance.targetMileage', { defaultValue: 'Target Mileage (optional)' })}
            </Text>
            <TextInput
              value={targetMileage}
              onChangeText={setTargetMileage}
              keyboardType="number-pad"
              placeholder="e.g. 15000"
              placeholderTextColor={palette.neutral400}
              style={inputStyle}
            />
          </View>

          {/* Description */}
          <View>
            <Text style={labelStyle}>
              {t('maintenance.description', { defaultValue: 'Description (optional)' })}
            </Text>
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
              style={{ ...inputStyle, minHeight: 80, paddingTop: 14 }}
            />
          </View>

          {/* Notes */}
          <View>
            <Text style={labelStyle}>
              {t('maintenance.notes', { defaultValue: 'Notes (optional)' })}
            </Text>
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
              style={{ ...inputStyle, minHeight: 80, paddingTop: 14 }}
            />
          </View>
        </Animated.View>

        {/* Save Button */}
        <Animated.View entering={FadeInUp.delay(80).duration(400)} style={{ marginTop: 32 }}>
          <Pressable
            onPress={() => {
              haptic();
              createMutation.mutate();
            }}
            disabled={createMutation.isPending || !title.trim()}
            style={{
              borderRadius: 16,
              borderCurve: 'continuous',
              overflow: 'hidden',
              opacity: !title.trim() ? 0.5 : 1,
            }}
          >
            <LinearGradient
              colors={
                saved
                  ? [palette.success500, palette.success500]
                  : [palette.primary600, palette.primary500]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 16,
                gap: 8,
              }}
            >
              {saved && <Check size={18} color={palette.white} strokeWidth={2.5} />}
              <Text style={{ fontSize: 16, fontWeight: '700', color: palette.white }}>
                {saved
                  ? t('maintenance.taskAdded', { defaultValue: 'Task Added!' })
                  : createMutation.isPending
                    ? t('common.saving', { defaultValue: 'Saving...' })
                    : t('maintenance.addTask', { defaultValue: 'Add Task' })}
              </Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
