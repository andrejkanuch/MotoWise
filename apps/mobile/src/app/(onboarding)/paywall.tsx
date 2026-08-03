import { REVENUECAT_ENTITLEMENT_PRO } from '@motovault/types';
import Constants from 'expo-constants';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import {
  GOAL_TO_PLACEMENT,
  getPrimaryGoal,
  MAINTENANCE_INTENT_PLACEMENT,
  OB_SCREEN,
} from '../../config/onboarding';
import { useOnboardingNext, useOnboardingStep } from '../../hooks/use-onboarding-flow';
import { AnalyticsEvent, captureException } from '../../lib/analytics';
import { trackOnboardingEvent } from '../../lib/onboarding-analytics';
import { isMaintenanceIntent } from '../../lib/pending-intent';
import { presentPaywall, setOnboardingAttributes } from '../../lib/subscription';
import { useOnboardingStore } from '../../stores/onboarding.store';

const isExpoGo = Constants.appOwnership === 'expo';

/**
 * How long to wait for first-launch intent resolution before presenting anyway.
 * Resolution finishes at cold start (many screens earlier), so this should never
 * fire — but without it, an `intentResolved` that never flips leaves the rider on
 * a bare spinner behind `gestureEnabled: false`, with no Back and no skip. Losing
 * the maintenance placement is strictly better than a dead end.
 */
const INTENT_RESOLVE_TIMEOUT_MS = 2500;

/**
 * How long the rider may sit on this screen before we surface an escape link.
 * The native RevenueCat modal covers this screen and advancing happens the moment
 * it closes, so in the happy path the link is never seen. It exists for the case
 * where the modal never appears at all (RC init/offering stall, or a native
 * renderer crash on Android) — previously an unrecoverable lockout.
 */
const ESCAPE_HATCH_DELAY_MS = 6000;

