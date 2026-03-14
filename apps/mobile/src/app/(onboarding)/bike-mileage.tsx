import type { MileageUnit } from '@motovault/types';
import * as Haptics from 'expo-haptics';
import { getLocales } from 'expo-localization';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { MileageSlider } from '../../components/onboarding/mileage-slider';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { TOTAL_SCREENS } from './_config';

const defaultUnit: MileageUnit = getLocales()[0]?.measurementSystem === 'metric' ? 'km' : 'mi';

export default function BikeMileageScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const bikeData = useOnboardingStore((s) => s.bikeData);
  const setBikeData = useOnboardingStore((s) => s.setBikeData);

  const [mileage, setMileage] = useState<number | null>(bikeData?.currentMileage ?? 5000);
  const [unit, setUnit] = useState<MileageUnit>(bikeData?.mileageUnit ?? defaultUnit);

  const handleContinue = () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    setBikeData({
      ...(bikeData as NonNullable<typeof bikeData>),
      currentMileage: mileage ?? 0,
      mileageUnit: unit,
    });

    router.replace('/(onboarding)/bike-photo');
  };

  const handleNotSure = () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setMileage(null);

    setBikeData({
      ...(bikeData as NonNullable<typeof bikeData>),
      currentMileage: 0,
      mileageUnit: unit,
    });

    router.replace('/(onboarding)/bike-photo');
  };

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={6} totalScreens={TOTAL_SCREENS} />

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
            marginBottom: 32,
          }}
        >
          {t('onboarding.bikeMileageTitle')}
        </Animated.Text>

        <Animated.View entering={FadeInUp.delay(150).duration(300)}>
          <MileageSlider
            value={mileage ?? 0}
            unit={unit}
            onValueChange={setMileage}
            onUnitChange={setUnit}
          />
        </Animated.View>
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingBottom: 48, gap: 12 }}>
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

        <Pressable
          onPress={handleNotSure}
          style={({ pressed }) => ({
            paddingVertical: 12,
            alignItems: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: '600',
              color: ONBOARDING_COLORS.textMuted,
              textDecorationLine: 'underline',
            }}
          >
            {t('onboarding.mileageNotSure')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
