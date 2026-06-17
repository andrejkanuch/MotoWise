import { palette } from '@motovault/design-system';
import { CreateFuelLogDocument, FuelLogsDocument } from '@motovault/graphql';
import { KM_PER_MILE, LITRES_PER_US_GALLON } from '@motovault/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, Droplets, Gauge, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { NativeToggle } from '../../../components/ui/native-toggle';
import { useCurrency } from '../../../hooks/use-currency';
import { useMeasurementSystem } from '../../../hooks/use-measurement-system';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { useEditorialTheme } from '../../../theme/editorial';
import { triggerImpact, triggerNotification } from '../../../utils/haptics';

/**
 * MOT-137: Fuel fill-up entry + history screen.
 *
 * The form stores everything in metric internally (km, litres) but accepts
 * input in the user's preferred units, converting before sending to the API.
 * The history list shows MPG (US) or L/100km based on the user's measurement
 * system.
 */

// P2-109: constants imported from @motovault/types

export default function AddFuelLogScreen() {
  const { t } = useTranslation();
  const { motorcycleId } = useLocalSearchParams<{ motorcycleId: string }>();
  const { isDark } = useEditorialTheme();
  const { currency, symbol } = useCurrency();
  const system = useMeasurementSystem();
  const queryClient = useQueryClient();

  // Display units derived from the user's preference
  const distanceUnit = system === 'imperial' ? 'mi' : 'km';
  const volumeUnit = system === 'imperial' ? 'gal' : 'L';

  const [odometer, setOdometer] = useState('');
  const [volume, setVolume] = useState('');
  const [cost, setCost] = useState('');
  const [isPartial, setIsPartial] = useState(false);
  const [saved, setSaved] = useState(false);

  const parsedOdometer = Number.parseFloat(odometer) || 0;
  const parsedVolume = Number.parseFloat(volume) || 0;
  const parsedCost = cost ? Number.parseFloat(cost) : undefined;

  // Convert to metric for the API
  const odometerKm = system === 'imperial' ? parsedOdometer * KM_PER_MILE : parsedOdometer;
  const fuelLitres = system === 'imperial' ? parsedVolume * LITRES_PER_US_GALLON : parsedVolume;

  const isValid = odometerKm > 0 && fuelLitres > 0;

  const bg = isDark ? palette.neutral950 : palette.neutral50;
  const cardBg = isDark ? palette.neutral800 : palette.white;
  const textColor = isDark ? palette.neutral50 : palette.neutral950;
  const mutedText = isDark ? palette.neutral400 : palette.neutral600;

  // History list
  const logsQuery = useQuery({
    queryKey: queryKeys.fuelLogs.byMotorcycle(motorcycleId),
    queryFn: () => gqlFetcher(FuelLogsDocument, { motorcycleId }),
    enabled: !!motorcycleId,
  });
  const logs = logsQuery.data?.fuelLogs ?? [];

  const createMutation = useMutation({
    mutationFn: () =>
      gqlFetcher(CreateFuelLogDocument, {
        input: {
          motorcycleId,
          odometerKm,
          fuelLitres,
          totalCost: parsedCost,
          currency,
          fuelType: 'regular',
          isPartial,
        },
      }),
    onSuccess: () => {
      trackEvent(AnalyticsEvent.FUEL_LOG_ADDED, {
        motorcycle_id: motorcycleId,
        volume_litres: fuelLitres,
        cost: parsedCost ?? null,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.fuelLogs.byMotorcycle(motorcycleId) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.expenses.byMotorcycle(motorcycleId),
      });
      setSaved(true);
      triggerNotification(Haptics.NotificationFeedbackType.Success);
      setOdometer('');
      setVolume('');
      setCost('');
      setIsPartial(false);
      setTimeout(() => setSaved(false), 1800);
    },
    onError: () => {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('fuel.createFailed', { defaultValue: 'Failed to save fill-up. Please try again.' }),
      );
    },
  });

  // Rolling average (last 10 non-partial entries with economy data)
  const rollingAverage = useMemo(() => {
    const withEconomy = logs.filter((l) => l.litresPer100Km != null).slice(0, 10);
    if (withEconomy.length === 0) return null;
    const total = withEconomy.reduce((sum, l) => sum + (l.litresPer100Km ?? 0), 0);
    const avgLPer100 = total / withEconomy.length;
    const avgMpg = withEconomy.reduce((s, l) => s + (l.mpgUs ?? 0), 0) / withEconomy.length;
    return { avgLPer100, avgMpg, count: withEconomy.length };
  }, [logs]);

  return (
    <KeyboardAwareScrollView
      bottomOffset={20}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16, backgroundColor: bg }}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View
        entering={FadeIn.duration(200)}
        style={{
          backgroundColor: cardBg,
          borderRadius: 14,
          borderCurve: 'continuous',
          padding: 16,
          gap: 14,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: '700', color: textColor }}>
          {t('fuel.newFillUp', { defaultValue: 'New fill-up' })}
        </Text>

        {/* Odometer */}
        <View>
          <Text style={{ fontSize: 13, fontWeight: '600', color: mutedText, marginBottom: 6 }}>
            {t('fuel.odometer', { defaultValue: 'Odometer' })} ({distanceUnit})
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Gauge size={18} color={palette.primary500} strokeWidth={2} />
            <TextInput
              value={odometer}
              onChangeText={(v) => setOdometer(v.replace(/[^0-9.]/g, ''))}
              placeholder={t('garage.fuelOdometerPlaceholder')}
              placeholderTextColor={palette.neutral400}
              keyboardType="decimal-pad"
              style={{
                flex: 1,
                fontSize: 18,
                fontWeight: '600',
                color: textColor,
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: isDark ? palette.neutral700 : palette.neutral200,
              }}
            />
          </View>
        </View>

        {/* Volume */}
        <View>
          <Text style={{ fontSize: 13, fontWeight: '600', color: mutedText, marginBottom: 6 }}>
            {t('fuel.volume', { defaultValue: 'Fuel' })} ({volumeUnit})
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Droplets size={18} color={palette.primary500} strokeWidth={2} />
            <TextInput
              value={volume}
              onChangeText={(v) => setVolume(v.replace(/[^0-9.]/g, ''))}
              placeholder={t('garage.fuelLitersPlaceholder')}
              placeholderTextColor={palette.neutral400}
              keyboardType="decimal-pad"
              style={{
                flex: 1,
                fontSize: 18,
                fontWeight: '600',
                color: textColor,
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: isDark ? palette.neutral700 : palette.neutral200,
              }}
            />
          </View>
        </View>

        {/* Cost */}
        <View>
          <Text style={{ fontSize: 13, fontWeight: '600', color: mutedText, marginBottom: 6 }}>
            {t('fuel.totalCost', { defaultValue: 'Total cost' })}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: textColor }}>{symbol}</Text>
            <TextInput
              value={cost}
              onChangeText={(v) => setCost(v.replace(/[^0-9.]/g, ''))}
              placeholder={t('garage.fuelCostPlaceholder')}
              placeholderTextColor={palette.neutral400}
              keyboardType="decimal-pad"
              style={{
                flex: 1,
                fontSize: 18,
                fontWeight: '600',
                color: textColor,
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: isDark ? palette.neutral700 : palette.neutral200,
              }}
            />
          </View>
        </View>

        {/* Partial fill toggle */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: textColor }}>
              {t('fuel.partialFill', { defaultValue: 'Partial fill' })}
            </Text>
            <Text style={{ fontSize: 12, color: mutedText, marginTop: 2 }}>
              {t('fuel.partialHelp', {
                defaultValue: "Skipped in economy calc. Enable if you didn't fill the tank.",
              })}
            </Text>
          </View>
          <NativeToggle
            value={isPartial}
            onValueChange={(v) => {
              triggerImpact();
              setIsPartial(v);
            }}
          />
        </View>

        <Pressable
          onPress={() => createMutation.mutate()}
          disabled={!isValid || createMutation.isPending}
          style={{
            backgroundColor: saved
              ? palette.success500
              : isValid
                ? palette.primary500
                : isDark
                  ? palette.neutral700
                  : palette.neutral300,
            borderRadius: 12,
            borderCurve: 'continuous',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 14,
            gap: 8,
          }}
        >
          {saved ? (
            <Check size={18} color={palette.white} strokeWidth={2.5} />
          ) : (
            <Plus size={18} color={palette.white} strokeWidth={2.5} />
          )}
          <Text style={{ fontSize: 15, fontWeight: '700', color: palette.white }}>
            {saved
              ? t('fuel.saved', { defaultValue: 'Saved!' })
              : createMutation.isPending
                ? t('common.saving', { defaultValue: 'Saving…' })
                : t('fuel.save', { defaultValue: 'Log fill-up' })}
          </Text>
        </Pressable>
      </Animated.View>

      {/* Rolling average */}
      {rollingAverage && (
        <Animated.View
          entering={FadeInDown.duration(250)}
          style={{
            backgroundColor: cardBg,
            borderRadius: 14,
            borderCurve: 'continuous',
            padding: 16,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <View>
            <Text style={{ fontSize: 12, color: mutedText, fontWeight: '600' }}>
              {t('fuel.rollingAverage', { defaultValue: 'Rolling average' })}
            </Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: textColor, marginTop: 2 }}>
              {system === 'imperial'
                ? `${rollingAverage.avgMpg.toFixed(1)} MPG`
                : `${rollingAverage.avgLPer100.toFixed(1)} L/100km`}
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: mutedText }}>
            {t('fuel.lastN', { defaultValue: 'Last {{n}} fills', n: rollingAverage.count })}
          </Text>
        </Animated.View>
      )}

      {/* History */}
      {logsQuery.isLoading && (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator color={palette.primary500} />
        </View>
      )}

      {!logsQuery.isLoading && logs.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: mutedText,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              marginLeft: 4,
            }}
          >
            {t('fuel.history', { defaultValue: 'History' })}
          </Text>
          {logs.map((log) => {
            const distanceDisplay =
              system === 'imperial' ? log.odometerKm / KM_PER_MILE : log.odometerKm;
            const volumeDisplay =
              system === 'imperial' ? log.fuelLitres / LITRES_PER_US_GALLON : log.fuelLitres;
            const economy =
              system === 'imperial' && log.mpgUs != null
                ? `${log.mpgUs.toFixed(1)} MPG`
                : log.litresPer100Km != null
                  ? `${log.litresPer100Km.toFixed(1)} L/100km`
                  : log.isPartial
                    ? t('fuel.partial', { defaultValue: 'Partial' })
                    : '—';

            return (
              <View
                key={log.id}
                style={{
                  backgroundColor: cardBg,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  padding: 14,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: textColor }}>
                    {volumeDisplay.toFixed(1)} {volumeUnit}
                    {log.totalCost != null ? ` · ${symbol}${log.totalCost.toFixed(2)}` : ''}
                  </Text>
                  <Text style={{ fontSize: 12, color: mutedText, marginTop: 2 }}>
                    {distanceDisplay.toFixed(0)} {distanceUnit} ·{' '}
                    {new Date(log.filledAt).toLocaleDateString()}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: palette.primary500 }}>
                    {economy}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {!logsQuery.isLoading && logs.length === 0 && (
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 14,
            borderCurve: 'continuous',
            padding: 32,
            alignItems: 'center',
          }}
        >
          <Droplets size={32} color={mutedText} strokeWidth={1.5} />
          <Text style={{ fontSize: 14, color: mutedText, marginTop: 10, textAlign: 'center' }}>
            {t('fuel.emptyState', {
              defaultValue: 'No fill-ups yet. Log your next fill to start tracking MPG.',
            })}
          </Text>
        </View>
      )}

      <Pressable
        onPress={() => router.back()}
        style={{
          paddingVertical: 14,
          alignItems: 'center',
        }}
      >
        <Text style={{ fontSize: 14, color: palette.primary500, fontWeight: '600' }}>
          {t('common.done', { defaultValue: 'Done' })}
        </Text>
      </Pressable>
    </KeyboardAwareScrollView>
  );
}
