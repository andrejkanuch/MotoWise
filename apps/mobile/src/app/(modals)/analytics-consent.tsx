import { UpdateUserDocument } from '@motovault/graphql';
import { useQueryClient } from '@tanstack/react-query';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { router } from 'expo-router';
import { ChartNoAxesColumn } from 'lucide-react-native';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import {
  AnalyticsEvent,
  captureException,
  setAnalyticsEnabled,
  trackEvent,
} from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { useAuthStore } from '../../stores/auth.store';
import { triggerImpact } from '../../utils/haptics';

/**
 * Analytics consent — shown once to riders in an opt-in region (EEA, UK,
 * Switzerland) who have not answered yet. The root layout presents it when the
 * rider leaves the onboarding welcome screen, or on launch for an existing
 * rider. Until it is answered nothing is sent to PostHog. See
 * lib/analytics-consent.ts.
 *
 * Both answers carry equal weight on purpose: refusing must be as easy as
 * accepting, so the two buttons share one style and neither is preselected.
 * Not swipe-dismissable (registered with `gestureEnabled: false`) — closing it
 * without an answer would only bring it back on the next launch.
 */

/** Where the consent was given, on `analytics_consent_granted`. */
const CONSENT_SURFACE = 'consent_screen';

type PrivacyPreferences = { analyticsEnabled?: boolean; crashReportingEnabled?: boolean };
type MeCache = { me?: { preferences?: { privacy?: PrivacyPreferences } | null } };

export default function AnalyticsConsentScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const session = useAuthStore((s) => s.session);
  // One answer per presentation — a double tap must not apply two decisions.
  const answeredRef = useRef(false);

  /**
   * A signed-in rider's answer is saved to their account as well, because the
   * root layout re-applies the server preference on every `me` load and would
   * otherwise flip this device back. `preferences` merges one level deep on
   * the server, so the whole `privacy` object is sent.
   */
  const saveToAccount = (enabled: boolean) => {
    if (!session) return;
    const current = queryClient.getQueryData<MeCache>(queryKeys.user.me)?.me?.preferences?.privacy;
    const privacy = {
      analyticsEnabled: enabled,
      crashReportingEnabled: current?.crashReportingEnabled ?? true,
    };
    gqlFetcher(UpdateUserDocument, { input: { preferences: { privacy } } })
      .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.user.me }))
      .catch((e) => captureException(e, { source: 'analytics-consent.saveToAccount' }));
  };

  const answer = (enabled: boolean) => {
    if (answeredRef.current) return;
    answeredRef.current = true;
    triggerImpact(ImpactFeedbackStyle.Light);
    setAnalyticsEnabled(enabled);
    // Only an acceptance can be recorded — a refusal sends nothing, by design.
    if (enabled) trackEvent(AnalyticsEvent.ANALYTICS_CONSENT_GRANTED, { surface: CONSENT_SURFACE });
    saveToAccount(enabled);
    if (router.canGoBack()) router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingTop: insets.top + 48,
          paddingBottom: insets.bottom + 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(300)}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              borderCurve: 'continuous',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: ONBOARDING_COLORS.accentBg,
              marginBottom: 24,
            }}
          >
            <ChartNoAxesColumn size={26} color={ONBOARDING_COLORS.warm2} />
          </View>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: 'InstrumentSerif-Regular',
              fontSize: 34,
              lineHeight: 37,
              color: ONBOARDING_COLORS.textPrimary,
              letterSpacing: -0.7,
            }}
          >
            {t('analyticsConsent.title')}
          </Text>
          <Text
            style={{
              fontSize: 15,
              lineHeight: 22,
              color: ONBOARDING_COLORS.textSecondary,
              marginTop: 14,
            }}
          >
            {t('analyticsConsent.body')}
          </Text>
          <View style={{ gap: 10, marginTop: 20 }}>
            {(['pointWhat', 'pointNever', 'pointChange'] as const).map((key) => (
              <View key={key} style={{ flexDirection: 'row', gap: 10 }}>
                <Text style={{ fontSize: 15, lineHeight: 22, color: ONBOARDING_COLORS.warm2 }}>
                  •
                </Text>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 15,
                    lineHeight: 22,
                    color: ONBOARDING_COLORS.textSecondary,
                  }}
                >
                  {t(`analyticsConsent.${key}`)}
                </Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInUp.delay(120).duration(300)}
          style={{ gap: 12, marginTop: 36 }}
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
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        paddingVertical: 17,
        borderRadius: 16,
        borderCurve: 'continuous',
        alignItems: 'center',
        backgroundColor: ONBOARDING_COLORS.cardBg,
        borderWidth: 1,
        borderColor: ONBOARDING_COLORS.cardBorderDefault,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text style={{ fontSize: 16, fontWeight: '600', color: ONBOARDING_COLORS.textPrimary }}>
        {label}
      </Text>
    </Pressable>
  );
}
