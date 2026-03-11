import { palette } from '@motolearn/design-system';
import {
  CompleteMaintenanceTaskDocument,
  MaintenanceTasksByMotorcycleDocument,
} from '@motolearn/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Wrench } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Switch, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';

export default function CompleteTaskScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { taskId, motorcycleId, bikeName } = useLocalSearchParams<{
    taskId: string;
    motorcycleId: string;
    bikeName: string;
  }>();

  const [scheduleNext, setScheduleNext] = useState(true);
  const [completed, setCompleted] = useState(false);
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
        createNextOccurrence: task?.isRecurring ? scheduleNext : false,
      }),
    onSuccess: () => {
      if (process.env.EXPO_OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setCompleted(true);
      setTimeout(() => router.back(), 500);
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.maintenanceTasks.byMotorcycle(motorcycleId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.maintenanceTasks.allUser,
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

  const textColor = isDark ? palette.neutral50 : palette.neutral950;
  const secondaryTextColor = isDark ? palette.neutral400 : palette.neutral500;
  const cardBg = isDark ? palette.neutral800 : palette.white;

  if (!task) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isDark ? palette.neutral900 : palette.neutral50,
        }}
      >
        <Text style={{ color: secondaryTextColor, fontSize: 15 }}>
          {t('maintenance.taskNotFound', { defaultValue: 'Task not found' })}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: isDark ? palette.neutral900 : palette.neutral50,
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: insets.bottom + 16,
        justifyContent: 'space-between',
      }}
    >
      <View>
        <Animated.View
          entering={FadeInUp.duration(300)}
          style={{ alignItems: 'center', marginBottom: 32 }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              borderCurve: 'continuous',
              backgroundColor: `${palette.success500}18`,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Wrench size={28} color={palette.success500} strokeWidth={1.5} />
          </View>
          <Text
            style={{
              fontSize: 20,
              fontWeight: '700',
              color: textColor,
              textAlign: 'center',
              marginBottom: 6,
            }}
          >
            {task.title}
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: secondaryTextColor,
              textAlign: 'center',
            }}
          >
            {bikeName}
          </Text>
        </Animated.View>

        {task.isRecurring && (
          <Animated.View entering={FadeInUp.delay(100).duration(300)}>
            <View
              style={{
                backgroundColor: cardBg,
                borderRadius: 14,
                borderCurve: 'continuous',
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '600',
                    color: textColor,
                    marginBottom: 2,
                  }}
                >
                  {t('maintenance.scheduleNext', {
                    defaultValue: 'Schedule next',
                  })}
                </Text>
                <Text style={{ fontSize: 13, color: secondaryTextColor }}>
                  {task.intervalDays
                    ? t('maintenance.scheduleNextDays', {
                        defaultValue: 'In {{count}} days',
                        count: task.intervalDays,
                      })
                    : task.intervalKm
                      ? t('maintenance.scheduleNextKm', {
                          defaultValue: 'In {{count}} km',
                          count: task.intervalKm,
                        })
                      : t('maintenance.scheduleNextAuto', {
                          defaultValue: 'Auto-calculated',
                        })}
                </Text>
              </View>
              <Switch
                value={scheduleNext}
                onValueChange={setScheduleNext}
                trackColor={{
                  false: isDark ? palette.neutral700 : palette.neutral200,
                  true: palette.success500,
                }}
              />
            </View>
          </Animated.View>
        )}
      </View>

      <Animated.View entering={FadeIn.delay(200).duration(300)}>
        <Pressable
          onPress={() => {
            if (mutatingRef.current) return;
            mutatingRef.current = true;
            completeMutation.mutate();
          }}
          disabled={completeMutation.isPending || completed}
          style={{
            backgroundColor: completed ? palette.success500 : palette.primary500,
            borderRadius: 14,
            borderCurve: 'continuous',
            paddingVertical: 16,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
            opacity: completeMutation.isPending ? 0.7 : 1,
          }}
        >
          {completed ? (
            <Check size={20} color={palette.white} strokeWidth={2.5} />
          ) : (
            <Check size={20} color={palette.white} strokeWidth={2} />
          )}
          <Text style={{ fontSize: 17, fontWeight: '700', color: palette.white }}>
            {completed
              ? t('maintenance.completed', { defaultValue: 'Completed!' })
              : completeMutation.isPending
                ? t('maintenance.completing', { defaultValue: 'Completing...' })
                : t('maintenance.markComplete', {
                    defaultValue: 'Mark as Complete',
                  })}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.back()}
          disabled={completeMutation.isPending || completed}
          style={{
            paddingVertical: 14,
            alignItems: 'center',
            marginTop: 8,
          }}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: '500',
              color: secondaryTextColor,
            }}
          >
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
