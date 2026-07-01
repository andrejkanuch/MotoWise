// CarPlay coordinator — the JS side of the command + projection head.
// On connect it renders the live-ride panel from the ride store and keeps it
// updated: state-indicator transitions push immediately, numeric metric churn is
// coalesced to >=10s (Apple's CPInformationTemplate refresh limit). Head-unit
// actions route into the ride engine. The CarPlay process holds no ride truth.
//
// Started once on app init (src/app/_layout.tsx). No-ops when the native module
// is absent (Android / pre-CarPlay build).

import {
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
  setInformationLifecycle,
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
import { type BikeStatusInput, buildBikeError, buildBikeStatus } from './carplay-bike-status';
import {
  buildPanelItems,
  CARPLAY_ACTION,
  type CarPlayPanelState,
  deriveSnapshot,
  type HeadsUpTask,
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
// Bumped on every open/dismiss so an in-flight loadBikeStatus that resolves after the
// list was popped (or re-opened) is dropped instead of overwriting the current list.
let bikeLoadToken = 0;

// Cached bike/maintenance snapshot for the heads-up row (row 4 while riding). Loaded
// off the render hot path (loadHeadsUpData) and read synchronously by currentRideInput;
// defaults are the "no signal" state so the picker falls back to the climb row.
interface HeadsUpSnapshot {
  recallCount: number;
  currentMileage: number | null;
  tasks: HeadsUpTask[];
}
const EMPTY_HEADS_UP: HeadsUpSnapshot = { recallCount: 0, currentMileage: null, tasks: [] };
let headsUpSnapshot: HeadsUpSnapshot = EMPTY_HEADS_UP;
// Bumped on each load/disconnect so a heads-up fetch resolving after disconnect (or a
// newer load) is dropped instead of overwriting the current snapshot.
let headsUpToken = 0;

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
    speed: r.currentSpeed,
    // TODO(carplay): replace with a real GPS-lock signal (parent open question).
    // Proxy: treat the ride as locked once any distance/time has accrued.
    gpsLocked: r.distance > 0 || elapsed > 3,
    startMode: useCarPlayStore.getState().startMode,
    // Heads-up row inputs — populated from the cached bike/task snapshot (U3). Defaults
    // are the safe "no signal" state so the picker falls back to the climb row.
    recallCount: headsUpSnapshot.recallCount,
    currentMileage: headsUpSnapshot.currentMileage,
    tasks: headsUpSnapshot.tasks,
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
  };
}

function openBikeList(): void {
  disarmStop(); // never carry an armed-stop under the list (its confirm can't render)
  bikeVisible = true; // suppress ride-panel root touches until the list pops (KTD5)
  bikeLoadToken++;
  const system = useAuthStore.getState().measurementSystem ?? 'metric';
  pushBikeList(buildBikeStatus(syncBikeInput(), system), {
    onWillAppear: () => {
      void loadBikeStatus();
    },
    onPopped: onBikeListDismissed,
  });
}

/** Load-on-entry: cache-first active bike, then fetch tasks; honors R20. */
async function loadBikeStatus(): Promise<void> {
  const token = bikeLoadToken;
  // Drop a resolved load whose list was popped or re-opened while we were fetching.
  const stale = () => token !== bikeLoadToken || !bikeVisible;
  try {
    const system = useAuthStore.getState().measurementSystem ?? 'metric';
    if (rideIsMoving()) {
      if (!stale()) {
        updateBikeList(buildBikeStatus({ moving: true, bike: null, tasks: [] }, system));
      }
      return;
    }
    let cache = queryClient.getQueryData<MyMotorcyclesQuery>(queryKeys.motorcycles.all);
    if (!cache) cache = await gqlFetcher(MyMotorcyclesDocument);
    const active = activeBikeFrom(cache);
    if (!active) {
      if (!stale()) {
        updateBikeList(buildBikeStatus({ moving: false, bike: null, tasks: [] }, system));
      }
      return;
    }
    const tasksRes = await gqlFetcher(MaintenanceTasksByMotorcycleDocument, {
      motorcycleId: active.id,
    });
    if (stale()) return;
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
        },
        system,
      ),
    );
  } catch (err) {
    captureException(err, { source: 'carplay-coordinator.loadBikeStatus' });
    // Show a recoverable error row rather than leaving the sync placeholder — a
    // transient auth/network failure on a cold headless launch is otherwise silent.
    if (!stale()) updateBikeList(buildBikeError());
  }
}

