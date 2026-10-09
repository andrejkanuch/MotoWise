import { withAlpha } from '@motovault/design-system';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowRight } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { ONBOARDING_HERO_COLORS } from '../../components/onboarding/onboarding-colors';
import { getResumeRoute, OB_ROUTE, OB_SCREEN } from '../../config/onboarding';
import { AnalyticsEvent } from '../../lib/analytics';
import { getStoredAnalyticsConsent } from '../../lib/analytics-consent';
import { getStoredFbclid, getStoredUtmProperties } from '../../lib/meta-attribution';
import { trackOnboardingEvent, trackOnboardingFlowEvent } from '../../lib/onboarding-analytics';
import { getOnboardingVariant } from '../../lib/onboarding-experiment';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { radius, space, type } from '../../theme/type';
import { triggerImpact } from '../../utils/haptics';

// Module-scoped: resume-after-kill must fire only ONCE per app launch — on the
// first mount of the welcome screen in a fresh JS runtime (a genuine cold start
// after the app was killed mid-onboarding). It must NOT fire when the user taps
// Back to return to welcome during a live session: `router.replace` then
// collapses the navigation stack to a single screen and Back stops working
// ("GO_BACK was not handled by any navigator"). A fresh launch resets this flag.
let resumeHandledThisLaunch = false;

/** The welcome hero is the one title set larger than `type.largeTitle`. */
const WELCOME_TITLE_SIZE = 52;

