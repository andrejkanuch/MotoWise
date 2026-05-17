import { palette } from '@motovault/design-system';
import { type Currency } from '@motovault/types';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { TOTAL_SCREENS } from '../../config/onboarding';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { CURRENCY_LIST } from '../../lib/currencies';
import { detectCurrency } from '../../lib/locale-detection';
import { useOnboardingStore } from '../../stores/onboarding.store';

export default function CurrencyScreen() {
  const router = useRouter();
  const setCurrency = useOnboardingStore((s) => s.setCurrency);
  const existingCurrency = useOnboardingStore((s) => s.currency);

  const [selected, setSelected] = useState<Currency>(() => existingCurrency ?? detectCurrency());

  const handleSelect = (code: Currency) => {
    setSelected(code);
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleContinue = () => {
    setCurrency(selected);
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    trackEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, {
      step: 'currency',
      step_index: 7,
      currency: selected,
    });
    router.replace('/(onboarding)/smart-maintenance');
  };

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={7} totalScreens={TOTAL_SCREENS} />

      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 48 }}>
        <Animated.Text
          entering={FadeInDown.duration(300)}
          style={{
            fontSize: 36,
            fontWeight: '800',
            color: ONBOARDING_COLORS.textPrimary,
            letterSpacing: -0.5,
            marginBottom: 8,
          }}
        >
          Your currency
        </Animated.Text>

        <Animated.Text
          entering={FadeInDown.delay(50).duration(300)}
          style={{
            fontSize: 16,
            color: ONBOARDING_COLORS.textSecondary,
            marginBottom: 24,
          }}
        >
          Used for expense tracking and cost display
        </Animated.Text>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 120 }}
        >
          {CURRENCY_LIST.map((item, index) => {
            const isSelected = selected === item.code;
            return (
              <Animated.View key={item.code} entering={FadeInUp.delay(index * 30).duration(250)}>
                <Pressable
                  onPress={() => handleSelect(item.code)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    borderRadius: 14,
                    borderCurve: 'continuous',
                    backgroundColor: isSelected
                      ? `${palette.primary500}18`
                      : pressed
                        ? `${palette.neutral500}10`
                        : 'transparent',
                    borderWidth: isSelected ? 1.5 : 1,
                    borderColor: isSelected ? palette.primary500 : `${palette.neutral500}30`,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  })}
                >
                  <Text
                    style={{
                      fontSize: 22,
                      fontWeight: '700',
                      width: 48,
                      color: ONBOARDING_COLORS.textPrimary,
                    }}
                  >
                    {item.symbol}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: '600',
                        color: ONBOARDING_COLORS.textPrimary,
                      }}
                    >
                      {item.code}
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: ONBOARDING_COLORS.textSecondary,
                        marginTop: 1,
                      }}
                    >
                      {item.name}
                    </Text>
                  </View>
                  {isSelected && <Check size={20} color={palette.primary500} strokeWidth={3} />}
                </Pressable>
              </Animated.View>
            );
          })}
        </ScrollView>
      </View>

      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 24,
          paddingBottom: 48,
          paddingTop: 16,
        }}
      >
        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => ({
            backgroundColor: palette.primary500,
            paddingVertical: 16,
            borderRadius: 14,
            borderCurve: 'continuous',
            alignItems: 'center',
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}
        >
          <Text style={{ fontSize: 17, fontWeight: '700', color: '#fff' }}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}
