import type { MaintenanceStyle } from '@motolearn/types';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Building2, HelpCircle, Wrench } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { OnboardingCard } from '../../components/onboarding/onboarding-card';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { TOTAL_SCREENS } from './_config';

const MAINTENANCE_OPTIONS: {
  value: MaintenanceStyle;
  icon: typeof Wrench;
  color: string;
}[] = [
  { value: 'diy', icon: Wrench, color: '#34D399' },
  { value: 'sometimes', icon: HelpCircle, color: '#60A5FA' },
  { value: 'mechanic', icon: Building2, color: '#A78BFA' },
];

export default function MaintenanceStyleScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const setMaintenanceStyle = useOnboardingStore((s) => s.setMaintenanceStyle);
  const existingStyle = useOnboardingStore((s) => s.maintenanceStyle);

  const [selected, setSelected] = useState<MaintenanceStyle | null>(existingStyle);

  const handlePress = (value: string) => {
    const style = value as MaintenanceStyle;
    setSelected(style);
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setMaintenanceStyle(style);
    setTimeout(() => {
      router.replace('/(onboarding)/repair-spending');
    }, 200);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <OnboardingProgress screenIndex={10} totalScreens={TOTAL_SCREENS} />

      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 48 }}>
        <Animated.Text
          entering={FadeInDown.duration(300)}
          style={{
            fontSize: 36,
            fontWeight: '800',
            color: '#FFFFFF',
            letterSpacing: -0.5,
            marginBottom: 32,
          }}
        >
          {t('onboarding.maintenanceStyleTitle')}
        </Animated.Text>

        <View style={{ gap: 10 }}>
          {MAINTENANCE_OPTIONS.map((option, index) => (
            <Animated.View key={option.value} entering={FadeInUp.delay(index * 50).duration(300)}>
              <OnboardingCard
                value={option.value}
                icon={option.icon}
                label={t(`onboarding.maintenanceStyle_${option.value}`)}
                subtitle={t(`onboarding.maintenanceStyleDesc_${option.value}`)}
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
