import { palette } from '@motovault/design-system';
import { GenerateOnboardingInsightsDocument } from '@motovault/graphql';
import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { AlertCircle, BookOpen, Info, Users2, Wrench } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { gqlFetcher } from '../../lib/graphql-client';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { TOTAL_SCREENS } from './_config';

const TYPE_COLORS: Record<string, string> = {
  maintenance: ONBOARDING_COLORS.warning,
  learning: ONBOARDING_COLORS.accent,
  community: ONBOARDING_COLORS.success,
};

const ICON_MAP: Record<string, React.ComponentType<{ size: number; color: string }>> = {
  Wrench,
  BookOpen,
  Users: Users2,
  AlertCircle,
  Info,
};

function resolveLucideIcon(name: string) {
  return ICON_MAP[name] ?? Info;
}

function SkeletonCard({ index }: { index: number }) {
  const shimmer = useSharedValue(0.3);

  useEffect(() => {
    shimmer.value = withRepeat(withTiming(0.7, { duration: 800 }), -1, true);
  }, [shimmer]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: shimmer.value,
  }));

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 80).duration(300)}
      style={{
        backgroundColor: ONBOARDING_COLORS.cardBg,
        borderRadius: 16,
        borderCurve: 'continuous',
        padding: 20,
        gap: 12,
      }}
    >
      <Animated.View
        style={[
          {
            width: 40,
            height: 40,
            borderRadius: 12,
            borderCurve: 'continuous',
            backgroundColor: ONBOARDING_COLORS.cardBorder,
          },
          animatedStyle,
        ]}
      />
      <Animated.View
        style={[
          {
            width: '60%',
            height: 16,
            borderRadius: 8,
            backgroundColor: ONBOARDING_COLORS.cardBorder,
          },
          animatedStyle,
        ]}
      />
      <Animated.View
        style={[
          {
            width: '90%',
            height: 12,
            borderRadius: 6,
            backgroundColor: ONBOARDING_COLORS.cardBorderDefault,
          },
          animatedStyle,
        ]}
      />
    </Animated.View>
  );
}

