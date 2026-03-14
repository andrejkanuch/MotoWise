import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { BookOpen, Sparkles } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useLearnOnboardingStore } from '../../stores/learn-onboarding.store';

interface LearnOnboardingCardProps {
  onBrowse: () => void;
  onGenerate: () => void;
}

export function LearnOnboardingCard({ onBrowse, onGenerate }: LearnOnboardingCardProps) {
  const { t } = useTranslation();
  const { dismissed, dismiss, incrementVisit } = useLearnOnboardingStore();
  const hasIncremented = useRef(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && !hasIncremented.current) {
      hasIncremented.current = true;
      incrementVisit();
    }
  }, [hydrated, incrementVisit]);

  if (!hydrated || dismissed) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      exiting={FadeOutUp.duration(200)}
      style={{ marginHorizontal: 20, marginTop: 16 }}
    >
      <View
        style={{
          backgroundColor: palette.primary50,
          borderRadius: 20,
          padding: 20,
          borderWidth: 1,
          borderColor: palette.primary100,
          borderCurve: 'continuous',
        }}
      >
        <Text
          style={{
            fontSize: 18,
            fontWeight: '700',
            color: palette.primary900,
            marginBottom: 6,
          }}
        >
          {t('learn.onboardingTitle', { defaultValue: 'Welcome to Learn' })}
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: palette.primary700,
            lineHeight: 20,
            marginBottom: 16,
          }}
        >
          {t('learn.onboardingSubtitle', {
            defaultValue:
              'Search our motorcycle knowledge base, browse by topic, or generate a new article with AI.',
          })}
        </Text>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              backgroundColor: palette.white,
              borderRadius: 12,
              paddingVertical: 12,
              borderWidth: 1,
              borderColor: palette.primary200,
              borderCurve: 'continuous',
            }}
            onPress={() => {
              if (process.env.EXPO_OS === 'ios') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              dismiss();
              onBrowse();
            }}
          >
            <BookOpen size={16} color={palette.primary600} strokeWidth={2} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: palette.primary700 }}>
              {t('learn.browseModules', { defaultValue: 'Browse Modules' })}
            </Text>
          </Pressable>

          <Pressable
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              backgroundColor: palette.primary500,
              borderRadius: 12,
              paddingVertical: 12,
              borderCurve: 'continuous',
            }}
            onPress={() => {
              if (process.env.EXPO_OS === 'ios') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              dismiss();
              onGenerate();
            }}
          >
            <Sparkles size={16} color={palette.white} strokeWidth={2} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: palette.white }}>
              {t('learn.generateArticle')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}
