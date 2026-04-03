import { palette } from '@motovault/design-system';
import {
  CompleteMaintenanceTaskDocument,
  MaintenanceTasksByMotorcycleDocument,
} from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, DollarSign, Gauge, Wrench } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Switch, Text, TextInput, useColorScheme, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCurrency } from '../../../hooks/use-currency';
import { formatCurrencyInput } from '../../../lib/expense-constants';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { incrementTaskCount, maybeRequestReview } from '../../../lib/store-review';
import { triggerImpact, triggerNotification } from '../../../utils/haptics';

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
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const {
    taskId,
    motorcycleId,
    bikeName,
    currentMileage,
    mileageUnit = 'km',
  } = useLocalSearchParams<{
    taskId: string;
    motorcycleId: string;
    bikeName: string;
    currentMileage?: string;
    mileageUnit?: string;
  }>();

  const [scheduleNext, setScheduleNext] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [completedMileage, setCompletedMileage] = useState('');
  const [cost, setCost] = useState('');
  const { currency, symbol } = useCurrency();
  const mutatingRef = useRef(false);
  const buttonScale = useSharedValue(1);

  const buttonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

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
      triggerNotification(Haptics.NotificationFeedbackType.Success);
      setCompleted(true);
      buttonScale.value = withSequence(
        withSpring(1.08, { damping: 8, stiffness: 200 }),
        withSpring(1, { damping: 12, stiffness: 150 }),
      );

      incrementTaskCount();
      maybeRequestReview();

      setTimeout(() => router.back(), 800);
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
    <KeyboardAwareScrollView
      style={{
        flex: 1,
        backgroundColor: isDark ? palette.neutral900 : palette.neutral50,
      }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: insets.bottom + 16,
        flexGrow: 1,
      }}
    >
      <View style={{ flex: 1 }}>
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

        {/* Completion Details */}
        <Animated.View entering={FadeInDown.delay(50).duration(300)} style={{ marginBottom: 16 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: secondaryTextColor,
              marginBottom: 8,
              marginLeft: 4,
            }}
          >
            {t('maintenance.completionDetails', { defaultValue: 'Completion Details' })}
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
            {/* Odometer reading row */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 12,
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
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '500', color: textColor }}>
                  {t('maintenance.odometer', { defaultValue: 'Odometer' })}
                </Text>
                {currentMileage ? (
                  <Text style={{ fontSize: 12, color: secondaryTextColor, marginTop: 2 }}>
                    {t('maintenance.currentReading', {
                      defaultValue: `Current: ${Number(currentMileage).toLocaleString()} ${mileageUnit}`,
                      value: Number(currentMileage).toLocaleString(),
                      unit: mileageUnit,
                    })}
                  </Text>
                ) : null}
              </View>
              <TextInput
                value={completedMileage}
                onChangeText={(val) => setCompletedMileage(val.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="e.g. 15000"
                placeholderTextColor={palette.neutral400}
                textAlign="right"
                style={{
                  fontSize: 15,
                  fontWeight: '500',
                  color: textColor,
                  minWidth: 100,
                  paddingVertical: 4,
                }}
              />
              {completedMileage ? (
                <Text style={{ fontSize: 13, color: palette.neutral400 }}>{mileageUnit}</Text>
              ) : null}
            </View>

            {/* Separator */}
            <View
              style={{
                height: 0.5,
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                marginLeft: 60,
              }}
            />

            {/* Cost row */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 12,
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  borderCurve: 'continuous',
                  backgroundColor: isDark ? palette.warningBgDark : palette.warningBgLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <DollarSign size={16} color={palette.warning500} strokeWidth={2} />
              </View>
              <Text style={{ fontSize: 15, fontWeight: '500', color: textColor, flex: 1 }}>
                {t('maintenance.totalCost', { defaultValue: 'Cost' })}
              </Text>
              <Text style={{ fontSize: 15, fontWeight: '500', color: textColor }}>{symbol}</Text>
              <TextInput
                value={cost}
                onChangeText={(val) => setCost(formatCurrencyInput(val, currency))}
                keyboardType={currency === 'JPY' ? 'number-pad' : 'decimal-pad'}
                placeholder={currency === 'JPY' ? '0' : '0.00'}
                placeholderTextColor={palette.neutral400}
                textAlign="right"
                style={{
                  fontSize: 15,
                  fontWeight: '500',
                  color: textColor,
                  minWidth: 80,
                  paddingVertical: 4,
                }}
              />
            </View>
          </View>
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
                        defaultValue: humanizeInterval(task.intervalDays),
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

      <Animated.View entering={FadeIn.delay(200).duration(300)} style={{ marginTop: 32 }}>
        <Animated.View style={buttonAnimStyle}>
          <Pressable
            onPress={() => {
              if (mutatingRef.current) return;
              mutatingRef.current = true;
              triggerImpact();
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
              <Animated.View entering={ZoomIn.duration(200).springify()}>
                <Check size={20} color={palette.white} strokeWidth={2.5} />
              </Animated.View>
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
        </Animated.View>

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
    </KeyboardAwareScrollView>
  );
}
