import { useQueryClient } from '@tanstack/react-query';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { router } from 'expo-router';
import { ChartNoAxesColumn } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnboardingColors } from '../components/onboarding/onboarding-colors';
import { AnalyticsEvent, setAnalyticsEnabled, trackEvent } from '../lib/analytics';
import type { AccountPrivacyPreference, ConsentDecision } from '../lib/analytics-consent';
import { saveConsentToAccount } from '../lib/consent-account-sync';
import { queryKeys } from '../lib/query-keys';
import { useAuthStore } from '../stores/auth.store';
import { radius, space, type } from '../theme/type';
import { triggerImpact } from '../utils/haptics';

/**
 * Analytics consent — shown once to riders in an opt-in region (EEA, UK,
 * Switzerland) who have not answered yet. The root layout presents it when the
 * rider leaves the onboarding welcome screen, or on launch for an existing
 * rider. Until it is answered nothing is sent to PostHog. See
 * lib/analytics-consent.ts.
 *
 * Both answers carry equal weight on purpose: refusing must be as easy as
 * accepting, so the two buttons share one style and neither is preselected.
 * Not dismissable without an answer: the iOS swipe is off in the root layout
 * (`gestureEnabled: false`) and the Android back button is swallowed here.
 *
 * A root route, not under (modals): (modals) only mounts for signed-in riders
 * who finished onboarding, and this must open during onboarding and sign-in.
 */

/** Where the consent was given, on `analytics_consent_granted`. */
const CONSENT_SURFACE = 'consent_screen';

type MeCache = { me?: { preferences?: { privacy?: AccountPrivacyPreference } | null } };

export default function AnalyticsConsentScreen() {
  const oc = useOnboardingColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const session = useAuthStore((s) => s.session);
  // One answer per presentation — a double tap must not apply two decisions.
  const answeredRef = useRef(false);

  // Android back would close the screen without an answer.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  /**
   * A signed-in rider's answer is saved to their account right away. A rider
   * who answers before signing in has it saved by the root layout once a
   * session exists (it uploads the device decision when the account has none).
   */
  const saveToAccount = (decision: ConsentDecision) => {
    if (!session) return;
    const current = queryClient.getQueryData<MeCache>(queryKeys.user.me)?.me?.preferences?.privacy;
    void saveConsentToAccount(decision, current).then((saved) => {
      if (saved) void queryClient.invalidateQueries({ queryKey: queryKeys.user.me });
    });
  };

  const answer = (enabled: boolean) => {
    if (answeredRef.current) return;
    answeredRef.current = true;
    triggerImpact(ImpactFeedbackStyle.Light);
    // One timestamp for both sides, so device and account compare equal later.
    const decision: ConsentDecision = { enabled, decidedAt: Date.now() };
    setAnalyticsEnabled(decision.enabled, decision.decidedAt);
    // Only an acceptance can be recorded — a refusal sends nothing, by design.
    if (enabled) trackEvent(AnalyticsEvent.ANALYTICS_CONSENT_GRANTED, { surface: CONSENT_SURFACE });
    saveToAccount(decision);
    if (router.canGoBack()) router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: oc.background }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: space.xl,
          paddingTop: insets.top + space.xxxl,
          paddingBottom: insets.bottom + space.xxl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(300)}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: radius.card,
              borderCurve: 'continuous',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: oc.surface2,
              marginBottom: space.xl,
            }}
          >
            <ChartNoAxesColumn size={26} color={oc.textPrimary} />
          </View>
          <Text accessibilityRole="header" style={[type.largeTitle, { color: oc.textPrimary }]}>
            {t('analyticsConsent.title')}
          </Text>
          <Text style={[type.body, { color: oc.textSecondary, marginTop: space.sm }]}>
            {t('analyticsConsent.body')}
          </Text>
          <View style={{ gap: space.xs, marginTop: space.lg }}>
            {(['pointWhat', 'pointNever', 'pointChange'] as const).map((key) => (
              <View key={key} style={{ flexDirection: 'row', gap: space.xs }}>
                <Text style={[type.body, { color: oc.textMuted }]}>•</Text>
                <Text style={[type.body, { flex: 1, color: oc.textSecondary }]}>
                  {t(`analyticsConsent.${key}`)}
                </Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInUp.delay(120).duration(300)}
          style={{ gap: space.sm, marginTop: space.xxxl }}
        >
          <ConsentButton label={t('analyticsConsent.allow')} onPress={() => answer(true)} />
          <ConsentButton label={t('analyticsConsent.decline')} onPress={() => answer(false)} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

/** One style for both answers — see the module comment. */
function ConsentButton({ label, onPress }: { label: string; onPress: () => void }) {
  const oc = useOnboardingColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        minHeight: 52,
        borderRadius: radius.control,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: oc.surface2,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text style={[type.bodyStrong, { color: oc.textPrimary }]}>{label}</Text>
    </Pressable>
  );
}
