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
import { useOnboardingColors } from '../../components/onboarding/onboarding-colors';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { OB_SCREEN } from '../../config/onboarding';
import { useOnboardingBack } from '../../hooks/use-onboarding-back';
import { useOnboardingNext, useOnboardingStep } from '../../hooks/use-onboarding-flow';
import { AnalyticsEvent } from '../../lib/analytics';
import { setupNotificationChannels } from '../../lib/notifications';
import { trackOnboardingEvent } from '../../lib/onboarding-analytics';
import { registerForPushNotifications } from '../../lib/push-token';
import { resyncTrialReminder } from '../../lib/subscription';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { radius, space, type } from '../../theme/type';
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
 * neutral rounded tile. No gamification copy.
 */
const BENEFITS = [
  {
    icon: Bell,
    titleKey: 'v2NotificationsBenefit1Title',
    subtitleKey: 'v2NotificationsBenefit1Subtitle',
  },
  {
    icon: BarChart3,
    titleKey: 'v2NotificationsBenefit2Title',
    subtitleKey: 'v2NotificationsBenefit2Subtitle',
  },
  {
    icon: Compass,
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
  const oc = useOnboardingColors();
  const { t } = useTranslation();
  const tx = t as unknown as TWide;
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: space.xxs }}>
      <Animated.View
        entering={FadeInDown.duration(500)}
        style={{
          width: '100%',
          maxWidth: 320,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          paddingVertical: space.sm,
          paddingHorizontal: space.sm,
          borderRadius: radius.card,
          borderCurve: 'continuous',
          backgroundColor: oc.surface2,
          borderWidth: 1,
          borderColor: oc.cardBorderDefault,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.chip,
            borderCurve: 'continuous',
            overflow: 'hidden',
            backgroundColor: oc.warm,
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
            <Text style={[type.label, { color: oc.textPrimary }]}>
              {tx('onboarding.v2NotificationsSampleApp')}
            </Text>
            <Text style={[type.caption, { color: oc.textMuted }]}>
              {tx('onboarding.v2NotificationsSampleTime')}
            </Text>
          </View>
          <Text style={[type.subhead, { color: oc.textSecondary, marginTop: 2 }]}>
            {tx('onboarding.v2NotificationsSampleBody')}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

export default function NotificationsScreen() {
  const oc = useOnboardingColors();
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
      // MOT-278: register the device's Expo push token for server-sent reminders.
      if (granted) {
        void registerForPushNotifications();
        // A trial started on the commit_first paywall (before this step) can
        // only get its day-5 reminder now that permission exists.
        void resyncTrialReminder();
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
    <View style={{ flex: 1, backgroundColor: oc.background }}>
      <OnboardingProgress screenIndex={stepIndex} totalScreens={totalScreens} />

      {/* Header — back button */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: space.sm,
          paddingHorizontal: space.md,
        }}
      >
        <OnboardingBackButton onPress={onBack} />
      </View>

      <View
        style={{
          flex: 1,
          paddingHorizontal: space.xl,
          paddingTop: space.lg,
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
            accessibilityRole="header"
            style={[type.largeTitle, { color: oc.textPrimary, marginTop: space.xl }]}
          >
            {t('onboarding.v2NotificationsTitle')}
          </Animated.Text>

          <Animated.Text
            entering={FadeInUp.delay(200).duration(300)}
            style={[type.subhead, { color: oc.textSecondary, marginTop: space.xs, maxWidth: 320 }]}
          >
            {t('onboarding.v2NotificationsSubtitle')}
          </Animated.Text>

          {/* Benefit rows */}
          <View style={{ gap: space.md, marginTop: space.xxl }}>
            {BENEFITS.map((benefit, index) => (
              <Animated.View
                key={benefit.titleKey}
                entering={FadeInUp.delay(300 + index * 80)
                  .duration(300)
                  .springify()
                  .damping(18)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.control,
                    borderCurve: 'continuous',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: oc.surface2,
                  }}
                >
                  <benefit.icon size={19} color={oc.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[type.bodyStrong, { color: oc.textPrimary }]}>
                    {tx(`onboarding.${benefit.titleKey}`)}
                  </Text>
                  <Text style={[type.subhead, { color: oc.ink3, marginTop: 2 }]}>
                    {tx(`onboarding.${benefit.subtitleKey}`)}
                  </Text>
                </View>
              </Animated.View>
            ))}
          </View>
        </View>

        {/* Buttons */}
        <View style={{ gap: space.sm, paddingBottom: insets.bottom + space.xl }}>
          <Pressable
            onPress={handleEnable}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: 'row',
              gap: space.xs,
              backgroundColor: oc.warm,
              borderRadius: radius.control,
              borderCurve: 'continuous',
              minHeight: 52,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <Bell size={18} color={oc.textOnAccent} />
            <Text style={[type.bodyStrong, { color: oc.textOnAccent }]}>
              {t('onboarding.v2NotificationsEnable')}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleSkip}
            accessibilityRole="button"
            style={({ pressed }) => ({
              backgroundColor: oc.surface2,
              borderRadius: radius.control,
              borderCurve: 'continuous',
              minHeight: 52,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <Text style={[type.bodyStrong, { color: oc.textPrimary }]}>
              {t('onboarding.v2NotificationsMaybeLater')}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
