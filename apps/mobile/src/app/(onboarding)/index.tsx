import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Bike } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { TOTAL_SCREENS } from './_config';

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const handleGetStarted = () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push('/(onboarding)/experience');
  };

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={0} totalScreens={TOTAL_SCREENS} />

      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 32,
        }}
      >
        <Animated.View entering={FadeInDown.duration(300)}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              borderCurve: 'continuous',
              backgroundColor: ONBOARDING_COLORS.cardBorderDefault,
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'center',
              marginBottom: 32,
            }}
          >
            <Bike size={64} color={ONBOARDING_COLORS.textPrimary} />
          </View>
        </Animated.View>

        <Animated.Text
          entering={FadeInUp.delay(150).duration(300)}
          style={{
            fontSize: 36,
            fontWeight: '800',
            color: ONBOARDING_COLORS.textPrimary,
            letterSpacing: -0.5,
            textAlign: 'center',
            marginBottom: 12,
          }}
        >
          {t('onboarding.welcomeHeroTitle')}
        </Animated.Text>

        <Animated.Text
          entering={FadeInUp.delay(300).duration(300)}
          style={{
            fontSize: 17,
            color: ONBOARDING_COLORS.textSecondary,
            lineHeight: 24,
            textAlign: 'center',
          }}
        >
          {t('onboarding.welcomeHeroSubtitle')}
        </Animated.Text>
      </View>

      <Animated.View
        entering={FadeIn.delay(500).duration(300)}
        style={{ paddingHorizontal: 24, paddingBottom: 48 }}
      >
        <Pressable
          onPress={handleGetStarted}
          style={({ pressed }) => ({
            backgroundColor: ONBOARDING_COLORS.textPrimary,
            borderRadius: 16,
            borderCurve: 'continuous',
            paddingVertical: 18,
            alignItems: 'center',
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
            boxShadow: '0 4px 12px rgba(255, 255, 255, 0.15)',
          })}
        >
          <Text
            style={{
              fontSize: 17,
              fontWeight: '700',
              color: ONBOARDING_COLORS.background,
            }}
          >
            {t('onboarding.getStarted')}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
