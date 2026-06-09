import { ImpactFeedbackStyle } from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { getResumeRoute, OB_ROUTE, OB_SCREEN } from '../../config/onboarding';
import { AnalyticsEvent } from '../../lib/analytics';
import { trackOnboardingEvent, trackOnboardingFlowEvent } from '../../lib/onboarding-analytics';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { triggerImpact } from '../../utils/haptics';

// Module-scoped: resume-after-kill must fire only ONCE per app launch — on the
// first mount of the welcome screen in a fresh JS runtime (a genuine cold start
// after the app was killed mid-onboarding). It must NOT fire when the user taps
// Back to return to welcome during a live session: `router.replace` then
// collapses the navigation stack to a single screen and Back stops working
// ("GO_BACK was not handled by any navigator"). A fresh launch resets this flag.
let resumeHandledThisLaunch = false;

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  // Freeze the resume decision at mount. Reading the store imperatively keeps it
  // non-reactive, so later step screens writing `lastCompletedScreen` cannot
  // retrigger a resume on this already-mounted welcome screen.
  const [resume] = useState(() => {
    if (resumeHandledThisLaunch) return null;
    const lastCompleted = useOnboardingStore.getState().lastCompletedScreen;
    if (!lastCompleted) return null;
    const target = getResumeRoute(lastCompleted);
    return target ? { lastCompleted, target } : null;
  });

  useEffect(() => {
    resumeHandledThisLaunch = true;
    if (resume) {
      trackOnboardingFlowEvent(AnalyticsEvent.ONBOARDING_RESUMED, {
        last_completed: resume.lastCompleted,
        resume_target: resume.target,
      });
      router.replace(resume.target);
    } else {
      trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_VIEWED, OB_SCREEN.WELCOME);
    }
  }, [resume, router]);

  const handleGetStarted = () => {
    triggerImpact(ImpactFeedbackStyle.Medium);
    trackOnboardingFlowEvent(AnalyticsEvent.ONBOARDING_STARTED);
    router.push(OB_ROUTE.EXPERIENCE);
  };

  // Block welcome UI while resume is pending — prevents flash of hero/animations
  if (resume) {
    return <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      {/* Hero image — full bleed (dark atmospheric motorcycle shot) */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: ONBOARDING_COLORS.background,
        }}
      >
        <Image
          source={require('../../assets/images/onboarding-hero.webp')}
          style={{ width: '100%', height: '100%', opacity: 0.65 }}
          contentFit="cover"
          contentPosition="center"
        />
      </View>

      {/* Gradient veil — bottom-heavy dark overlay */}
      <LinearGradient
        colors={[
          `${ONBOARDING_COLORS.background}66`,
          `${ONBOARDING_COLORS.background}1A`,
          `${ONBOARDING_COLORS.background}CC`,
          ONBOARDING_COLORS.background,
        ]}
        locations={[0, 0.25, 0.7, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Content */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: 28,
          paddingTop: 60,
          paddingBottom: 40,
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
              borderRadius: 9,
              borderCurve: 'continuous',
              backgroundColor: ONBOARDING_COLORS.warm,
              overflow: 'hidden',
            }}
          >
            <Image
              source={require('../../assets/images/motovault-logo.webp')}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          </View>
          <Text
            style={{
              fontWeight: '600',
              letterSpacing: -0.3,
              color: ONBOARDING_COLORS.textWhite,
              fontSize: 15,
            }}
          >
            {/* Brand name — not localized */}
            {'MotoVault'}
          </Text>
        </Animated.View>

        {/* Bottom editorial copy */}
        <View>
          {/* Tagline */}
          <Animated.Text
            entering={FadeInUp.delay(100).duration(400)}
            style={{
              fontSize: 11,
              fontWeight: '600',
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: ONBOARDING_COLORS.warm2,
              marginBottom: 18,
            }}
          >
            {t('onboarding.v2WelcomeTagline')}
          </Animated.Text>

          {/* Headline — "Your rides. / Your bike. / Your journey." */}
          <Animated.View entering={FadeInUp.delay(200).duration(400)}>
            <Text
              style={{
                fontFamily: 'InstrumentSerif-Regular',
                fontSize: 56,
                lineHeight: 57,
                color: ONBOARDING_COLORS.textWhite,
                letterSpacing: -1.1,
                marginBottom: 18,
              }}
            >
              {t('onboarding.v2WelcomeHeadline1')}
              {'\n'}
              {t('onboarding.v2WelcomeHeadline2')}
              {'\n'}
              <Text
                style={{
                  fontFamily: 'InstrumentSerif-Italic',
                  color: ONBOARDING_COLORS.warm2,
                }}
              >
                {t('onboarding.v2WelcomeHeadline3')}
              </Text>
            </Text>
          </Animated.View>

          {/* Subtitle */}
          <Animated.View entering={FadeInUp.delay(300).duration(400)}>
            <Text
              style={{
                fontSize: 15,
                lineHeight: 22,
                color: ONBOARDING_COLORS.textWhite,
                opacity: 0.82,
                maxWidth: 280,
                marginBottom: 32,
              }}
            >
              {t('onboarding.v2WelcomeSubtitle')}
            </Text>
          </Animated.View>

          {/* CTA button */}
          <Animated.View entering={FadeIn.delay(500).duration(300)}>
            <Pressable
              onPress={handleGetStarted}
              style={({ pressed }) => ({
                backgroundColor: ONBOARDING_COLORS.warm,
                borderRadius: 16,
                borderCurve: 'continuous',
                paddingVertical: 18,
                paddingHorizontal: 22,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: ONBOARDING_COLORS.textOnAccent,
                  letterSpacing: -0.15,
                }}
              >
                {t('onboarding.v2WelcomeCta')}
              </Text>
              <ArrowRight size={18} color={ONBOARDING_COLORS.textOnAccent} />
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}
