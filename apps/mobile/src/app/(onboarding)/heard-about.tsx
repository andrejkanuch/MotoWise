import { NotificationFeedbackType } from 'expo-haptics';
import {
  Globe,
  HelpCircle,
  Instagram,
  MoreHorizontal,
  Music2,
  Newspaper,
  Search,
  Sparkles,
  Users,
  Youtube,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { OB_SCREEN } from '../../config/onboarding';
import { useOnboardingNext, useOnboardingStep } from '../../hooks/use-onboarding-flow';
import { AnalyticsEvent, setUserPropertiesOnce } from '../../lib/analytics';
import { trackOnboardingEvent } from '../../lib/onboarding-analytics';
import { setSelfReportedSource } from '../../lib/subscription';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { triggerNotification } from '../../utils/haptics';

/**
 * Acquisition-channel options. `id` is the raw value sent to analytics / RevenueCat
 * (never displayed); `labelKey` resolves to localized copy. Order is fixed (not
 * randomized) — at this volume self-report is directional, and `app_store_search`
 * + `dont_remember` are included to soften forced-attribution bias.
 */
const HEARD_ABOUT_OPTIONS = [
  { id: 'tiktok', labelKey: 'heardAboutTiktok', icon: Music2 },
  { id: 'instagram', labelKey: 'heardAboutInstagram', icon: Instagram },
  { id: 'youtube', labelKey: 'heardAboutYoutube', icon: Youtube },
  { id: 'friend', labelKey: 'heardAboutFriend', icon: Users },
  { id: 'app_store_search', labelKey: 'heardAboutAppStore', icon: Search },
  { id: 'google_search', labelKey: 'heardAboutGoogle', icon: Globe },
  // Web→app cohort self-report (P2/T5) — the MotoVault site/blog is now a
  // meaningful acquisition source distinct from a generic Google search.
  { id: 'website', labelKey: 'heardAboutWebsite', icon: Newspaper },
  { id: 'ai_chat', labelKey: 'heardAboutAi', icon: Sparkles },
  { id: 'dont_remember', labelKey: 'heardAboutDontRemember', icon: HelpCircle },
  { id: 'other', labelKey: 'heardAboutOther', icon: MoreHorizontal },
] as const;

const ADVANCE_DELAY_MS = 600;

export default function HeardAboutScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { stepIndex, totalScreens } = useOnboardingStep(OB_SCREEN.HEARD_ABOUT);
  const goNext = useOnboardingNext(OB_SCREEN.HEARD_ABOUT);
  const setHeardFrom = useOnboardingStore((s) => s.setHeardFrom);
  const setLastCompletedScreen = useOnboardingStore((s) => s.setLastCompletedScreen);

  const [pending, setPending] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Synchronous one-shot guard: `pending` is React state read from the render
  // closure, so two taps in the same frame (option+option, or option+skip) would
  // both see it null and double-fire. A ref settles immediately.
  const advancedRef = useRef(false);

  useEffect(() => {
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_VIEWED, OB_SCREEN.HEARD_ABOUT);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleSelect = (id: string) => {
    if (advancedRef.current) return;
    advancedRef.current = true;
    triggerNotification(NotificationFeedbackType.Success);
    setPending(id);
    setHeardFrom(id);
    setLastCompletedScreen(OB_SCREEN.HEARD_ABOUT);
    trackOnboardingEvent(AnalyticsEvent.REFERRAL_SOURCE_SELECTED, OB_SCREEN.HEARD_ABOUT, {
      referral_source: id,
    });
    // Fire-and-forget — do not block navigation on these writes (KTD-10/KTD-2).
    setUserPropertiesOnce({ heard_from: id });
    void setSelfReportedSource(id);
    timerRef.current = setTimeout(goNext, ADVANCE_DELAY_MS);
  };

  // Skip advances without recording a source — `heard_from` stays unset (KTD-10),
  // but we DO emit a skip event so the skip rate is measurable (MOT-272). A high
  // skip rate signals the screen's placement may need to move earlier.
  const handleSkip = () => {
    if (advancedRef.current) return;
    advancedRef.current = true;
    setLastCompletedScreen(OB_SCREEN.HEARD_ABOUT);
    trackOnboardingEvent(AnalyticsEvent.REFERRAL_SOURCE_SKIPPED, OB_SCREEN.HEARD_ABOUT);
    goNext();
  };

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={stepIndex} totalScreens={totalScreens} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 72,
          paddingBottom: insets.bottom + 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(300)}>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: 'InstrumentSerif-Regular',
              fontSize: 34,
              lineHeight: 36,
              color: ONBOARDING_COLORS.textPrimary,
              letterSpacing: -0.7,
            }}
          >
            {t('onboarding.heardAboutTitle')}{' '}
            <Text style={{ fontFamily: 'InstrumentSerif-Italic', color: ONBOARDING_COLORS.warm2 }}>
              {t('onboarding.heardAboutTitleItalic')}
            </Text>
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: ONBOARDING_COLORS.textSecondary,
              lineHeight: 20,
              marginTop: 10,
              maxWidth: 320,
            }}
          >
            {t('onboarding.heardAboutSubtitle')}
          </Text>
        </Animated.View>

        <View style={{ gap: 10, marginTop: 24 }}>
          {HEARD_ABOUT_OPTIONS.map((option, index) => {
            const Icon = option.icon;
            const active = pending === option.id;
            const dimmed = pending !== null && !active;
            return (
              <Animated.View
                key={option.id}
                entering={FadeInUp.delay(index * 50).duration(300)}
                style={{ opacity: dimmed ? 0.4 : 1 }}
              >
                <Pressable
                  onPress={() => handleSelect(option.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={t(`onboarding.${option.labelKey}`)}
                  accessibilityHint={t('onboarding.heardAboutHint')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                    padding: 14,
                    borderRadius: 16,
                    borderCurve: 'continuous',
                    backgroundColor: active ? ONBOARDING_COLORS.accentBg : ONBOARDING_COLORS.cardBg,
                    borderWidth: active ? 2 : 1,
                    borderColor: active
                      ? ONBOARDING_COLORS.warm
                      : ONBOARDING_COLORS.cardBorderDefault,
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 13,
                      borderCurve: 'continuous',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: active ? ONBOARDING_COLORS.warm : ONBOARDING_COLORS.surface2,
                    }}
                  >
                    <Icon
                      size={21}
                      color={active ? ONBOARDING_COLORS.textOnAccent : ONBOARDING_COLORS.warm2}
                    />
                  </View>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 15.5,
                      fontWeight: '600',
                      color: ONBOARDING_COLORS.textPrimary,
                    }}
                  >
                    {t(`onboarding.${option.labelKey}`)}
                  </Text>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        <Pressable
          onPress={handleSkip}
          accessibilityRole="button"
          style={{ paddingVertical: 18, alignItems: 'center', marginTop: 8 }}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: '600',
              color: ONBOARDING_COLORS.textSecondary,
            }}
          >
            {t('onboarding.heardAboutSkip')}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
