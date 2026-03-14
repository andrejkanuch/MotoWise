import { palette } from '@motovault/design-system';
import { MotorcycleType } from '@motovault/types';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Bike, Gauge, HelpCircle, MapPin, Mountain } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { OnboardingCard } from '../../components/onboarding/onboarding-card';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { TOTAL_SCREENS } from './_config';

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

  const selectedType = bikeData?.type ?? null;
  const wasAutoDetected = selectedType !== null;

  const handleSelect = (value: string) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const type = value as MotorcycleType;
    setBikeData({
      ...(bikeData as NonNullable<typeof bikeData>),
      type,
    });

    router.replace('/(onboarding)/bike-mileage');
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
                  wasAutoDetected && selectedType === option.value
                    ? t('onboarding.bikeTypeAutoDetected')
                    : undefined
                }
                color={option.color}
                selected={selectedType === option.value}
                onPress={handleSelect}
              />
            </Animated.View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
