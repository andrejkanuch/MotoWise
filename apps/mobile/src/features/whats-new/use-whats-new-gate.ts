import * as Application from 'expo-application';
import { type Href, useRouter, useSegments } from 'expo-router';
import { useEffect, useReducer, useRef } from 'react';
import { MODAL_ROUTE } from '../../config/routes';
import { WHATS_NEW_ARM, WHATS_NEW_SOURCE, WHATS_NEW_TIMING } from '../../config/whats-new';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { isConsentPromptOwed } from '../../lib/analytics-consent';
import { isPaywallInFlight, paywallFlightSettled } from '../../lib/subscription';
import { type OwedWhatsNew, owedRelease } from '../../lib/whats-new';
import { resolveWhatsNewArm } from '../../lib/whats-new-experiment';
import { useAuthStore } from '../../stores/auth.store';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { useRideStore } from '../../stores/ride.store';
import { useWhatsNewStore } from '../../stores/whats-new.store';
import { useCarPlayConnection, usePhoneSceneVisible } from '../carplay/use-carplay';

const ROUTE_GROUP = {
  TABS: '(tabs)',
  ONBOARDING: '(onboarding)',
} as const;

const RIDE_STATUS = {
  RECORDING: 'recording',
  PAUSED: 'paused',
  ENDED: 'ended',
} as const;

const ACTIVE_RIDE_STATUSES: ReadonlySet<string> = new Set([
  RIDE_STATUS.RECORDING,
  RIDE_STATUS.PAUSED,
]);

const WHATS_NEW_AUTO_HREF = {
  pathname: MODAL_ROUTE.WHATS_NEW,
  params: { source: WHATS_NEW_SOURCE.AUTO },
} as const satisfies Href;

/**
 * Where the gate is in its one decision per session.
 * - `waiting`: nothing decided yet; decide once owed and nothing blocks.
 * - `deciding`: the holdout arm is being resolved.
 * - `showing`: treatment; push once nothing blocks.
 * - `scheduled`: the push waits out the show delay.
 * - `done`: pushed, held out, or seen meanwhile; nothing more this session.
 */
const GATE_PHASE = {
  WAITING: 'waiting',
  DECIDING: 'deciding',
  SHOWING: 'showing',
  SCHEDULED: 'scheduled',
  DONE: 'done',
} as const;
type GatePhase = (typeof GATE_PHASE)[keyof typeof GATE_PHASE];

// Session state lives at module level (a session is the JS process): it
// survives React 19 StrictMode's double mount, which a ref or an immediate
// store write can race, so the modal is pushed at most once per cold start.
let phase: GatePhase = GATE_PHASE.WAITING;
let rideEndedThisSession = false;
let onboardingThisSession = false;

interface GateInputs {
  ready: boolean;
  segments: readonly string[];
  rideStatus: string;
  awaitingGarageCta: boolean;
  carPlayConnected: boolean;
  phoneSceneVisible: boolean;
}

function owedNow(): OwedWhatsNew | null {
  const { lastSeenVersion, seenFeatures, usedFeatures } = useWhatsNewStore.getState();
  return owedRelease(Application.nativeApplicationVersion, lastSeenVersion, {
    seenFeatures,
    usedFeatures,
  });
}

/**
 * Whether What's New may open over what the rider is doing now. A ride that
 * ended, or onboarding, rules out the rest of the session; everything else
 * blocks only while it lasts. The consent screen is a root route, so being in
 * tabs also means it is not on screen.
 */
function canShowNow(inputs: GateInputs): boolean {
  if (inputs.rideStatus === RIDE_STATUS.ENDED) rideEndedThisSession = true;
  if (inputs.segments[0] === ROUTE_GROUP.ONBOARDING || inputs.awaitingGarageCta) {
    onboardingThisSession = true;
  }
  return (
    inputs.ready &&
    inputs.segments[0] === ROUTE_GROUP.TABS &&
    !ACTIVE_RIDE_STATUSES.has(inputs.rideStatus) &&
    !rideEndedThisSession &&
    !onboardingThisSession &&
    !inputs.carPlayConnected &&
    inputs.phoneSceneVisible &&
    !isConsentPromptOwed() &&
    !isPaywallInFlight()
  );
}

