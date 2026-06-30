// CarPlay coordinator — the JS side of the command + projection head.
// On connect it renders the live-ride panel from the ride store and keeps it
// updated: state-indicator transitions push immediately, numeric metric churn is
// coalesced to >=10s (Apple's CPInformationTemplate refresh limit). Head-unit
// actions route into the ride engine. The CarPlay process holds no ride truth.
//
// Started once on app init (src/app/_layout.tsx). No-ops when the native module
// is absent (Android / pre-CarPlay build).

import { router } from 'expo-router';
import {
  addConnectListener,
  addDisconnectListener,
  type CarPlaySubscription,
  clearInformation,
  isCarPlayAvailable,
  isHeadUnitConnected,
  renderInformation,
  setActionDispatcher,
} from '../../../modules/carplay/src';
import { captureException } from '../../lib/analytics';
import { useAuthStore } from '../../stores/auth.store';
import { useCarPlayStore } from '../../stores/carplay.store';
import { useRideStore } from '../../stores/ride.store';
import {
  buildRideSummaryHref,
  elapsedRideSeconds,
  endRideSession,
  startRideSession,
} from '../ride/ride-controller';
import {
  buildPanelItems,
  CARPLAY_ACTION,
  type CarPlayPanelState,
  deriveSnapshot,
  type RideInput,
} from './carplay-templates';

const THROTTLE_MS = 10_000;

let started = false;
const eventSubs: CarPlaySubscription[] = [];
let unsubStore: (() => void) | null = null;
let lastState: CarPlayPanelState | null = null;
let lastPushAt = 0;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function clearFlush(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}

function currentRideInput(): RideInput {
  const r = useRideStore.getState();
  // Derive elapsed from the persisted start timestamp rather than the store's
  // elapsedTime, which is only advanced by the HUD's interval timer (absent when
  // the app is backgrounded / the HUD unmounted while riding with CarPlay). This
  // keeps the panel's clock correct off GPS-driven renders without a JS timer.
  const elapsed = elapsedRideSeconds();
  return {
    status: r.status,
    recordingSubState: r.recordingSubState,
    distance: r.distance,
    elapsedTime: elapsed,
    elevationGain: r.elevationGain,
    speed: r.currentSpeed,
    // TODO(carplay): replace with a real GPS-lock signal (parent open question).
    // Proxy: treat the ride as locked once any distance/time has accrued.
    gpsLocked: r.distance > 0 || elapsed > 3,
    startMode: useCarPlayStore.getState().startMode,
  };
}

function render(now: number = Date.now()): void {
  const system = useAuthStore.getState().measurementSystem ?? 'metric';
  const snap = deriveSnapshot(currentRideInput(), system);
  const model = buildPanelItems(snap);

  if (snap.state !== lastState) {
    // State transition — render immediately (title + available actions change, so
    // the adapter rebuilds + re-pushes), exempt from the throttle so the panel
    // never lags the rider's cue.
    clearFlush();
    renderInformation(model);
    lastState = snap.state;
    lastPushAt = now;
    return;
  }
  if (now - lastPushAt >= THROTTLE_MS) {
    // Same state, numeric churn — the adapter updates the rows in place.
    clearFlush();
    renderInformation(model);
    lastPushAt = now;
    return;
  }
  // Inside the throttle window: schedule a trailing flush so the latest value
  // still lands at the window boundary even if the store stops ticking.
  if (!flushTimer) {
    flushTimer = setTimeout(
      () => {
        flushTimer = null;
        // The head unit may have disconnected while this flush was pending
        // (onDisconnect drops unsubStore). Skip the trailing render so we never
        // touch a cleared template after disconnect.
        if (!unsubStore) return;
        render();
      },
      THROTTLE_MS - (now - lastPushAt),
    );
  }
}

function onConnect(): void {
  const system = useAuthStore.getState().measurementSystem ?? 'metric';
  const snap = deriveSnapshot(currentRideInput(), system);
  clearInformation(); // ensure the next render builds a fresh root template
  renderInformation(buildPanelItems(snap)); // projection, not start
  lastState = snap.state;
  lastPushAt = Date.now();
  // Idempotent: onConnect can fire more than once without an intervening
  // disconnect (scene attach + an already-connected unit on cold start). Drop any
  // prior subscription so exactly one stays live.
  unsubStore?.();
  unsubStore = useRideStore.subscribe(() => render());
}

function onDisconnect(): void {
  clearFlush();
  unsubStore?.();
  unsubStore = null;
  clearInformation();
  lastState = null;
}

function onAction(actionId: string): void {
  const ride = useRideStore.getState();
  switch (actionId) {
    case CARPLAY_ACTION.pause:
      ride.pauseRide();
      break;
    case CARPLAY_ACTION.resume:
      ride.resumeRide();
      break;
    case CARPLAY_ACTION.start:
      // CarPlay-initiated rides are Quick Rides — there's no bike picker on the
      // head unit. Routes through the shared controller so the GPS/background
      // listener, MMKV, and server sync all start exactly as a phone-started ride.
      // The result is async: surface a denied/gps_failed outcome (otherwise the
      // rider presses Start and nothing happens, with no Sentry signal) and render
      // off the resolved state — the store subscription also re-renders on success.
      startRideSession({ motorcycleId: null, source: 'carplay' })
        .then((result) => {
          if (!result.ok) {
            captureException(new Error(`CarPlay start failed: ${result.reason}`), {
              source: 'carplay-coordinator.start',
            });
          }
          render(Date.now());
        })
        .catch((err) => captureException(err, { source: 'carplay-coordinator.start' }));
      return; // async path owns its own render; skip the synchronous one below
    case CARPLAY_ACTION.stop: {
      // End through the shared controller, then route the phone to the same
      // ride-summary the phone HUD uses — so a CarPlay Stop and a phone End land on
      // the identical summary (which owns ride-data cleanup). Guarded: the phone may
      // be backgrounded with no live navigator. endRideSession returns null on a
      // double-Stop (already ended), so a second press is a no-op (no duplicate end).
      const summary = endRideSession('carplay');
      if (summary) {
        try {
          router.replace(buildRideSummaryHref(summary));
        } catch (err) {
          captureException(err, { source: 'carplay-coordinator.stop.navigate' });
        }
      }
      break;
    }
  }
  render(Date.now()); // reflect the new state immediately
}

export function startCarPlayCoordinator(): void {
  if (started || !isCarPlayAvailable) return;
  started = true;
  setActionDispatcher(onAction);
  const c = addConnectListener(onConnect);
  const d = addDisconnectListener(onDisconnect);
  for (const s of [c, d]) if (s) eventSubs.push(s);
  if (isHeadUnitConnected()) onConnect(); // catch an already-connected head unit
}

// Test-only reset.
export function __resetCarPlayCoordinator(): void {
  started = false;
  clearFlush();
  unsubStore?.();
  unsubStore = null;
  clearInformation();
  for (const s of eventSubs) s.remove();
  eventSubs.length = 0;
  lastState = null;
  lastPushAt = 0;
}
