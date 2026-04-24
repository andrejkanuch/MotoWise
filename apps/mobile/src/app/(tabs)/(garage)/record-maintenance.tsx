import { palette } from '@motovault/design-system';
import {
  CompleteMaintenanceTaskDocument,
  CreateMaintenanceTaskDocument,
  type MaintenancePriority,
} from '@motovault/graphql';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { NotificationFeedbackType } from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Calendar, Check, Gauge, Wrench } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useCurrency } from '../../../hooks/use-currency';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { useEditorialTheme } from '../../../theme/editorial';
import { triggerImpact, triggerNotification } from '../../../utils/haptics';

const SERVICE_TYPES = [
  { key: 'oil_change', label: 'Oil change', interval: 'Every 10,000 km', intervalKm: 10000 },
  { key: 'tyre_change', label: 'Tyre change', interval: 'Every ~15,000 km', intervalKm: 15000 },
  { key: 'chain_service', label: 'Chain service', interval: 'Every 500 km', intervalKm: 500 },
  { key: 'brake_pads', label: 'Brake pads', interval: 'Every 20,000 km', intervalKm: 20000 },
  { key: 'valve_check', label: 'Valve check', interval: 'Every 20,000 km', intervalKm: 20000 },
  { key: 'other', label: 'Other', interval: 'Describe\u2026', intervalKm: 0 },
] as const;

type ServiceKey = (typeof SERVICE_TYPES)[number]['key'];

