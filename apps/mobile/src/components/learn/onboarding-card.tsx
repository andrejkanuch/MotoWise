import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { BookOpen, Sparkles } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useLearnOnboardingStore } from '../../stores/learn-onboarding.store';

interface LearnOnboardingCardProps {
  onBrowse: () => void;
  onGenerate: () => void;
}

export function LearnOnboardingCard({ onBrowse, onGenerate }: LearnOnboardingCardProps) {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const { dismissed, dismiss, incrementVisit } = useLearnOnboardingStore();
  const [hydrated, setHydrated] = useState(false);
  const hasIncremented = useRef(false);

  // Wait for zustand hydration
  useEffect(() => {
    const unsub = useLearnOnboardingStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    // If already hydrated
    if (useLearnOnboardingStore.persist.hasHydrated()) {
      setHydrated(true);
    }
    return unsub;
  }, []);

  // Increment visit count once per session
  useEffect(() => {
    if (hydrated && !hasIncremented.current) {
      hasIncremented.current = true;
      incrementVisit();
    }
  }, [hydrated, incrementVisit]);

  if (!hydrated || dismissed) return null;

  const haptic = () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(400)}
      exiting={FadeOutUp.duration(300)}
      style={{
        marginHorizontal: 20,
        marginTop: 16,
        backgroundColor: isDark ? palette.neutral800 : palette.white,
        borderRadius: 20,
        borderCurve: 'continuous',
        padding: 20,
        boxShadow: isDark ? 'none' : '0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      {/* Dismiss button */}
      <Pressable
        onPress={() => {
          haptic();
          dismiss();
        }}
        hitSlop={12}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          width: 28,
          height: 28,
          borderRadius: 14,
          borderCurve: 'continuous',
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : palette.neutral100,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: isDark ? palette.neutral400 : palette.neutral500,
          }}
        >
          {'\u2715'}
        </Text>
      </Pressable>

      <Text
        style={{
          fontSize: 20,
          fontWeight: '700',
          color: isDark ? palette.neutral50 : palette.neutral950,
          marginBottom: 6,
        }}
      >
        {t('learn.onboardingTitle', { defaultValue: 'Welcome to Learn' })}
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: isDark ? palette.neutral400 : palette.neutral500,
          lineHeight: 20,
          marginBottom: 16,
          paddingRight: 20,
        }}
      >
        {t('learn.onboardingSubtitle', {
          defaultValue:
            'Search for topics, browse modules, or generate custom articles tailored to your bike.',
        })}
      </Text>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable
          onPress={() => {
            haptic();
            onBrowse();
          }}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 12,
            borderRadius: 14,
            borderCurve: 'continuous',
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : palette.neutral100,
          }}
        >
          <BookOpen
            size={16}
            color={isDark ? palette.neutral200 : palette.neutral700}
            strokeWidth={2}
          />
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: isDark ? palette.neutral200 : palette.neutral700,
            }}
          >
            {t('learn.browseModules', { defaultValue: 'Browse Modules' })}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            haptic();
            onGenerate();
          }}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 12,
            borderRadius: 14,
            borderCurve: 'continuous',
            backgroundColor: isDark ? palette.primary700 : palette.primary500,
          }}
        >
          <Sparkles size={16} color={palette.white} strokeWidth={2} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: palette.white }}>
            {t('learn.generateArticle', { defaultValue: 'Generate Article' })}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
