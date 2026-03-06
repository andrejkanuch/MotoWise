import { colors } from '@motolearn/design-system';
import type { ExperienceLevel } from '@motolearn/types';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { ProgressBar } from './progress-bar';

const EXPERIENCE_LEVELS = [
  { key: 'beginner', descKey: 'beginnerDesc' },
  { key: 'intermediate', descKey: 'intermediateDesc' },
  { key: 'advanced', descKey: 'advancedDesc' },
] as const;

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const setExperienceLevel = useOnboardingStore((s) => s.setExperienceLevel);
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (key: string) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelected(key);
  };

  const handleContinue = () => {
    if (selected) {
      setExperienceLevel(selected as ExperienceLevel);
    }
    router.push('/(onboarding)/select-bike');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.primary[950] }}>
      <ProgressBar step={1} total={4} />

      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 48 }}>
        <Animated.Text
          entering={FadeInDown.duration(500)}
          style={{
            fontSize: 34,
            fontWeight: '800',
            color: '#FFFFFF',
            marginBottom: 8,
          }}
        >
          {t('onboarding.welcomeTitle')}
        </Animated.Text>

        <Animated.Text
          entering={FadeInUp.delay(100).duration(500)}
          style={{
            fontSize: 17,
            color: 'rgba(255,255,255,0.7)',
            marginBottom: 40,
          }}
        >
          {t('onboarding.welcomeSubtitle')}
        </Animated.Text>

        <View style={{ gap: 12 }}>
          {EXPERIENCE_LEVELS.map((level, index) => {
            const isSelected = selected === level.key;
            return (
              <Animated.View
                key={level.key}
                entering={FadeInUp.delay(200 + index * 80).duration(400)}
              >
                <Pressable
                  onPress={() => handleSelect(level.key)}
                  style={({ pressed }) => ({
                    backgroundColor: isSelected
                      ? 'rgba(255,255,255,0.15)'
                      : 'rgba(255,255,255,0.06)',
                    borderWidth: 1.5,
                    borderColor: isSelected ? colors.primary[500] : 'rgba(255,255,255,0.1)',
                    borderRadius: 20,
                    borderCurve: 'continuous',
                    padding: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    transform: [{ scale: pressed ? 0.97 : isSelected ? 1.02 : 1 }],
                  })}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: '700',
                        color: '#FFFFFF',
                        marginBottom: 4,
                      }}
                    >
                      {t(`onboarding.${level.key}`)}
                    </Text>
                    <Text
                      style={{
                        fontSize: 14,
                        color: 'rgba(255,255,255,0.6)',
                      }}
                    >
                      {t(`onboarding.${level.descKey}`)}
                    </Text>
                  </View>
                  {isSelected && (
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        borderCurve: 'continuous',
                        backgroundColor: colors.primary[500],
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginLeft: 12,
                      }}
                    >
                      <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
                        {'✓'}
                      </Text>
                    </View>
                  )}
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      </View>

      <View style={{ paddingHorizontal: 24, paddingBottom: 48 }}>
        <Pressable
          onPress={handleContinue}
          disabled={!selected}
          style={({ pressed }) => ({
            backgroundColor: selected ? '#FFFFFF' : 'rgba(255,255,255,0.2)',
            borderRadius: 20,
            borderCurve: 'continuous',
            paddingVertical: 16,
            alignItems: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text
            style={{
              fontSize: 17,
              fontWeight: '700',
              color: selected ? colors.primary[950] : 'rgba(255,255,255,0.4)',
            }}
          >
            {t('onboarding.continue')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
