import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { BarChart3, Bell, Compass } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingBackButton } from '../../components/onboarding/onboarding-back-button';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { OB_SCREEN } from '../../config/onboarding';
import { useOnboardingBack } from '../../hooks/use-onboarding-back';
import { useOnboardingNext, useOnboardingStep } from '../../hooks/use-onboarding-flow';
import { AnalyticsEvent } from '../../lib/analytics';
import { setupNotificationChannels } from '../../lib/notifications';
import { trackOnboardingEvent } from '../../lib/onboarding-analytics';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { triggerImpact } from '../../utils/haptics';

/**
 * The two permission statuses this screen branches on. expo-notifications does
 * not re-export the `PermissionStatus` enum (unlike expo-location), so mirror
 * the values as typed constants rather than scattering magic strings.
 */
const NOTIFICATION_PERMISSION = {
  GRANTED: 'granted',
  DENIED: 'denied',
} as const;

/**
 * Three benefit rows, each with a two-tier title + subtitle and an icon in a
 * per-row colored rounded tile (copper / blue / teal). No gamification copy.
 */
const BENEFITS = [
  {
    icon: Bell,
    tile: ONBOARDING_COLORS.warm,
    titleKey: 'v2NotificationsBenefit1Title',
    subtitleKey: 'v2NotificationsBenefit1Subtitle',
  },
  {
    icon: BarChart3,
    tile: ONBOARDING_COLORS.blue,
    titleKey: 'v2NotificationsBenefit2Title',
    subtitleKey: 'v2NotificationsBenefit2Subtitle',
  },
  {
    icon: Compass,
    tile: ONBOARDING_COLORS.teal,
    titleKey: 'v2NotificationsBenefit3Title',
    subtitleKey: 'v2NotificationsBenefit3Subtitle',
  },
] as const;

/**
 * Widened wrapper for onboarding copy keys that are pending addition to en.json.
 * Routes through i18next at runtime; sidesteps the generated-from-en.json key
 * union so this screen can reference its spec'd copy keys without editing locale
 * files. (Mirrors the `tx` helper used on goals.tsx.)
 */
type TWide = (key: string, options?: Record<string, unknown>) => string;

