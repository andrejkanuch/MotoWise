import type { ExperienceLevel } from '@motolearn/types';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Bike, Check, Flame, Gauge } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  ZoomIn,
} from 'react-native-reanimated';
import { ProgressBar } from '../../components/progress-bar';
import { useOnboardingStore } from '../../stores/onboarding.store';

const EXPERIENCE_LEVELS = [
  {
    key: 'beginner',
    descKey: 'beginnerDesc',
    Icon: Bike,
    color: '#34D399',
    bgColor: 'rgba(52, 211, 153, 0.15)',
  },
  {
    key: 'intermediate',
    descKey: 'intermediateDesc',
    Icon: Gauge,
    color: '#60A5FA',
    bgColor: 'rgba(96, 165, 250, 0.15)',
  },
  {
    key: 'advanced',
    descKey: 'advancedDesc',
    Icon: Flame,
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.15)',
  },
] as const;

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const setExperienceLevel = useOnboardingStore((s) => s.setExperienceLevel);
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (key: string) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setSelected(key);
  };

  const handleContinue = () => {
    if (selected) {
      if (process.env.EXPO_OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setExperienceLevel(selected as ExperienceLevel);
    }
    router.push('/(onboarding)/select-bike');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <ProgressBar step={1} total={4} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.Text
          entering={FadeInDown.duration(600)}
          style={{
            fontSize: 36,
            fontWeight: '800',
            color: '#FFFFFF',
            letterSpacing: -0.5,
            marginBottom: 8,
          }}
        >
          {t('onboarding.welcomeTitle')}
        </Animated.Text>

        <Animated.Text
          entering={FadeInUp.delay(150).duration(500)}
          style={{
            fontSize: 17,
            color: 'rgba(255, 255, 255, 0.6)',
            lineHeight: 24,
            marginBottom: 40,
          }}
        >
          {t('onboarding.welcomeSubtitle')}
        </Animated.Text>

        <View style={{ gap: 16 }}>
          {EXPERIENCE_LEVELS.map((level, index) => {
            const isSelected = selected === level.key;
            const IconComponent = level.Icon;
            return (
              <Animated.View
                key={level.key}
                entering={FadeInUp.delay(250 + index * 100).duration(500).springify().damping(18)}
              >
                <Pressable
                  onPress={() => handleSelect(level.key)}
                  style={({ pressed }) => ({
                    backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                    borderWidth: isSelected ? 2 : 1,
                    borderColor: isSelected ? level.color : 'rgba(255, 255, 255, 0.08)',
                    borderRadius: 20,
                    borderCurve: 'continuous',
                    padding: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 16,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                    boxShadow: isSelected
                      ? `0 0 20px ${level.color}33`
                      : '0 1px 3px rgba(0, 0, 0, 0.2)',
                  })}
                >
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 16,
                      borderCurve: 'continuous',
                      backgroundColor: isSelected ? level.bgColor : 'rgba(255, 255, 255, 0.06)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <IconComponent
                      size={26}
                      strokeWidth={2}
                      color={isSelected ? level.color : 'rgba(255, 255, 255, 0.5)'}
                    />
                  </View>

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
                        color: 'rgba(255, 255, 255, 0.5)',
                        lineHeight: 20,
                      }}
                    >
                      {t(`onboarding.${level.descKey}`)}
                    </Text>
                  </View>

                  {isSelected && (
                    <Animated.View
                      entering={ZoomIn.duration(200).springify()}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: level.color,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Check size={14} strokeWidth={3} color="#FFFFFF" />
                    </Animated.View>
                  )}
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>

      <Animated.View
        entering={FadeIn.delay(600).duration(400)}
        style={{ paddingHorizontal: 24, paddingBottom: 48 }}
      >
        <Pressable
          onPress={handleContinue}
          disabled={!selected}
          style={({ pressed }) => ({
            backgroundColor: selected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.12)',
            borderRadius: 16,
            borderCurve: 'continuous',
            paddingVertical: 18,
            alignItems: 'center',
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
            boxShadow: selected ? '0 4px 12px rgba(255, 255, 255, 0.15)' : 'none',
          })}
        >
          <Text
            style={{
              fontSize: 17,
              fontWeight: '700',
              color: selected ? '#0F172A' : 'rgba(255, 255, 255, 0.3)',
            }}
          >
            {t('onboarding.continue')}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