export default function InsightsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { experienceLevel, bikeData, ridingFrequency, maintenanceStyle } = useOnboardingStore();
  const hasFired = useRef(false);
  const [timedOut, setTimedOut] = useState(false);

  const { mutate, data, isPending, isError } = useMutation({
    mutationFn: (input: {
      experienceLevel: string;
      bikeMake?: string;
      bikeModel?: string;
      bikeYear?: number;
      bikeType?: string;
      currentMileage?: number;
      ridingFrequency?: string;
      maintenanceStyle?: string;
    }) => gqlFetcher(GenerateOnboardingInsightsDocument, { input }),
    onError: (error) => {
      console.error('[Insights] AI insights generation failed:', error);
    },
  });

  const fireInsights = () => {
    mutate({
      experienceLevel: experienceLevel ?? 'beginner',
      bikeMake: bikeData?.make ?? undefined,
      bikeModel: bikeData?.model ?? undefined,
      bikeYear: bikeData?.year ?? undefined,
      bikeType: bikeData?.type ?? undefined,
      currentMileage: bikeData?.currentMileage ?? undefined,
      ridingFrequency: ridingFrequency ?? undefined,
      maintenanceStyle: maintenanceStyle ?? undefined,
    });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: fire once on mount only
  useEffect(() => {
    if (hasFired.current) return;
    hasFired.current = true;
    fireInsights();
  }, []);

  // 15-second timeout — show skip option if AI takes too long
  useEffect(() => {
    const timeout = setTimeout(() => setTimedOut(true), 15000);
    return () => clearTimeout(timeout);
  }, []);

  const insights = data?.generateOnboardingInsights;
  const showCards = insights && insights.length > 0;
  const showLoading = isPending && !showCards;
  const showError = isError && !showCards;

  const handleContinue = () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.replace('/(onboarding)/paywall');
  };

  const handleRetry = () => {
    hasFired.current = false;
    fireInsights();
  };

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={14} totalScreens={TOTAL_SCREENS} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 32,
          paddingBottom: insets.bottom + 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        {bikeData?.photoUri && (
          <Animated.View
            entering={FadeIn.duration(300)}
            style={{ alignItems: 'center', marginBottom: 20 }}
          >
            <Image
              source={{ uri: bikeData.photoUri }}
              style={{
                width: 120,
                height: 90,
                borderRadius: 16,
              }}
            />
          </Animated.View>
        )}

        <Animated.Text
          entering={FadeIn.duration(300)}
          style={{
            fontSize: 28,
            fontWeight: '800',
            color: ONBOARDING_COLORS.textPrimary,
            textAlign: 'center',
            marginBottom: 8,
          }}
        >
          {t('onboarding.insightsTitle')}
        </Animated.Text>

        <Animated.Text
          entering={FadeIn.delay(100).duration(300)}
          style={{
            fontSize: 16,
            color: ONBOARDING_COLORS.textSecondary,
            textAlign: 'center',
            marginBottom: 32,
          }}
        >
          {t('onboarding.insightsSubtitle')}
        </Animated.Text>

        {showLoading && (
          <View style={{ gap: 16 }}>
            {[0, 1, 2].map((i) => (
              <SkeletonCard key={i} index={i} />
            ))}
          </View>
        )}

        {showError && (
          <Animated.View
            entering={FadeIn.duration(300)}
            style={{
              alignItems: 'center',
              gap: 16,
              paddingVertical: 48,
            }}
          >
            <AlertCircle size={40} color={ONBOARDING_COLORS.textMuted} />
            <Text
              style={{
                fontSize: 16,
                color: ONBOARDING_COLORS.textSecondary,
                textAlign: 'center',
              }}
            >
              {t('onboarding.insightsError')}
            </Text>
            <Pressable
              onPress={handleRetry}
              style={{
                paddingHorizontal: 24,
                paddingVertical: 10,
                borderRadius: 12,
                borderCurve: 'continuous',
                backgroundColor: ONBOARDING_COLORS.cardBorder,
              }}
            >
              <Text style={{ color: ONBOARDING_COLORS.accent, fontSize: 16, fontWeight: '600' }}>
                {t('common.retry')}
              </Text>
            </Pressable>
          </Animated.View>
        )}

        {showCards && (
          <View style={{ gap: 16 }}>
            {insights.map((insight, index) => {
              const Icon = resolveLucideIcon(insight.icon);
              const accent = TYPE_COLORS[insight.type] ?? ONBOARDING_COLORS.accent;
              return (
                <Animated.View
                  // biome-ignore lint/suspicious/noArrayIndexKey: insight list from API, index needed for unique key
                  key={`${insight.type}-${index}`}
                  entering={FadeInUp.delay(index * 100).duration(300)}
                  style={{
                    backgroundColor: ONBOARDING_COLORS.cardBg,
                    borderRadius: 16,
                    borderCurve: 'continuous',
                    padding: 20,
                    borderLeftWidth: 3,
                    borderLeftColor: accent,
                    gap: 8,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        borderCurve: 'continuous',
                        backgroundColor: `${accent}20`,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon size={20} color={accent} />
                    </View>
                    <Text
                      style={{
                        fontSize: 17,
                        fontWeight: '700',
                        color: ONBOARDING_COLORS.textPrimary,
                        flex: 1,
                      }}
                    >
                      {insight.title}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 15,
                      color: ONBOARDING_COLORS.textSecondary,
                      lineHeight: 22,
                    }}
                  >
                    {insight.body}
                  </Text>
                </Animated.View>
              );
            })}
          </View>
        )}

        {/* Social proof */}
        <Animated.View
          entering={FadeIn.delay(400).duration(300)}
          style={{
            marginTop: 32,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Users2 size={16} color={ONBOARDING_COLORS.textMuted} />
          <Text style={{ fontSize: 14, color: ONBOARDING_COLORS.textMuted }}>
            {t('onboarding.insightsSocialProof')}
          </Text>
        </Animated.View>
      </ScrollView>

      {/* CTA Button */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 16,
          paddingTop: 16,
          backgroundColor: ONBOARDING_COLORS.background,
        }}
      >
        <Animated.View entering={FadeInUp.delay(500).duration(300)}>
          <Pressable
            onPress={handleContinue}
            disabled={isPending}
            style={({ pressed }) => ({
              backgroundColor: pressed ? palette.indigo500 : ONBOARDING_COLORS.accent,
              borderRadius: 16,
              borderCurve: 'continuous',
              paddingVertical: 16,
              alignItems: 'center',
              opacity: isPending ? 0.5 : 1,
            })}
          >
            <Text style={{ fontSize: 17, fontWeight: '700', color: ONBOARDING_COLORS.textPrimary }}>
              {t('onboarding.insightsCta')}
            </Text>
          </Pressable>

          {/* Skip option — appears after error or timeout */}
          {(showError || (timedOut && isPending)) && (
            <Pressable
              onPress={handleContinue}
              style={{ alignItems: 'center', paddingVertical: 12, marginTop: 4 }}
            >
              <Text style={{ fontSize: 14, color: ONBOARDING_COLORS.textMuted }}>
                {t('common.skip')}
              </Text>
            </Pressable>
          )}
        </Animated.View>
      </View>
    </View>
  );
}