/**
 * Auto-shows What's New once per store update, at a calm moment. Held-out
 * riders get the release marked seen instead. The screen marks the release seen
 * and logs that it was viewed when it mounts.
 */
export function useWhatsNewGate(): void {
  const router = useRouter();
  const segments = useSegments();
  const session = useAuthStore((s) => s.session);
  const isLoading = useAuthStore((s) => s.isLoading);
  const onboardingCompleted = useAuthStore((s) => s.onboardingCompleted);
  const awaitingGarageCta = useOnboardingStore((s) => s.awaitingGarageCta);
  const rideStatus = useRideStore((s) => s.status);
  const { connected: carPlayConnected } = useCarPlayConnection();
  const phoneSceneVisible = usePhoneSceneVisible();
  const lastSeenVersion = useWhatsNewStore((s) => s.lastSeenVersion);
  // Bumped when an async step (arm resolution, a paywall closing) needs the gate re-run.
  const [recheck, requestRecheck] = useReducer((count: number) => count + 1, 0);

  const inputs: GateInputs = {
    ready: !isLoading && !!session && onboardingCompleted,
    segments,
    rideStatus,
    awaitingGarageCta,
    carPlayConnected,
    phoneSceneVisible,
  };
  // The latest inputs, for the re-check when the delayed push fires.
  const latest = useRef(inputs);
  latest.current = inputs;

  // biome-ignore lint/correctness/useExhaustiveDependencies: the inputs are read through `latest`; these values re-run the gate when they change.
  useEffect(() => {
    if (phase !== GATE_PHASE.WAITING && phase !== GATE_PHASE.SHOWING) return;

    const waitForPaywall = () => {
      void paywallFlightSettled()?.then(requestRecheck);
    };

    if (phase === GATE_PHASE.WAITING) {
      const owed = owedNow();
      if (!owed) return;
      if (!canShowNow(latest.current)) {
        waitForPaywall();
        return;
      }
      phase = GATE_PHASE.DECIDING;
      void resolveWhatsNewArm().then(({ arm, source }) => {
        trackEvent(AnalyticsEvent.WHATS_NEW_ELIGIBLE, {
          version: owed.release.version,
          arm,
          arm_source: source,
          pages: owed.pages.length,
          source: WHATS_NEW_SOURCE.AUTO,
        });
        if (arm === WHATS_NEW_ARM.HOLDOUT) {
          useWhatsNewStore.getState().markReleaseSeen(owed.release.version, owed.release.features);
          phase = GATE_PHASE.DONE;
          return;
        }
        phase = GATE_PHASE.SHOWING;
        requestRecheck();
      });
      return;
    }

    if (!canShowNow(latest.current)) {
      waitForPaywall();
      return;
    }
    phase = GATE_PHASE.SCHEDULED;
    // Not cleared on unmount: StrictMode's re-mount must not schedule a second push.
    setTimeout(() => {
      if (!owedNow()) {
        phase = GATE_PHASE.DONE;
        return;
      }
      if (!canShowNow(latest.current)) {
        phase = GATE_PHASE.SHOWING;
        waitForPaywall();
        return;
      }
      phase = GATE_PHASE.DONE;
      router.push(WHATS_NEW_AUTO_HREF);
    }, WHATS_NEW_TIMING.SHOW_DELAY_MS);
  }, [
    isLoading,
    session,
    onboardingCompleted,
    segments,
    rideStatus,
    awaitingGarageCta,
    carPlayConnected,
    phoneSceneVisible,
    lastSeenVersion,
    recheck,
    router,
  ]);
}
