import { colors } from '@motolearn/design-system';
import { UpdateUserDocument } from '@motolearn/graphql';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useMutation } from 'urql';
import { useOnboardingStore } from '../../stores/onboarding.store';

const STEPS = ['personalizingStep1', 'personalizingStep2', 'personalizingStep3'] as const;

export default function PersonalizingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [visibleSteps, setVisibleSteps] = useState(0);
  const { experienceLevel, ridingGoals, reset } = useOnboardingStore();
  const [, updateUser] = useMutation(UpdateUserDocument);
  const persisted = useRef(false);

  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.6);

  useEffect(() => {
    pulseScale.value = withRepeat(withTiming(1.3, { duration: 1200 }), -1, true);
    pulseOpacity.value = withRepeat(withTiming(0.2, { duration: 1200 }), -1, true);
  }, [pulseScale, pulseOpacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  useEffect(() => {
    if (persisted.current) return;
    persisted.current = true;

    updateUser({
      input: {
        preferences: {
          onboardingCompleted: true,
          ...(experienceLevel ? { experienceLevel } : {}),
          ...(ridingGoals.length > 0 ? { ridingGoals } : {}),
        },
      },
    }).then(() => {
      reset();
    });
  }, [experienceLevel, ridingGoals, updateUser, reset]);

  useEffect(() => {
    const timers = [
      setTimeout(() => setVisibleSteps(1), 400),
      setTimeout(() => setVisibleSteps(2), 1200),
      setTimeout(() => setVisibleSteps(3), 2000),
      setTimeout(() => {
        router.replace('/(tabs)/(learn)');
      }, 3200),
    ];

    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [router]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.primary[950],
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
      }}
    >
      {/* Pulsing ring */}
      <View
        style={{
          width: 120,
          height: 120,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 48,
        }}
      >
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: 120,
              height: 120,
              borderRadius: 60,
              borderCurve: 'continuous',
              borderWidth: 3,
              borderColor: colors.primary[500],
            },
            pulseStyle,
          ]}
        />
        <View
          style={{
            width: 60,
            height: 60,
            borderRadius: 30,
            borderCurve: 'continuous',
            backgroundColor: colors.primary[500],
          }}
        />
      </View>

      <Text
        style={{
          fontSize: 24,
          fontWeight: '800',
          color: '#FFFFFF',
          textAlign: 'center',
          marginBottom: 32,
        }}
      >
        {t('onboarding.personalizingTitle')}
      </Text>

      <View style={{ gap: 16, alignItems: 'center' }}>
        {STEPS.map((stepKey, index) =>
          visibleSteps > index ? (
            <Animated.Text
              key={stepKey}
              entering={FadeInUp.duration(400)}
              style={{
                fontSize: 16,
                color: 'rgba(255,255,255,0.6)',
                textAlign: 'center',
              }}
            >
              {t(`onboarding.${stepKey}`)}
            </Animated.Text>
          ) : null,
        )}
      </View>
    </View>
  );
}