/** A realistic sample push-notification card: logo tile, app name · time, body. */
function NotificationCard() {
  const { t } = useTranslation();
  const tx = t as unknown as TWide;
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
      {/* soft copper glow behind the card */}
      <View
        style={{
          position: 'absolute',
          top: -8,
          width: 260,
          height: 120,
          borderRadius: 60,
          borderCurve: 'continuous',
          backgroundColor: ONBOARDING_COLORS.warm,
          opacity: 0.16,
        }}
      />
      <Animated.View
        entering={FadeInDown.duration(500)}
        style={{
          width: '100%',
          maxWidth: 320,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 11,
          paddingVertical: 13,
          paddingHorizontal: 14,
          borderRadius: 18,
          borderCurve: 'continuous',
          backgroundColor: ONBOARDING_COLORS.surface2,
          borderWidth: 1,
          borderColor: ONBOARDING_COLORS.cardBorderDefault,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 9,
            borderCurve: 'continuous',
            overflow: 'hidden',
            backgroundColor: ONBOARDING_COLORS.warm,
          }}
        >
          <Image
            source={require('../../assets/images/motovault-icon-card.png')}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
          />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              justifyContent: 'space-between',
            }}
          >
            <Text
              style={{
                fontFamily: 'Geist',
                fontSize: 12.5,
                fontWeight: '700',
                color: ONBOARDING_COLORS.textPrimary,
              }}
            >
              {tx('onboarding.v2NotificationsSampleApp')}
            </Text>
            <Text
              style={{
                fontFamily: 'GeistMono-Medium',
                fontSize: 9.5,
                color: ONBOARDING_COLORS.textMuted,
              }}
            >
              {tx('onboarding.v2NotificationsSampleTime')}
            </Text>
          </View>
          <Text
            style={{
              fontFamily: 'Geist-Regular',
              fontSize: 12.5,
              lineHeight: 17,
              color: ONBOARDING_COLORS.textSecondary,
              marginTop: 2,
            }}
          >
            {tx('onboarding.v2NotificationsSampleBody')}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const tx = t as unknown as TWide;
  const insets = useSafeAreaInsets();
  const { stepIndex, totalScreens } = useOnboardingStep(OB_SCREEN.NOTIFICATIONS);
  const onBack = useOnboardingBack(OB_SCREEN.NOTIFICATIONS);
  const goNext = useOnboardingNext(OB_SCREEN.NOTIFICATIONS);
  const tracked = useRef(false);
  const setLastCompletedScreen = useOnboardingStore((s) => s.setLastCompletedScreen);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_VIEWED, OB_SCREEN.NOTIFICATIONS);
  }, []);

  const navigateForward = () => {
    setLastCompletedScreen(OB_SCREEN.NOTIFICATIONS);
    goNext();
  };

  const handleEnable = async () => {
    triggerImpact(Haptics.ImpactFeedbackStyle.Medium);

    // The native permission APIs can reject on some device/simulator states.
    // Never strand the user on this onboarding step: if we can't even read the
    // current status, move on rather than leaving the Enable button dead.
    let current: Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>;
    try {
      current = await Notifications.getPermissionsAsync();
    } catch {
      navigateForward();
      return;
    }
    const { status: existing, canAskAgain } = current;

    // Already denied and can't re-prompt — direct to Settings
    if (existing === NOTIFICATION_PERMISSION.DENIED && !canAskAgain) {
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
    // MOT-272: emit requested/result so the grant rate is measurable — it gates
    // the deferred notification/push retention bets.
    trackOnboardingEvent(AnalyticsEvent.NOTIFICATION_PERMISSION_REQUESTED, OB_SCREEN.NOTIFICATIONS);
    let granted = false;
    try {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
      granted = status === NOTIFICATION_PERMISSION.GRANTED;
      if (granted && process.env.EXPO_OS === 'android') {
        await setupNotificationChannels();
      }
    } catch {
      // Request (or Android channel setup) rejected — treat as not granted and
      // continue. RESULT still fires below so it always pairs with REQUESTED.
      granted = false;
    }
    trackOnboardingEvent(AnalyticsEvent.NOTIFICATION_PERMISSION_RESULT, OB_SCREEN.NOTIFICATIONS, {
      permission_granted: granted,
    });

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
      <OnboardingProgress screenIndex={stepIndex} totalScreens={totalScreens} />

      {/* Header — back button + eyebrow */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: 12,
          paddingHorizontal: 16,
          gap: 8,
        }}
      >
        <OnboardingBackButton onPress={onBack} />
        <Text
          style={{
            fontFamily: 'GeistMono-Medium',
            fontSize: 11,
            letterSpacing: 1.8,
            textTransform: 'uppercase',
            color: ONBOARDING_COLORS.warm2,
          }}
        >
          {tx('onboarding.v2NotificationsEyebrow')}
        </Text>
      </View>

      <View
        style={{
          flex: 1,
          paddingHorizontal: 24,
          paddingTop: 20,
          justifyContent: 'space-between',
        }}
      >
        <View>
          {/* Sample push-notification card illustration */}
          <Animated.View entering={FadeInUp.duration(400)}>
            <NotificationCard />
          </Animated.View>

          <Animated.Text
            entering={FadeInUp.delay(100).duration(300)}
            style={{
              fontFamily: 'InstrumentSerif-Regular',
              fontSize: 30,
              lineHeight: 34,
              color: ONBOARDING_COLORS.textPrimary,
              letterSpacing: -0.5,
              marginTop: 24,
            }}
          >
            {tx('onboarding.v2NotificationsTitleLead')}
            {'\n'}
            {tx('onboarding.v2NotificationsTitleBike')}{' '}
            <Text style={{ fontFamily: 'InstrumentSerif-Italic', color: ONBOARDING_COLORS.warm2 }}>
              {tx('onboarding.v2NotificationsTitleHealth')}
            </Text>
          </Animated.Text>

          <Animated.Text
            entering={FadeInUp.delay(200).duration(300)}
            style={{
              fontFamily: 'Geist-Regular',
              fontSize: 14,
              color: ONBOARDING_COLORS.textSecondary,
              lineHeight: 21,
              marginTop: 8,
              maxWidth: 320,
            }}
          >
            {t('onboarding.v2NotificationsSubtitle')}
          </Animated.Text>

          {/* Benefit rows */}
          <View style={{ gap: 18, marginTop: 28 }}>
            {BENEFITS.map((benefit, index) => (
              <Animated.View
                key={benefit.titleKey}
                entering={FadeInUp.delay(300 + index * 80)
                  .duration(300)
                  .springify()
                  .damping(18)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    borderCurve: 'continuous',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: `${benefit.tile}29`,
                  }}
                >
                  <benefit.icon size={19} color={benefit.tile} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: 'Geist',
                      fontSize: 14.5,
                      fontWeight: '600',
                      color: ONBOARDING_COLORS.textPrimary,
                      letterSpacing: -0.15,
                    }}
                  >
                    {tx(`onboarding.${benefit.titleKey}`)}
                  </Text>
                  <Text
                    style={{
                      fontFamily: 'Geist-Regular',
                      fontSize: 12.5,
                      color: ONBOARDING_COLORS.ink3,
                      lineHeight: 17,
                      marginTop: 1,
                    }}
                  >
                    {tx(`onboarding.${benefit.subtitleKey}`)}
                  </Text>
                </View>
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
              flexDirection: 'row',
              gap: 9,
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
            <Bell size={18} color={ONBOARDING_COLORS.textOnAccent} />
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
              borderWidth: 1,
              borderColor: ONBOARDING_COLORS.cardBorderDefault,
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
                color: ONBOARDING_COLORS.textSecondary,
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