export default function RecordMaintenanceScreen() {
  const { t } = useTranslation();
  const { motorcycleId, currentMileage, mileageUnit } = useLocalSearchParams<{
    motorcycleId: string;
    currentMileage?: string;
    mileageUnit?: string;
  }>();
  const { t: theme, isDark } = useEditorialTheme();
  const queryClient = useQueryClient();
  const { currency, symbol } = useCurrency();

  const unit = mileageUnit || 'km';

  const [serviceType, setServiceType] = useState<ServiceKey | null>(null);
  const [customDescription, setCustomDescription] = useState('');
  const [serviceDate, setServiceDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [odometerReading, setOdometerReading] = useState(currentMileage ?? '');
  const [cost, setCost] = useState('');
  const [isDiy, setIsDiy] = useState(false);
  const [saved, setSaved] = useState(false);

  const selectedType = SERVICE_TYPES.find((s) => s.key === serviceType);
  const parsedCost = Number.parseFloat(cost) || 0;
  const parsedOdometer = odometerReading ? Number.parseInt(odometerReading, 10) : 0;
  const nextReminderKm =
    selectedType && selectedType.intervalKm > 0 && parsedOdometer > 0
      ? parsedOdometer + selectedType.intervalKm
      : null;

  const isValid =
    serviceType != null && (serviceType !== 'other' || customDescription.trim().length > 0);

  const cardBg = theme.surface;
  const separatorColor = theme.line;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedType) throw new Error('No service type selected');

      const taskTitle = serviceType === 'other' ? customDescription.trim() : selectedType.label;

      // Step 1: Create the task
      const createResult = await gqlFetcher(CreateMaintenanceTaskDocument, {
        input: {
          motorcycleId,
          title: taskTitle,
          priority: 'medium' as MaintenancePriority,
          isRecurring: selectedType.intervalKm > 0,
          intervalKm: selectedType.intervalKm > 0 ? selectedType.intervalKm : undefined,
          targetMileage: nextReminderKm ?? undefined,
          description: isDiy ? 'DIY' : undefined,
        },
      });

      const taskId = createResult?.createMaintenanceTask?.id;
      if (!taskId) throw new Error('Failed to create task');

      // Step 2: Immediately complete it
      const completeResult = await gqlFetcher(CompleteMaintenanceTaskDocument, {
        id: taskId,
        input: {
          completedMileage: parsedOdometer > 0 ? parsedOdometer : undefined,
          cost: parsedCost > 0 ? parsedCost : undefined,
          currency: parsedCost > 0 ? currency : undefined,
        },
        createNextOccurrence: selectedType.intervalKm > 0,
      });

      return completeResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.maintenanceTasks.byMotorcycle(motorcycleId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceTasks.allUser });

      trackEvent(AnalyticsEvent.MAINTENANCE_TASK_COMPLETED, {
        service_type: serviceType,
        is_diy: isDiy,
        has_cost: parsedCost > 0,
      });

      setSaved(true);
      triggerNotification(NotificationFeedbackType.Success);
      setTimeout(() => router.back(), 600);
    },
    onError: () => {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('maintenance.recordFailed', {
          defaultValue: 'Failed to record maintenance. Please try again.',
        }),
      );
    },
  });

  return (
    <KeyboardAwareScrollView
      bottomOffset={20}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 24 }}
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
          — {t('maintenance.serviceLog', { defaultValue: 'SERVICE LOG' })}
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
            Record{' '}
          </Text>
          <Text
            style={{
              fontFamily: 'InstrumentSerif-Italic',
              fontSize: 32,
              color: theme.warm,
              letterSpacing: -0.6,
            }}
          >
            maintenance.
          </Text>
        </View>
      </View>

      {/* SERVICE TYPE */}
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
          {t('maintenance.serviceType', { defaultValue: 'SERVICE TYPE' })}
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
          {SERVICE_TYPES.map((type) => {
            const isSelected = serviceType === type.key;
            return (
              <Pressable
                key={type.key}
                onPress={() => {
                  triggerImpact();
                  setServiceType(type.key);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  gap: 12,
                  backgroundColor: isSelected
                    ? isDark
                      ? `${palette.warning500}12`
                      : `${palette.warning500}08`
                    : 'transparent',
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    borderWidth: isSelected ? 0 : 1.5,
                    borderColor: isDark ? palette.neutral600 : palette.neutral300,
                    backgroundColor: isSelected ? theme.warm : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isSelected && <Check size={13} color={palette.white} strokeWidth={3} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: isSelected ? '600' : '500',
                      color: isDark ? palette.neutral50 : palette.neutral950,
                    }}
                  >
                    {type.label}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 13,
                    color: isDark ? palette.neutral500 : palette.neutral400,
                  }}
                >
                  {type.interval}
                </Text>
              </Pressable>
            );
          })}

          {/* Custom description input for "Other" */}
          {serviceType === 'other' && (
            <View
              style={{
                borderTopWidth: 0.5,
                borderTopColor: separatorColor,
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
            >
              <TextInput
                value={customDescription}
                onChangeText={setCustomDescription}
                placeholder="Describe the service..."
                placeholderTextColor={palette.neutral400}
                autoFocus
                style={{
                  fontSize: 15,
                  color: isDark ? palette.neutral50 : palette.neutral950,
                  paddingVertical: 2,
                }}
              />
            </View>
          )}
        </View>
      </Animated.View>

      {/* WHEN — Date + Odometer */}
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
          {t('maintenance.when', { defaultValue: 'WHEN' })}
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
          {/* Service date row */}
          <Pressable
            onPress={() => {
              triggerImpact();
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
            <Text
              style={{
                fontSize: 15,
                fontWeight: '500',
                color: isDark ? palette.neutral50 : palette.neutral950,
                flex: 1,
              }}
            >
              {t('maintenance.serviceDate', { defaultValue: 'Service date' })}
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: palette.primary500,
                fontWeight: '600',
              }}
            >
              {serviceDate.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
          </Pressable>

          {/* Inline date picker */}
          {showDatePicker && (
            <View
              style={{
                borderTopWidth: 0.5,
                borderTopColor: separatorColor,
                paddingHorizontal: 8,
              }}
            >
              <DateTimePicker
                value={serviceDate}
                mode="date"
                display={process.env.EXPO_OS === 'ios' ? 'inline' : 'default'}
                maximumDate={new Date()}
                onChange={(event, selectedDate) => {
                  if (process.env.EXPO_OS === 'android') {
                    setShowDatePicker(false);
                  }
                  if (event.type === 'set' && selectedDate) {
                    setServiceDate(selectedDate);
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
                }}
              >
                <Pressable
                  onPress={() => {
                    triggerImpact();
                    setShowDatePicker(false);
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: palette.primary500,
                    }}
                  >
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
              backgroundColor: separatorColor,
              marginLeft: 60,
            }}
          />

          {/* Odometer reading row */}
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
              {t('maintenance.odometerReading', { defaultValue: 'Odometer reading' })}
            </Text>
            <TextInput
              value={odometerReading}
              onChangeText={(val) => setOdometerReading(val.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="e.g. 14520"
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
            {odometerReading ? (
              <Text style={{ fontSize: 13, color: palette.neutral400 }}>{unit}</Text>
            ) : null}
          </View>
        </View>
      </Animated.View>

      {/* COST */}
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
          {t('maintenance.cost', { defaultValue: 'COST' })}
        </Text>
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 14,
            borderCurve: 'continuous',
            overflow: 'hidden',
            boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12,
            gap: 10,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              color: isDark ? palette.neutral400 : palette.neutral500,
            }}
          >
            {symbol}
          </Text>
          <TextInput
            value={cost}
            onChangeText={setCost}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={palette.neutral400}
            style={{
              flex: 1,
              fontSize: 16,
              fontWeight: '500',
              color: isDark ? palette.neutral50 : palette.neutral950,
              paddingVertical: 4,
            }}
          />
          <Pressable
            onPress={() => {
              triggerImpact();
              setIsDiy(!isDiy);
            }}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 10,
              borderCurve: 'continuous',
              backgroundColor: isDiy
                ? isDark
                  ? `${palette.warning500}20`
                  : `${palette.warning500}14`
                : isDark
                  ? palette.neutral700
                  : palette.neutral100,
              borderWidth: isDiy ? 1.5 : 1,
              borderColor: isDiy ? theme.warm : isDark ? palette.neutral600 : palette.neutral200,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '700',
                color: isDiy ? theme.warm : isDark ? palette.neutral400 : palette.neutral500,
              }}
            >
              DIY
            </Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* NEXT REMINDER */}
      {nextReminderKm != null && (
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
            {t('maintenance.nextReminder', { defaultValue: 'NEXT REMINDER' })}
          </Text>
          <View
            style={{
              backgroundColor: cardBg,
              borderRadius: 14,
              borderCurve: 'continuous',
              overflow: 'hidden',
              boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
              paddingHorizontal: 16,
              paddingVertical: 14,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Wrench size={16} color={theme.warm} strokeWidth={2} />
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '600',
                  color: isDark ? palette.neutral50 : palette.neutral950,
                }}
              >
                {t('maintenance.remindAt', {
                  defaultValue: 'Remind me at {{km}} {{unit}}',
                  km: nextReminderKm.toLocaleString(),
                  unit,
                })}
              </Text>
            </View>
            <Text
              style={{
                fontSize: 13,
                color: isDark ? palette.neutral500 : palette.neutral400,
                marginTop: 4,
                marginLeft: 26,
              }}
            >
              {t('maintenance.basedOnInterval', {
                defaultValue: 'Based on typical {{type}} interval',
                type: selectedType?.label.toLowerCase(),
              })}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Cancel + Save buttons */}
      <Animated.View
        entering={FadeInDown.delay(175).duration(250)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}
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
            saveMutation.mutate();
          }}
          disabled={saveMutation.isPending || !isValid || saved}
          style={{
            flex: 1,
            paddingVertical: 16,
            borderRadius: 14,
            borderCurve: 'continuous',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: saved
              ? palette.success500
              : isValid
                ? theme.warm
                : isDark
                  ? palette.neutral700
                  : palette.neutral300,
          }}
        >
          {saved ? (
            <Check size={18} color={palette.white} strokeWidth={2.5} />
          ) : (
            <Wrench size={16} color={palette.white} strokeWidth={2.5} />
          )}
          <Text style={{ fontSize: 16, fontWeight: '700', color: palette.white }}>
            {saved
              ? t('maintenance.logged', { defaultValue: 'Logged!' })
              : saveMutation.isPending
                ? t('common.saving', { defaultValue: 'Saving...' })
                : t('maintenance.saveToLog', { defaultValue: 'Save to log' })}
          </Text>
        </Pressable>
      </Animated.View>
    </KeyboardAwareScrollView>
  );
}
