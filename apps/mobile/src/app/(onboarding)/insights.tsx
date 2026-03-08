import { GenerateOnboardingInsightsDocument } from '@motolearn/graphql';
import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import * as LucideIcons from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProgressBar } from '../../components/progress-bar';
import { gqlFetcher } from '../../lib/graphql-client';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { TOTAL_STEPS } from './config';

const TYPE_COLORS: Record<string, string> = {
  maintenance: '#F59E0B',
  learning: '#818CF8',
  community: '#34D399',
};

function resolveLucideIcon(name: string) {
  const Icon = (LucideIcons as Record<string, unknown>)[name] as
    | typeof LucideIcons.Info
    | undefined;
  return Icon ?? LucideIcons.Info;
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
        backgroundColor: 'rgba(255,255,255,0.06)',
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
            backgroundColor: 'rgba(255,255,255,0.1)',
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
            backgroundColor: 'rgba(255,255,255,0.1)',
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
            backgroundColor: 'rgba(255,255,255,0.08)',
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

  const insights = data?.generateOnboardingInsights;
  const showCards = insights && insights.length > 0;
  const showLoading = isPending && !showCards;
  const showError = isError && !showCards;

  const handleContinue = () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push('/(onboarding)/paywall');
  };

  const handleRetry = () => {
    hasFired.current = false;
    fireInsights();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <ProgressBar step={5} total={TOTAL_STEPS} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 32,
          paddingBottom: insets.bottom + 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.Text
          entering={FadeIn.duration(300)}
          style={{
            fontSize: 28,
            fontWeight: '800',
            color: '#FFFFFF',
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
            color: 'rgba(255,255,255,0.6)',
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
            <LucideIcons.AlertCircle size={40} color="rgba(255,255,255,0.4)" />
            <Text
              style={{
                fontSize: 16,
                color: 'rgba(255,255,255,0.6)',
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
                backgroundColor: 'rgba(255,255,255,0.1)',
              }}
            >
              <Text style={{ color: '#818CF8', fontSize: 16, fontWeight: '600' }}>
                {t('common.retry')}
              </Text>
            </Pressable>
          </Animated.View>
        )}

        {showCards && (
          <View style={{ gap: 16 }}>
            {insights.map((insight, index) => {
              const Icon = resolveLucideIcon(insight.icon);
              const accent = TYPE_COLORS[insight.type] ?? '#818CF8';
              return (
                <Animated.View
                  // biome-ignore lint/suspicious/noArrayIndexKey: insight list from API, index needed for unique key
                  key={`${insight.type}-${index}`}
                  entering={FadeInUp.delay(index * 100).duration(300)}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.06)',
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
                        color: '#FFFFFF',
                        flex: 1,
                      }}
                    >
                      {insight.title}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 15,
                      color: 'rgba(255,255,255,0.7)',
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
          <LucideIcons.Users size={16} color="rgba(255,255,255,0.4)" />
          <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
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
          backgroundColor: '#0F172A',
        }}
      >
        <Animated.View entering={FadeInUp.delay(500).duration(300)}>
          <Pressable
            onPress={handleContinue}
            disabled={showLoading}
            style={({ pressed }) => ({
              backgroundColor: pressed ? '#6366F1' : '#818CF8',
              borderRadius: 16,
              borderCurve: 'continuous',
              paddingVertical: 16,
              alignItems: 'center',
              opacity: showLoading ? 0.5 : 1,
            })}
          >
            <Text style={{ fontSize: 17, fontWeight: '700', color: '#FFFFFF' }}>
              {t('onboarding.insightsCta')}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}
