import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Text, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useOnboardingColors } from '../../components/onboarding/onboarding-colors';
import { OnboardingShell } from '../../components/onboarding/onboarding-shell';
import { OB_SCREEN } from '../../config/onboarding';
import { useOnboardingBack } from '../../hooks/use-onboarding-back';
import { useOnboardingNext } from '../../hooks/use-onboarding-flow';
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
 * Widened wrapper for onboarding copy keys that are pending addition to en.json.
 * Routes through i18next at runtime; sidesteps the generated-from-en.json key
 * union so this screen can reference its spec'd copy keys without editing locale
 * files. (Mirrors the `tx` helper used on goals.tsx.)
 */
type TWide = (key: string, options?: Record<string, unknown>) => string;

/** A realistic sample push-notification card: logo tile, app name · time, body. */
function NotificationCard() {
  const oc = useOnboardingColors();
  const reduceMotion = useReducedMotion();
  const { t } = useTranslation();
  const tx = t as unknown as TWide;
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        entering={reduceMotion ? undefined : FadeInDown.duration(280)}
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
          backgroundColor: oc.surface,
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
  const { t } = useTranslation();
  const tx = t as unknown as TWide;
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
    <OnboardingShell
      screen={OB_SCREEN.NOTIFICATIONS}
      onBack={onBack}
      title={t('onboarding.v2NotificationsTitle')}
      subtitle={tx('onboarding.v2NotificationsBenefit1Subtitle')}
      primary={{ label: t('onboarding.v2NotificationsEnable'), onPress: handleEnable }}
      secondary={{ label: t('onboarding.v2NotificationsMaybeLater'), onPress: handleSkip }}
    >
      {/* What a reminder actually looks like — the one benefit, shown not told. */}
      <NotificationCard />
    </OnboardingShell>
  );
}