export default function WelcomeScreen() {
  // The hero is a photo under a dark veil in both schemes, so its text and
  // scrim use the dark tokens regardless of the system scheme.
  const oc = ONBOARDING_HERO_COLORS;
  const { t } = useTranslation();
  const router = useRouter();

  // Freeze the resume decision at mount. Reading the store imperatively keeps it
  // non-reactive, so later step screens writing `lastCompletedScreen` cannot
  // retrigger a resume on this already-mounted welcome screen.
  const [resume] = useState(() => {
    if (resumeHandledThisLaunch) return null;
    const { lastCompletedScreen: lastCompleted, bikeData } = useOnboardingStore.getState();
    if (!lastCompleted) return null;
    // Same bike-aware branch as forward nav so resume-after-kill lands on the
    // screen the rider would have reached, not a bike-dependent dead-end.
    const target = getResumeRoute(getOnboardingVariant(), lastCompleted, {
      hasBike: !!bikeData?.make,
    });
    return target ? { lastCompleted, target } : null;
  });

  // Preload stored attribution (fbclid + UTM) so `onboarding_started` can carry it
  // for funnel traceability of tagged/paid installs, without blocking navigation
  // on the async SecureStore reads (U4). identify() also merges UTM onto the person
  // separately — this only enriches the event.
  //
  // Consent-gated: fbclid is a Meta click identifier (personal data under GDPR), so
  // it is only attached once analytics consent is stored — never transmitted to
  // PostHog pre-consent, even though the (existing) onboarding_started event itself
  // fires regardless.
  const [attribution, setAttribution] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!getStoredAnalyticsConsent()) return;
    let active = true;
    void (async () => {
      const [utm, fbclid] = await Promise.all([getStoredUtmProperties(), getStoredFbclid()]);
      if (!active) return;
      setAttribution({ ...(utm ?? {}), ...(fbclid ? { fbclid } : {}) });
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    resumeHandledThisLaunch = true;
    if (resume) {
      trackOnboardingFlowEvent(AnalyticsEvent.ONBOARDING_RESUMED, {
        last_completed: resume.lastCompleted,
        resume_target: resume.target,
      });
      // `resumed` lets auto-advancing screens (personalizing) tell a cold-start
      // resume apart from the live flow: on resume they complete silently behind
      // the splash instead of replaying their staged animation on app load.
      router.replace({ pathname: resume.target, params: { resumed: '1' } });
    } else {
      trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_VIEWED, OB_SCREEN.WELCOME);
    }
  }, [resume, router]);

  const handleGetStarted = () => {
    triggerImpact(ImpactFeedbackStyle.Medium);
    trackOnboardingFlowEvent(AnalyticsEvent.ONBOARDING_STARTED, attribution);
    router.push(OB_ROUTE.EXPERIENCE);
  };

  // Returning riders can skip straight to sign-in instead of walking the flow.
  const handleLogIn = () => {
    triggerImpact(ImpactFeedbackStyle.Light);
    router.push(OB_ROUTE.SIGN_IN);
  };

  // Block welcome UI while resume is pending — prevents flash of hero/animations
  if (resume) {
    return <View style={{ flex: 1, backgroundColor: oc.background }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: oc.background }}>
      <StatusBar style="light" />
      {/* Hero image — full bleed (dark atmospheric motorcycle shot) */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: oc.background,
        }}
      >
        <Image
          source={require('../../assets/images/hero-rider.jpg')}
          style={{ width: '100%', height: '100%', opacity: 0.8 }}
          contentFit="cover"
          contentPosition="center"
        />
      </View>

      {/* Gradient veil — bottom-heavy dark overlay */}
      <LinearGradient
        colors={[
          withAlpha(oc.background, 0.4),
          withAlpha(oc.background, 0.1),
          withAlpha(oc.background, 0.8),
          oc.background,
        ]}
        locations={[0, 0.25, 0.7, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Content */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: space.xl,
          paddingTop: space.xxxl + space.lg,
          paddingBottom: space.xxxl,
          justifyContent: 'space-between',
        }}
      >
        {/* Brand mark */}
        <Animated.View
          entering={FadeIn.delay(200).duration(400)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: radius.chip,
              borderCurve: 'continuous',
              backgroundColor: oc.warm,
              overflow: 'hidden',
            }}
          >
            <Image
              source={require('../../assets/images/motovault-logo.webp')}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          </View>
          <Text style={[type.bodyStrong, { color: oc.textPrimary }]}>
            {/* Brand name — not localized */}
            {'MotoVault'}
          </Text>
        </Animated.View>

        {/* Bottom editorial copy */}
        <View>
          {/* Headline — "Your rides. / Your bike. / Your journey." */}
          <Animated.View entering={FadeInUp.delay(200).duration(300)}>
            <Text
              accessibilityRole="header"
              style={[
                type.largeTitle,
                {
                  fontSize: WELCOME_TITLE_SIZE,
                  lineHeight: WELCOME_TITLE_SIZE,
                  color: oc.textPrimary,
                  marginBottom: space.md,
                },
              ]}
            >
              {t('onboarding.v2WelcomeHeadline')}
            </Text>
          </Animated.View>

          {/* Subtitle */}
          <Animated.View entering={FadeInUp.delay(250).duration(300)}>
            <Text
              style={[
                type.body,
                { color: oc.textSecondary, maxWidth: 300, marginBottom: space.xxl },
              ]}
            >
              {t('onboarding.v2WelcomeSubtitle')}
            </Text>
          </Animated.View>

          {/* CTA button */}
          <Animated.View entering={FadeIn.delay(500).duration(300)}>
            <Pressable
              onPress={handleGetStarted}
              style={({ pressed }) => ({
                backgroundColor: oc.warm,
                borderRadius: radius.control,
                borderCurve: 'continuous',
                minHeight: 52,
                paddingHorizontal: space.lg,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: space.xs,
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              <Text style={[type.bodyStrong, { color: oc.textOnAccent }]}>
                {t('onboarding.v2WelcomeCta')}
              </Text>
              <ArrowRight size={18} color={oc.textOnAccent} />
            </Pressable>
          </Animated.View>

          {/* Secondary CTA — returning riders sign in directly */}
          <Animated.View entering={FadeIn.delay(650).duration(300)}>
            <Pressable
              onPress={handleLogIn}
              hitSlop={8}
              style={({ pressed }) => ({
                alignSelf: 'center',
                justifyContent: 'center',
                minHeight: 44,
                marginTop: space.xs,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={[type.bodyStrong, { color: oc.warm2 }]}>
                {t('onboarding.obAccountHaveAccount')}
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}
