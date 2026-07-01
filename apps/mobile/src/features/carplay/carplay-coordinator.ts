// CarPlay coordinator — the JS side of the command + projection head.
// On connect it renders the live-ride panel from the ride store and keeps it
// updated: state-indicator transitions push immediately, numeric metric churn is
// coalesced to >=10s (Apple's CPInformationTemplate refresh limit). Head-unit
// actions route into the ride engine. The CarPlay process holds no ride truth.
//
// Started once on app init (src/app/_layout.tsx). No-ops when the native module
// is absent (Android / pre-CarPlay build).

import {
  FuelLogsDocument,
  MaintenanceTasksByMotorcycleDocument,
  MyMotorcyclesDocument,
  type MyMotorcyclesQuery,
} from '@motovault/graphql';
import { router } from 'expo-router';
import {
  addConnectListener,
  addDisconnectListener,
  type CarPlaySubscription,
  clearInformation,
  isCarPlayAvailable,
  isHeadUnitConnected,
  popBikeList,
  pushBikeList,
  renderInformation,
  setActionDispatcher,
  updateBikeList,
} from '../../../modules/carplay/src';
import { captureException } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryClient } from '../../lib/query-client';
import { queryKeys } from '../../lib/query-keys';
import { useAuthStore } from '../../stores/auth.store';
import { useCarPlayStore } from '../../stores/carplay.store';
import { useRideStore } from '../../stores/ride.store';
import {
  buildRideSummaryHref,
  elapsedRideSeconds,
  endRideSession,
  startRideSession,
} from '../ride/ride-controller';
import { type BikeStatusInput, buildBikeStatus } from './carplay-bike-status';
import {
  buildPanelItems,
  CARPLAY_ACTION,
  type CarPlayPanelState,
  deriveSnapshot,
  type RideInput,
} from './carplay-templates';

const THROTTLE_MS = 10_000;
// How long an armed Stop waits for the confirming second press before it
// auto-disarms — so a distracted rider never leaves the panel stuck on the
// confirm. Matches the design's ~5s auto-collapse for the stop guard (R17).
const STOP_CONFIRM_MS = 5_000;

let started = false;
const eventSubs: CarPlaySubscription[] = [];
let unsubStore: (() => void) | null = null;
let lastState: CarPlayPanelState | null = null;
let lastPushAt = 0;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
// Stop guard: the first Stop press arms a confirm; only a second press ends.
let stopArmed = false;
let stopArmTimer: ReturnType<typeof setTimeout> | null = null;
// True while the Bike-status list is pushed on top of the Ride panel. While set,
// the coordinator must never rebuild the root (setRootTemplate would pop the list —
// KTD5); ride-panel renders are suppressed and naturally refresh/rebuild on pop.
let bikeVisible = false;

function clearFlush(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}

function clearStopArmTimer(): void {
  if (stopArmTimer) {
    clearTimeout(stopArmTimer);
    stopArmTimer = null;
  }
}

function disarmStop(): void {
  stopArmed = false;
  clearStopArmTimer();
}

/**
 * Push the current panel immediately, bypassing the throttle. Used for arm/disarm
 * of the stop guard, where the underlying ride *state* is unchanged (so render()'s
 * state-transition fast path wouldn't fire) but the title + actions must flip now.
 */
function forceRender(now: number = Date.now()): void {
  // Never touch the root while the Bike list covers it (KTD5) — a state change is
  // picked up when the list pops (render() then sees the stale lastState).
  if (bikeVisible) return;
  clearFlush();
  const system = useAuthStore.getState().measurementSystem ?? 'metric';
  const snap = deriveSnapshot(currentRideInput(), system);
  renderInformation(buildPanelItems(snap, stopArmed));
  lastState = snap.state;
  lastPushAt = now;
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
    elevationLoss: r.elevationLoss,
    speed: r.currentSpeed,
    // TODO(carplay): replace with a real GPS-lock signal (parent open question).
    // Proxy: treat the ride as locked once any distance/time has accrued.
    gpsLocked: r.distance > 0 || elapsed > 3,
    startMode: useCarPlayStore.getState().startMode,
  };
}

