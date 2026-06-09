import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { BarChart3, Bell, Compass } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, View } from 'react-native';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { OB_ROUTE, OB_SCREEN, TOTAL_SCREENS } from '../../config/onboarding';
import { AnalyticsEvent } from '../../lib/analytics';
import { setupNotificationChannels } from '../../lib/notifications';
import { trackOnboardingEvent } from '../../lib/onboarding-analytics';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { triggerImpact } from '../../utils/haptics';

const BENEFITS = [
  { icon: Bell, labelKey: 'v2NotificationsBenefit1' },
  { icon: BarChart3, labelKey: 'v2NotificationsBenefit2' },
  { icon: Compass, labelKey: 'v2NotificationsBenefit3' },
] as const;

function PulseRings() {
  const ring1Scale = useSharedValue(1);
  const ring2Scale = useSharedValue(1);

  useEffect(() => {
    ring1Scale.value = withRepeat(withTiming(1.4, { duration: 2000 }), -1, true);
    ring2Scale.value = withRepeat(withTiming(1.7, { duration: 2400 }), -1, true);
  }, [ring1Scale, ring2Scale]);

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring1Scale.value }],
  }));

  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring2Scale.value }],
  }));

  return (
    <>
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: 160,
            height: 160,
            borderRadius: 80,
            borderCurve: 'continuous',
            backgroundColor: ONBOARDING_COLORS.warm,
            opacity: 0.08,
          },
          ring2Style,
        ]}
      />
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: 130,
            height: 130,
            borderRadius: 65,
            borderCurve: 'continuous',
            backgroundColor: ONBOARDING_COLORS.warm,
            opacity: 0.15,
          },
          ring1Style,
        ]}
      />
    </>
  );
}