export default function PaywallScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { stepIndex, totalScreens } = useOnboardingStep(OB_SCREEN.PAYWALL);
  const goNext = useOnboardingNext(OB_SCREEN.PAYWALL);
  const presented = useRef(false);
  const advanced = useRef(false);
  const [intentTimedOut, setIntentTimedOut] = useState(false);
  const [showEscape, setShowEscape] = useState(false);
  const ridingGoals = useOnboardingStore((s) => s.ridingGoals);
  const bikeData = useOnboardingStore((s) => s.bikeData);
  const experienceLevel = useOnboardingStore((s) => s.experienceLevel);
  const pendingIntent = useOnboardingStore((s) => s.pendingIntent);
  const intentResolved = useOnboardingStore((s) => s.intentResolved);
  const setLastCompletedScreen = useOnboardingStore((s) => s.setLastCompletedScreen);

  /**
   * Advance exactly once. The paywall can now be left by two racing paths — the
   * modal resolving and the rider tapping the escape link — and calling `goNext()`
   * twice would push the following step twice.
   */
  const advanceOnce = useCallback(() => {
    if (advanced.current) return;
    advanced.current = true;
    goNext();
  }, [goNext]);

  // Fallback for an `intentResolved` that never settles (see the constant above).
  useEffect(() => {
    if (intentResolved) return;
    const id = setTimeout(() => setIntentTimedOut(true), INTENT_RESOLVE_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [intentResolved]);

  // Escape hatch for a native modal that never shows (see the constant above).
  useEffect(() => {
    const id = setTimeout(() => setShowEscape(true), ESCAPE_HATCH_DELAY_MS);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    // Wait until first-launch intent resolution has settled before latching —
    // otherwise a late-arriving pendingIntent would miss the maintenance
    // placement behind the one-shot present guard. Resolution completes at cold
    // start (many screens earlier), so in practice this never actually blocks;
    // `intentTimedOut` guarantees we present regardless if it ever stalls.
    if (presented.current || (!intentResolved && !intentTimedOut)) return;
    presented.current = true;

    const primaryGoal = getPrimaryGoal(ridingGoals);
    // Maintenance-intent riders (arrived from a bike's service-schedule article)
    // get the reminder-led paywall placement instead of the goal-derived one
    // (P3.2). Placement only — this does not reorder the flow. Falls back to the
    // current offering if the placement is absent.
    const placement = isMaintenanceIntent(pendingIntent)
      ? MAINTENANCE_INTENT_PLACEMENT
      : GOAL_TO_PLACEMENT[primaryGoal];
    const goalsJoined = ridingGoals.join(',');

    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_VIEWED, OB_SCREEN.PAYWALL);

    if (isExpoGo) {
      // Skip paywall in Expo Go — IAP not available
      setLastCompletedScreen(OB_SCREEN.PAYWALL);
      trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, OB_SCREEN.PAYWALL, {
        paywall_result: 'skipped_expo_go',
        goals: goalsJoined,
        primary_goal: primaryGoal,
        placement,
      });
      advanceOnce();
      return;
    }

    // Check-point BEFORE presenting, not after. The native modal runs outside our
    // control: if the rider force-kills the app while it is up (or it crashes, as
    // the Android Compose renderer has), a checkpoint written afterwards is never
    // written at all — and resume then routes straight back onto this screen and
    // re-presents, indefinitely. Recording the step as reached up-front means a
    // kill resumes at the NEXT step. The purchase itself is not lost either way:
    // the RevenueCat listener in subscription.ts reconciles entitlements on launch.
    setLastCompletedScreen(OB_SCREEN.PAYWALL);

    (async () => {
      const personalization = {
        primaryGoal,
        bikeMake: bikeData?.make,
        bikeModel: bikeData?.model,
        bikeYear: bikeData?.year,
        experience: experienceLevel,
      };

      // Customer attributes drive targeting (placement/audiences); they are NOT
      // substituted into paywall text.
      await setOnboardingAttributes(personalization);

      // The escape hatch races this whole async path, so re-check before the one
      // step with a *visible* side effect. An RC init/offering stall can outlast
      // ESCAPE_HATCH_DELAY_MS — that stall is precisely why the hatch exists — so
      // the rider may already be a screen further on. Presenting now would drop a
      // native modal over the next onboarding step. A purchase is not lost by
      // skipping it: the RevenueCat listener reconciles entitlements on launch.
      if (advanced.current) return;

      // Paywall copy is personalized via custom variables ({{ custom.* }}) — the
      // same answers are passed through `personalization` here.
      const result = await presentPaywall({
        requiredEntitlementIdentifier: REVENUECAT_ENTITLEMENT_PRO,
        placement,
        personalization,
        source: 'onboarding',
        feature: 'subscription',
        surface: 'onboarding_paywall',
      });

      // Same race, other side: the rider escaped while the modal was up. The step
      // is already recorded as SKIPPED, and a terminal event per step is what the
      // funnel counts — emitting COMPLETED too would double-count the paywall.
      if (advanced.current) return;

      trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, OB_SCREEN.PAYWALL, {
        paywall_result: result,
        goals: goalsJoined,
        primary_goal: primaryGoal,
        placement,
      });

      // Navigate forward regardless of result — user can always continue free
      // The RevenueCat listener in subscription.ts will update the store if purchased
      advanceOnce();
    })().catch((err) => {
      // `presentPaywall` catches its own failures and resolves to 'error', so this
      // should be unreachable. It exists because the cost of being wrong is a
      // permanent lockout: an unhandled rejection here would skip `advanceOnce()`
      // and strand the rider on a bare spinner with no Back and no gesture.
      // Reported unconditionally — an escaped rider does not make the crash less real.
      captureException(err, { screen: OB_SCREEN.PAYWALL });
      if (advanced.current) return;
      trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, OB_SCREEN.PAYWALL, {
        paywall_result: 'presentation_failed',
        goals: goalsJoined,
        primary_goal: primaryGoal,
        placement,
      });
      advanceOnce();
    });
  }, [
    advanceOnce,
    ridingGoals,
    bikeData,
    experienceLevel,
    pendingIntent,
    intentResolved,
    intentTimedOut,
    setLastCompletedScreen,
  ]);

  const handleEscape = () => {
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_SKIPPED, OB_SCREEN.PAYWALL, {
      reason: 'escape_hatch',
    });
    setLastCompletedScreen(OB_SCREEN.PAYWALL);
    advanceOnce();
  };

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={stepIndex} totalScreens={totalScreens} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={ONBOARDING_COLORS.accent} />
      </View>

      {/* Only reachable when the native modal never covered this screen. */}
      {showEscape ? (
        <Animated.View
          entering={FadeIn.duration(240)}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: 24,
            paddingBottom: insets.bottom + 20,
          }}
        >
          <Pressable
            onPress={handleEscape}
            hitSlop={12}
            accessibilityRole="button"
            style={{ alignSelf: 'center' }}
          >
            <Text style={{ fontSize: 13.5, color: ONBOARDING_COLORS.textMuted }}>
              {t('onboarding.obPaywallEscape')}
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}