function render(now: number = Date.now()): void {
  // Ride panel is covered by the Bike list — suppress all root touches (KTD5).
  // lastState is deliberately left stale so the render() fired on list-dismiss
  // detects the missed transition and rebuilds; otherwise it refreshes rows.
  if (bikeVisible) return;
  const system = useAuthStore.getState().measurementSystem ?? 'metric';
  const snap = deriveSnapshot(currentRideInput(), system);
  const model = buildPanelItems(snap, stopArmed);

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

// --- Bike-status list (pushed secondary template, depth 2) ---

function activeBikeFrom(cache: MyMotorcyclesQuery | undefined) {
  const bikes = cache?.myMotorcycles ?? [];
  return bikes.find((b) => b.isPrimary) ?? bikes[0] ?? null;
}

function rideIsMoving(): boolean {
  const r = useRideStore.getState();
  return r.status === 'recording' && r.recordingSubState === 'moving';
}

type ActiveBike = NonNullable<ReturnType<typeof activeBikeFrom>>;

function toStatusBike(b: ActiveBike): NonNullable<BikeStatusInput['bike']> {
  return {
    nickname: b.nickname,
    make: b.make,
    model: b.model,
    currentMileage: b.currentMileage,
    recallCount: b.recallCount ?? 0,
  };
}

/** Synchronous cache-only status for the initial push (enriched by loadBikeStatus). */
function syncBikeInput(): BikeStatusInput {
  const active = activeBikeFrom(
    queryClient.getQueryData<MyMotorcyclesQuery>(queryKeys.motorcycles.all),
  );
  return {
    moving: rideIsMoving(),
    bike: active ? toStatusBike(active) : null,
    tasks: [],
    latestFuel: null,
  };
}

function openBikeList(): void {
  bikeVisible = true; // suppress ride-panel root touches until the list pops (KTD5)
  const system = useAuthStore.getState().measurementSystem ?? 'metric';
  pushBikeList(buildBikeStatus(syncBikeInput(), system), {
    onWillAppear: () => {
      void loadBikeStatus();
    },
    onDidDisappear: onBikeListDismissed,
  });
}

/** Load-on-entry: cache-first active bike, then fetch tasks + fuel; honors R20. */
async function loadBikeStatus(): Promise<void> {
  try {
    const system = useAuthStore.getState().measurementSystem ?? 'metric';
    if (rideIsMoving()) {
      updateBikeList(
        buildBikeStatus({ moving: true, bike: null, tasks: [], latestFuel: null }, system),
      );
      return;
    }
    let cache = queryClient.getQueryData<MyMotorcyclesQuery>(queryKeys.motorcycles.all);
    if (!cache) cache = await gqlFetcher(MyMotorcyclesDocument);
    const active = activeBikeFrom(cache);
    if (!active) {
      updateBikeList(
        buildBikeStatus({ moving: false, bike: null, tasks: [], latestFuel: null }, system),
      );
      return;
    }
    const [tasksRes, fuelRes] = await Promise.all([
      gqlFetcher(MaintenanceTasksByMotorcycleDocument, { motorcycleId: active.id }),
      gqlFetcher(FuelLogsDocument, { motorcycleId: active.id }),
    ]);
    const fuels = [...(fuelRes.fuelLogs ?? [])].sort((a, b) =>
      b.filledAt.localeCompare(a.filledAt),
    );
    const latest = fuels[0] ?? null;
    updateBikeList(
      buildBikeStatus(
        {
          moving: false,
          bike: toStatusBike(active),
          tasks: (tasksRes.maintenanceTasks ?? []).map((t) => ({
            title: t.title,
            dueDate: t.dueDate,
            priority: t.priority,
            status: t.status,
          })),
          latestFuel: latest ? { filledAt: latest.filledAt, fuelLitres: latest.fuelLitres } : null,
        },
        system,
      ),
    );
  } catch (err) {
    captureException(err, { source: 'carplay-coordinator.loadBikeStatus' });
  }
}

function onBikeListDismissed(): void {
  bikeVisible = false;
  // Rebuild if a ride state transition was missed while covered (lastState is
  // stale), otherwise refresh the rows with current values.
  render();
}

function onConnect(): void {
  disarmStop(); // a fresh connection never inherits a stale armed-stop
  bikeVisible = false;
  const system = useAuthStore.getState().measurementSystem ?? 'metric';
  const snap = deriveSnapshot(currentRideInput(), system);
  clearInformation(); // ensure the next render builds a fresh root template
  renderInformation(buildPanelItems(snap, stopArmed)); // projection, not start
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
  disarmStop();
  popBikeList();
  bikeVisible = false;
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
    case CARPLAY_ACTION.bike:
      // Nav-bar button: push the bike-status list on top of the Ride panel.
      openBikeList();
      return;
    case CARPLAY_ACTION.cancelStop:
      // "Keep Riding" — back out of the armed confirm with no state change.
      disarmStop();
      forceRender();
      return;
    case CARPLAY_ACTION.stop: {
      // R17 stop guard: the first Stop press arms a confirm (Keep Riding / End Ride)
      // instead of ending the ride; only the second press ends it. Auto-disarms
      // after STOP_CONFIRM_MS so the panel never stays stuck on the confirm.
      if (!stopArmed) {
        stopArmed = true;
        clearStopArmTimer();
        stopArmTimer = setTimeout(() => {
          disarmStop();
          forceRender();
        }, STOP_CONFIRM_MS);
        forceRender(); // show the confirm immediately (bypass the throttle)
        return;
      }
      // Confirmed. End through the shared controller, then route the phone to the
      // same ride-summary the phone HUD uses (which owns ride-data cleanup). Guarded:
      // the phone may be backgrounded with no live navigator. endRideSession returns
      // null on a double-end (already ended), so this stays a no-op in that race.
      disarmStop();
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
  disarmStop();
  popBikeList();
  bikeVisible = false;
  unsubStore?.();
  unsubStore = null;
  clearInformation();
  for (const s of eventSubs) s.remove();
  eventSubs.length = 0;
  lastState = null;
  lastPushAt = 0;
}