/**
 * Load the active bike's open-recall count + maintenance tasks for the heads-up row
 * (row 4 while riding), cache-first. Runs off the render hot path (onConnect), writes
 * the result to headsUpSnapshot, then re-renders so the row reflects it. Token-guarded
 * against a disconnect / newer load resolving late. Never throws into render — a failure
 * leaves the last-good snapshot and the picker degrades to the climb row.
 */
async function loadHeadsUpData(): Promise<void> {
  const token = ++headsUpToken;
  const stale = () => token !== headsUpToken;
  try {
    let cache = queryClient.getQueryData<MyMotorcyclesQuery>(queryKeys.motorcycles.all);
    if (!cache) cache = await gqlFetcher(MyMotorcyclesDocument);
    const active = activeBikeFrom(cache);
    if (stale()) return;
    if (!active) {
      headsUpSnapshot = EMPTY_HEADS_UP;
      return;
    }
    const tasksRes = await gqlFetcher(MaintenanceTasksByMotorcycleDocument, {
      motorcycleId: active.id,
    });
    if (stale()) return;
    headsUpSnapshot = {
      recallCount: active.recallCount ?? 0,
      currentMileage: active.currentMileage ?? null,
      tasks: (tasksRes.maintenanceTasks ?? []).map((t) => ({
        title: t.title,
        status: t.status,
        dueDate: t.dueDate,
        targetMileage: t.targetMileage,
      })),
    };
    // One-shot load, not per-tick churn — push now (bypass the throttle) so the row
    // reflects promptly. Same state → renderInformation updates rows in place, no rebuild.
    forceRender();
  } catch (err) {
    // Leave the last-good snapshot; the picker falls back to the climb row.
    captureException(err, { source: 'carplay-coordinator.loadHeadsUpData' });
  }
}

/**
 * The Bike list is gone — stop suppressing the Ride panel. Idempotent: both dismissal
 * signals (programmatic onPopped and the root-panel reappear that catches the native
 * back button) route here, and both can fire for a single programmatic pop.
 */
function clearBikeCovering(): void {
  if (!bikeVisible) return;
  bikeVisible = false;
  bikeLoadToken++; // invalidate any in-flight load
  // Rebuild if a ride state transition was missed while covered (lastState is
  // stale), otherwise refresh the rows with current values.
  render();
}

// Fired via the list's onPopped — a programmatic pop (onDisconnect's popBikeList) or
// a push rejected before it ever appeared (adapter onGone recovery).
function onBikeListDismissed(): void {
  clearBikeCovering();
}

// Fired via the root panel's onDidAppear — the list left the stack and the Ride panel
// is topmost again. This is what catches the native CarPlay BACK button, which never
// fires the list's onPopped; without it a back-button dismiss strands bikeVisible=true
// and freezes the panel + kills every ride-control action (pause/resume/stop/start).
function onRidePanelReappeared(): void {
  clearBikeCovering();
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
  // Warm the heads-up snapshot off the render path (cache-first). Fire-and-forget:
  // currentRideInput reads whatever is cached; the load re-renders when it lands.
  void loadHeadsUpData();
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
  // Drop the cached heads-up data + invalidate any in-flight load for the next session.
  headsUpSnapshot = EMPTY_HEADS_UP;
  headsUpToken++;
}

function onAction(actionId: string): void {
  // While the Bike list covers the Ride panel, none of the ride-control buttons are
  // on screen — ignore any late/queued press so a ride can't be mutated (or ended)
  // from behind the list. The list's own back button is native, not an action.
  if (bikeVisible) return;
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
  // Root-panel reappear is the reliable "Bike list dismissed" signal (covers the
  // native back button, which the list's onPopped does not) — see onRidePanelReappeared.
  setInformationLifecycle({ onDidAppear: onRidePanelReappeared });
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
  setInformationLifecycle({});
  bikeVisible = false;
  unsubStore?.();
  unsubStore = null;
  clearInformation();
  for (const s of eventSubs) s.remove();
  eventSubs.length = 0;
  lastState = null;
  lastPushAt = 0;
  headsUpSnapshot = EMPTY_HEADS_UP;
  headsUpToken = 0;
}
