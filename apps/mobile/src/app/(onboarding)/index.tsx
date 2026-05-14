import { ImpactFeedbackStyle } from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OB_ROUTE } from '../../config/onboarding';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { triggerImpact } from '../../utils/haptics';

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  useEffect(() => {
    trackEvent(AnalyticsEvent.ONBOARDING_STEP_VIEWED, { step: 'welcome' });
  }, []);

  const handleGetStarted = () => {
    triggerImpact(ImpactFeedbackStyle.Medium);
    trackEvent(AnalyticsEvent.ONBOARDING_STARTED);
    router.push(OB_ROUTE.EXPERIENCE);
  };

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
              source={require('../../assets/images/MotoVault.png')}
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
            MotoVault
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
          <Animated.Text
            entering={FadeInUp.delay(300).duration(400)}
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
          </Animated.Text>

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
