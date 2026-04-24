import { palette } from '@motovault/design-system';
import type { MileageUnit } from '@motovault/types';
import { MotorcycleType } from '@motovault/types';
import * as Haptics from 'expo-haptics';
import { getLocales } from 'expo-localization';
import { useRouter } from 'expo-router';
import { Bike, ChevronRight, Gauge, HelpCircle, MapPin, Mountain } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { MileageSlider } from '../../components/onboarding/mileage-slider';
import { OnboardingCard } from '../../components/onboarding/onboarding-card';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { TOTAL_SCREENS } from '../../config/onboarding';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { useOnboardingStore } from '../../stores/onboarding.store';

const defaultUnit: MileageUnit = getLocales()[0]?.measurementSystem === 'metric' ? 'km' : 'mi';

const MOTORCYCLE_TYPE_OPTIONS = [
  {
    value: MotorcycleType.CRUISER,
    icon: Bike,
    labelKey: 'cruiser',
    color: ONBOARDING_COLORS.warning,
  },
  { value: MotorcycleType.SPORTBIKE, icon: Gauge, labelKey: 'sportbike', color: palette.danger500 },
  {
    value: MotorcycleType.STANDARD,
    icon: Bike,
    labelKey: 'standard',
    color: palette.moduleSuspension,
  },
  {
    value: MotorcycleType.TOURING,
    icon: MapPin,
    labelKey: 'touring',
    color: ONBOARDING_COLORS.success,
  },
  { value: MotorcycleType.DUAL_SPORT, icon: Mountain, labelKey: 'dual_sport', color: '#A78BFA' },
  { value: MotorcycleType.DIRT_BIKE, icon: Mountain, labelKey: 'dirt_bike', color: '#FB923C' },
  { value: MotorcycleType.SCOOTER, icon: Bike, labelKey: 'scooter', color: '#38BDF8' },
  { value: MotorcycleType.OTHER, icon: HelpCircle, labelKey: 'other', color: '#94A3B8' },
] as const;

export default function BikeTypeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const bikeData = useOnboardingStore((s) => s.bikeData);
  const setBikeData = useOnboardingStore((s) => s.setBikeData);

  const [selectedType, setSelectedType] = useState<MotorcycleType | null>(bikeData?.type ?? null);
  const [mileage, setMileage] = useState<number | null>(bikeData?.currentMileage ?? 5000);
  const [unit, setUnit] = useState<MileageUnit>(bikeData?.mileageUnit ?? defaultUnit);
  const wasAutoDetected = bikeData?.type !== null && bikeData?.type !== undefined;

  const handleSelectType = (value: string) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedType(value as MotorcycleType);
  };

  const handleContinue = () => {
    if (!selectedType) return;
    if (process.env.EXPO_OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setBikeData({
      ...(bikeData as NonNullable<typeof bikeData>),
      type: selectedType,
      currentMileage: mileage ?? 0,
      mileageUnit: unit,
    });
    trackEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, {
      step: 'bike_type',
      step_index: 5,
      bike_type: selectedType,
      current_mileage: mileage ?? 0,
      mileage_unit: unit,
    });
    router.replace('/(onboarding)/bike-photo');
  };

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={5} totalScreens={TOTAL_SCREENS} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.Text
          entering={FadeInDown.duration(300)}
          style={{
            fontSize: 28,
            fontWeight: '800',
            color: ONBOARDING_COLORS.textPrimary,
            letterSpacing: -0.5,
            marginBottom: 8,
          }}
        >
          {t('onboarding.bikeTypeTitle')}
        </Animated.Text>

        {wasAutoDetected && (
          <Animated.Text
            entering={FadeInUp.delay(100).duration(300)}
            style={{
              fontSize: 15,
              color: ONBOARDING_COLORS.textSecondary,
              marginBottom: 24,
            }}
          >
            {t('onboarding.bikeTypeAutoDetected')}
          </Animated.Text>
        )}

        {!wasAutoDetected && <View style={{ marginBottom: 24 }} />}

        <View style={{ gap: 10 }}>
          {MOTORCYCLE_TYPE_OPTIONS.map((option, index) => (
            <Animated.View
              key={option.value}
              entering={FadeInUp.delay(Math.min(index * 50, 400)).duration(300)}
            >
              <OnboardingCard
                value={option.value}
                icon={option.icon}
                label={t(`onboarding.type_${option.labelKey}`)}
                subtitle={
                  wasAutoDetected && bikeData?.type === option.value
                    ? t('onboarding.bikeTypeAutoDetected')
                    : undefined
                }
                color={option.color}
                selected={selectedType === option.value}
                onPress={handleSelectType}
              />
            </Animated.View>
          ))}
        </View>

        {/* Mileage section — merged from bike-mileage screen */}
        {selectedType && (
          <Animated.View entering={FadeInUp.delay(200).duration(300)} style={{ marginTop: 32 }}>
            <Text
              style={{
                fontSize: 20,
                fontWeight: '700',
                color: ONBOARDING_COLORS.textPrimary,
                marginBottom: 16,
              }}
            >
              {t('onboarding.bikeMileageTitle')}
            </Text>
            <MileageSlider
              value={mileage ?? 0}
              unit={unit}
              onValueChange={setMileage}
              onUnitChange={setUnit}
            />
          </Animated.View>
        )}
      </ScrollView>

      {selectedType && (
        <View style={{ paddingHorizontal: 24, paddingBottom: 48 }}>
          <Pressable
            onPress={handleContinue}
            style={({ pressed }) => ({
              backgroundColor: ONBOARDING_COLORS.textPrimary,
              borderRadius: 16,
              borderCurve: 'continuous',
              paddingVertical: 16,
              alignItems: 'center',
              opacity: pressed ? 0.85 : 1,
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
            })}
          >
            <Text
              style={{
                fontSize: 17,
                fontWeight: '700',
                color: ONBOARDING_COLORS.background,
              }}
            >
              {t('onboarding.continue')}
            </Text>
            <ChevronRight size={20} color={ONBOARDING_COLORS.background} />
          </Pressable>
        </View>
      )}
    </View>
  );
}
