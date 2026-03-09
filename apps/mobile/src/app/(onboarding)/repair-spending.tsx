import type { AnnualRepairSpend } from '@motolearn/types';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { DollarSign, HelpCircle } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { OnboardingCard } from '../../components/onboarding/onboarding-card';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { TOTAL_SCREENS } from './config';

const SPEND_OPTIONS: {
  value: AnnualRepairSpend;
  icon: typeof DollarSign;
  color: string;
}[] = [
  { value: 'under_200', icon: DollarSign, color: '#34D399' },
  { value: '200_500', icon: DollarSign, color: '#60A5FA' },
  { value: '500_1000', icon: DollarSign, color: '#A78BFA' },
  { value: '1000_plus', icon: DollarSign, color: '#F59E0B' },
  { value: 'unsure', icon: HelpCircle, color: '#94A3B8' },
];

export default function RepairSpendingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const setAnnualRepairSpend = useOnboardingStore((s) => s.setAnnualRepairSpend);
  const existingSpend = useOnboardingStore((s) => s.annualRepairSpend);

  const [selected, setSelected] = useState<AnnualRepairSpend | null>(existingSpend);

  const handlePress = (value: string) => {
    const spend = value as AnnualRepairSpend;
    setSelected(spend);
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setAnnualRepairSpend(spend);
    setTimeout(() => {
      router.replace('/(onboarding)/learning-preferences');
    }, 200);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <OnboardingProgress screenIndex={11} totalScreens={TOTAL_SCREENS} />

      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 48 }}>
        <Animated.Text
          entering={FadeInDown.duration(300)}
          style={{
            fontSize: 36,
            fontWeight: '800',
            color: '#FFFFFF',
            letterSpacing: -0.5,
            marginBottom: 8,
          }}
        >
          {t('onboarding.repairSpendingTitle')}
        </Animated.Text>

        <Animated.Text
          entering={FadeInUp.delay(100).duration(300)}
          style={{
            fontSize: 17,
            color: 'rgba(255,255,255,0.6)',
            lineHeight: 24,
            marginBottom: 32,
          }}
        >
          {t('onboarding.repairSpendingSubtitle')}
        </Animated.Text>

        <View style={{ gap: 10 }}>
          {SPEND_OPTIONS.map((option, index) => (
            <Animated.View key={option.value} entering={FadeInUp.delay(index * 50).duration(300)}>
              <OnboardingCard
                value={option.value}
                icon={option.icon}
                label={t(`onboarding.repairSpend_${option.value}`)}
                color={option.color}
                selected={selected === option.value}
                onPress={handlePress}
              />
            </Animated.View>
          ))}
        </View>
      </View>
    </View>
  );
}