function NotificationIllustration() {
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        height: 260,
        marginBottom: 32,
      }}
    >
      <PulseRings />
      {/* Phone frame */}
      <View
        style={{
          width: 100,
          height: 160,
          borderRadius: 16,
          borderCurve: 'continuous',
          borderWidth: 2,
          borderColor: ONBOARDING_COLORS.textSecondary,
          alignItems: 'center',
          paddingTop: 24,
        }}
      >
        {/* Notification card mockup */}
        <View
          style={{
            width: 72,
            height: 44,
            borderRadius: 10,
            borderCurve: 'continuous',
            backgroundColor: ONBOARDING_COLORS.surface2,
            padding: 8,
            gap: 4,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Bell size={10} color={ONBOARDING_COLORS.warm} />
            <View
              style={{
                height: 4,
                width: 32,
                borderRadius: 2,
                backgroundColor: ONBOARDING_COLORS.textSecondary,
              }}
            />
          </View>
          <View
            style={{
              height: 3,
              width: 48,
              borderRadius: 2,
              backgroundColor: ONBOARDING_COLORS.textMuted,
            }}
          />
          <View
            style={{
              height: 3,
              width: 36,
              borderRadius: 2,
              backgroundColor: ONBOARDING_COLORS.textMuted,
            }}
          />
        </View>
      </View>
    </View>
  );
}

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tracked = useRef(false);
  const setLastCompletedScreen = useOnboardingStore((s) => s.setLastCompletedScreen);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_VIEWED, OB_SCREEN.NOTIFICATIONS);
  }, []);

  const navigateForward = () => {
    setLastCompletedScreen(OB_SCREEN.NOTIFICATIONS);
    router.push(OB_ROUTE.PERSONALIZING);
  };

  const handleEnable = async () => {
    triggerImpact(Haptics.ImpactFeedbackStyle.Medium);

    const { status: existing, canAskAgain } = await Notifications.getPermissionsAsync();

    // Already denied and can't re-prompt — direct to Settings
    if (existing === 'denied' && !canAskAgain) {
      Alert.alert(
        t('onboarding.v2NotificationsAlreadyDenied'),
        t('onboarding.v2NotificationsOpenSettings'),
        [
          { text: t('common.cancel'), style: 'cancel', onPress: navigateForward },
          {
            text: t('onboarding.v2NotificationsOpenSettingsBtn'),
            onPress: () => {
              Linking.openSettings();
              navigateForward();
            },
          },
        ],
      );
      return;
    }

    // Always call requestPermissionsAsync — shows the system prompt when
    // status is 'undetermined', and is a no-op when already granted.
    const { status } = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    const granted = status === 'granted';

    if (granted && process.env.EXPO_OS === 'android') {
      await setupNotificationChannels();
    }

    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, OB_SCREEN.NOTIFICATIONS, {
      permission_granted: granted,
      skipped: false,
    });

    navigateForward();
  };

  const handleSkip = () => {
    triggerImpact(Haptics.ImpactFeedbackStyle.Light);
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, OB_SCREEN.NOTIFICATIONS, {
      permission_granted: false,
      skipped: true,
    });
    navigateForward();
  };

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={5} totalScreens={TOTAL_SCREENS} />

      <View
        style={{
          flex: 1,
          paddingHorizontal: 24,
          paddingTop: 32,
          justifyContent: 'space-between',
        }}
      >
        {/* Content */}
        <View style={{ alignItems: 'center' }}>
          <Animated.View entering={FadeInUp.duration(400)}>
            <NotificationIllustration />
          </Animated.View>

          <Animated.Text
            entering={FadeInUp.delay(100).duration(300)}
            style={{
              fontFamily: 'InstrumentSerif-Regular',
              fontSize: 26,
              color: ONBOARDING_COLORS.textPrimary,
              textAlign: 'center',
              letterSpacing: -0.5,
              marginBottom: 10,
            }}
          >
            {t('onboarding.v2NotificationsTitle')}
          </Animated.Text>

          <Animated.Text
            entering={FadeInUp.delay(200).duration(300)}
            style={{
              fontFamily: 'Geist-Regular',
              fontSize: 15,
              color: ONBOARDING_COLORS.textSecondary,
              textAlign: 'center',
              lineHeight: 22,
              marginBottom: 32,
              paddingHorizontal: 12,
            }}
          >
            {t('onboarding.v2NotificationsSubtitle')}
          </Animated.Text>

          {/* Benefits */}
          <View style={{ gap: 18, alignItems: 'center' }}>
            {BENEFITS.map((benefit, index) => (
              <Animated.View
                key={benefit.labelKey}
                entering={FadeInUp.delay(300 + index * 80)
                  .duration(300)
                  .springify()
                  .damping(18)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <benefit.icon size={20} color={ONBOARDING_COLORS.warm} />
                <Text
                  style={{
                    fontSize: 14,
                    color: ONBOARDING_COLORS.textSecondary,
                    lineHeight: 20,
                  }}
                >
                  {t(`onboarding.${benefit.labelKey}`)}
                </Text>
              </Animated.View>
            ))}
          </View>
        </View>

        {/* Buttons */}
        <View style={{ gap: 12, paddingBottom: insets.bottom + 24 }}>
          <Pressable
            onPress={handleEnable}
            accessibilityRole="button"
            style={({ pressed }) => ({
              backgroundColor: ONBOARDING_COLORS.warm,
              borderRadius: 16,
              borderCurve: 'continuous',
              paddingVertical: 18,
              alignItems: 'center',
              justifyContent: 'center',
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
              {t('onboarding.v2NotificationsEnable')}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleSkip}
            accessibilityRole="button"
            style={({ pressed }) => ({
              borderWidth: 1.5,
              borderColor: ONBOARDING_COLORS.warm,
              borderRadius: 16,
              borderCurve: 'continuous',
              paddingVertical: 18,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: ONBOARDING_COLORS.warm,
                letterSpacing: -0.15,
              }}
            >
              {t('onboarding.v2NotificationsMaybeLater')}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
