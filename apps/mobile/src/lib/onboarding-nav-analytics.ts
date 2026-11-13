import { OB_SCREEN, OB_STEP_NAME, type OnboardingRoute } from '../config/onboarding';
import { useOnboardingStore } from '../stores/onboarding.store';
import { AnalyticsEvent, trackEvent } from './analytics';
import { trackOnboardingFlowEvent } from './onboarding-analytics';
import { consumeOnboardingButtonBack } from './onboarding-back-marker';

// -------------------------------------------------------------------
// Onboarding navigation, resume and gate events (issue 365 T04b)
// -------------------------------------------------------------------
// Separates the onboarding "reset" mechanisms the funnel could not tell apart:
// back-walks (`onboarding_back`), Welcome showing again (`onboarding_welcome_mounted`),
// resume-after-kill context (`onboarding_resumed`), where the root gate sent a
// launch (`gate_routed`) and a session dropping mid-run (`auth_session_lost`).
// Step names only — never free text, email or ids. Every event goes through
// `trackEvent`, so it stays behind the analytics consent gate.
// Schema: docs/onboarding-ab-event-schema.md, "issue 365 T04b".
// -------------------------------------------------------------------

export const ONBOARDING_BACK_TRIGGER = {
  /** Android hardware or system back. */
  HARDWARE: 'hardware',
  /** iOS edge swipe (a native-stack pop). */
  GESTURE: 'gesture',
  /** The on-screen back chevron. */
  BUTTON: 'button',
} as const;
export type OnboardingBackTrigger =
  (typeof ONBOARDING_BACK_TRIGGER)[keyof typeof ONBOARDING_BACK_TRIGGER];

/** `to` of a hardware Back on the onboarding stack root: Android leaves the app. */
export const ONBOARDING_BACK_EXIT = 'exit';

export const WELCOME_MOUNT_REASON = {
  /** First Welcome mount in this JS runtime. */
  INITIAL: 'initial',
  /** Mounted by a Back from the next step (the replace fallback). */
  BACK: 'back',
  /** Mounted again in the same runtime for any other reason (RC-D). */
  REMOUNT: 'remount',
} as const;
export type WelcomeMountReason = (typeof WELCOME_MOUNT_REASON)[keyof typeof WELCOME_MOUNT_REASON];

/** Which input decided `onboardingCompleted` when the root gate first routed. */
export const ONBOARDING_COMPLETED_SOURCE = {
  /** The auth store's local flag was already true. */
  LOCAL: 'local',
  /** `me` data restored from the persisted query cache, not refetched yet. */
  ME_CACHE: 'me_cache',
  /** `me` data fetched over the network in this launch. */
  ME_NETWORK: 'me_network',
  /** Neither: no local flag and no `me` data. */
  NONE: 'none',
} as const;
export type OnboardingCompletedSource =
  (typeof ONBOARDING_COMPLETED_SOURCE)[keyof typeof ONBOARDING_COMPLETED_SOURCE];

/** The root gate's destination, matching its `Stack.Protected` groups. */
export const GATE_GROUP = {
  RESTORING: 'restoring',
  AUTH: 'auth',
  ONBOARDING: 'onboarding',
  TABS: 'tabs',
  NONE: 'none',
} as const;
export type GateGroup = (typeof GATE_GROUP)[keyof typeof GATE_GROUP];

/** React Navigation actions that move back. Forward replaces and resets are not backs. */
const BACK_ACTION = { GO_BACK: 'GO_BACK', POP: 'POP' } as const;
const BACK_ACTION_TYPES: ReadonlySet<string> = new Set(Object.values(BACK_ACTION));

/** A Welcome mount this soon after a Back to Welcome is that Back. */
const WELCOME_BACK_WINDOW_MS = 2000;
const MS_PER_SECOND = 1000;

// Module state lives for one JS runtime, which is what "per launch" means here.
let focused: { screen: string; at: number; stackIndex: number } | null = null;
let backToWelcomeAt: number | null = null;
let gateRoutedSent = false;
/**
 * When this JS runtime started. `me` data stamped before it was restored from the
 * persisted query cache; at or after it, fetched in this launch. A timestamp, not
 * `isFetchedAfterMount`: the gate's observer mounts before the async cache
 * restore, and the restore's `hydrate()` bumps `dataUpdateCount`, so restored data
 * would read as fetched after mount.
 */
let launchAt = Date.now();

function isOnboardingRoute(name: string): name is OnboardingRoute {
  return Object.hasOwn(OB_STEP_NAME, name);
}

function stepName(name: string | null): string | null {
  if (name === null) return null;
  return isOnboardingRoute(name) ? OB_STEP_NAME[name] : null;
}

function within(at: number | null, now: number, windowMs: number): boolean {
  return at !== null && now - at <= windowMs;
}

/**
 * An onboarding screen gained focus: starts its on-screen clock and persists it
 * as the last viewed step for `onboarding_resumed`.
 */
export function recordOnboardingFocus(screen: string, stackIndex: number, now = Date.now()) {
  focused = { screen, at: now, stackIndex };
  if (isOnboardingRoute(screen)) useOnboardingStore.getState().setLastViewedScreen(screen, now);
}

/** Fires `onboarding_back`. `to` is a route name, or ONBOARDING_BACK_EXIT. */
export function trackOnboardingBack(
  from: string,
  to: string,
  trigger: OnboardingBackTrigger,
  now = Date.now(),
) {
  if (to === OB_SCREEN.WELCOME) backToWelcomeAt = now;
  trackOnboardingFlowEvent(AnalyticsEvent.ONBOARDING_BACK, {
    from: stepName(from),
    to: to === ONBOARDING_BACK_EXIT ? ONBOARDING_BACK_EXIT : stepName(to),
    trigger,
    ms_on_screen: focused?.screen === from ? now - focused.at : null,
  });
}

/**
 * The chevron's fallback when there is no history to pop: it replaces `from`
 * with the previous step's path, which no `beforeRemove` reports as a back.
 */
export function trackOnboardingReplaceBack(
  from: OnboardingRoute,
  toPath: string,
  now = Date.now(),
) {
  const last = toPath.split('/').pop() ?? '';
  const to = isOnboardingRoute(last) ? last : OB_SCREEN.WELCOME;
  trackOnboardingBack(from, to, ONBOARDING_BACK_TRIGGER.BUTTON, now);
}

/**
 * `beforeRemove` on an onboarding stack screen. Only back actions count: a
 * GO_BACK is the hardware back (or the chevron, when it marked itself), a POP
 * is the iOS swipe. `to` is the screen below `from` in the stack.
 */
export function onOnboardingBeforeRemove(
  actionType: string,
  from: string,
  to: string | null,
  now = Date.now(),
) {
  if (!BACK_ACTION_TYPES.has(actionType) || to === null) return;
  let trigger: OnboardingBackTrigger =
    actionType === BACK_ACTION.POP
      ? ONBOARDING_BACK_TRIGGER.GESTURE
      : ONBOARDING_BACK_TRIGGER.HARDWARE;
  if (consumeOnboardingButtonBack(now)) trigger = ONBOARDING_BACK_TRIGGER.BUTTON;
  trackOnboardingBack(from, to, trigger, now);
}

interface StackRouteRef {
  key: string;
  name: string;
}

interface ScreenListenerProps {
  route: StackRouteRef;
  navigation: { getState: () => { routes: StackRouteRef[] } };
}

/**
 * `screenListeners` for the onboarding Stack: every focus starts the step's
 * clock, every removal is checked for a back. The stack index comes from the
 * navigator's own state, so it is right after pushes, pops and replaces.
 */
export function onboardingScreenListeners({ route, navigation }: ScreenListenerProps) {
  const position = () => {
    const { routes } = navigation.getState();
    const index = routes.findIndex((r) => r.key === route.key);
    return { index, below: index > 0 ? routes[index - 1].name : null };
  };
  return {
    focus: () => recordOnboardingFocus(route.name, position().index),
    beforeRemove: (e: { data: { action: { type: string } } }) =>
      onOnboardingBeforeRemove(e.data.action.type, route.name, position().below),
  };
}

/**
 * Android hardware back while onboarding is up. On the stack root the press
 * leaves the app (no `beforeRemove` fires), so it is recorded here as `exit`.
 * Never consumes the press.
 */
export function onOnboardingHardwareBack(now = Date.now()): boolean {
  if (focused?.stackIndex === 0) {
    trackOnboardingBack(
      focused.screen,
      ONBOARDING_BACK_EXIT,
      ONBOARDING_BACK_TRIGGER.HARDWARE,
      now,
    );
  }
  return false;
}

/** Why Welcome is mounting. `handledThisLaunch`: a Welcome already mounted in this runtime. */
export function welcomeMountReason(
  handledThisLaunch: boolean,
  now = Date.now(),
): WelcomeMountReason {
  if (!handledThisLaunch) return WELCOME_MOUNT_REASON.INITIAL;
  if (within(backToWelcomeAt, now, WELCOME_BACK_WINDOW_MS)) return WELCOME_MOUNT_REASON.BACK;
  return WELCOME_MOUNT_REASON.REMOUNT;
}

export interface WelcomeMount {
  reason: WelcomeMountReason;
  /** Any step past Welcome on record. */
  hadProgress: boolean;
}

/**
 * Welcome's mount, read at render: before the mount effect marks the launch
 * handled and before Welcome's own focus overwrites the last viewed step.
 */
export function readWelcomeMount(handledThisLaunch: boolean, now = Date.now()): WelcomeMount {
  const { lastCompletedScreen, lastViewedScreen } = useOnboardingStore.getState();
  return {
    reason: welcomeMountReason(handledThisLaunch, now),
    hadProgress:
      lastCompletedScreen !== null ||
      (lastViewedScreen !== null && lastViewedScreen !== OB_SCREEN.WELCOME),
  };
}

/** Fires `onboarding_welcome_mounted`. */
export function trackWelcomeMounted({ reason, hadProgress }: WelcomeMount) {
  trackOnboardingFlowEvent(AnalyticsEvent.ONBOARDING_WELCOME_MOUNTED, {
    reason,
    had_progress: hadProgress,
  });
}

/**
 * The T04b additions to `onboarding_resumed`, read from the persisted store
 * before Welcome's own focus overwrites the last viewed step.
 */
export function onboardingResumeContext(coldStart: boolean, hadSession: boolean, now = Date.now()) {
  const { lastViewedScreen, lastViewedAt, codeStepPending } = useOnboardingStore.getState();
  return {
    resumed_from_screen: stepName(lastViewedScreen),
    away_s: lastViewedAt === null ? null : Math.round((now - lastViewedAt) / MS_PER_SECOND),
    cold_start: coldStart,
    pending_code_step: codeStepPending ? 1 : 0,
    had_session: hadSession ? 1 : 0,
  };
}

export interface GateGroupInput {
  restoring: boolean;
  auth: boolean;
  onboarding: boolean;
  tabs: boolean;
}

/** The first `Stack.Protected` group the root gate opens, in the gate's own order. */
export function resolveGateGroup({ restoring, auth, onboarding, tabs }: GateGroupInput): GateGroup {
  if (restoring) return GATE_GROUP.RESTORING;
  if (auth) return GATE_GROUP.AUTH;
  if (onboarding) return GATE_GROUP.ONBOARDING;
  if (tabs) return GATE_GROUP.TABS;
  return GATE_GROUP.NONE;
}

export interface GateRoutedInput {
  group: GateGroup;
  storeOnboardingCompleted: boolean;
  /** `me` data present (restored from cache or fetched). */
  hasMe: boolean;
  /** `dataUpdatedAt` of `me`; 0 when there is none. Compared with the launch time. */
  meUpdatedAt: number;
}

export function onboardingCompletedSource(input: GateRoutedInput): OnboardingCompletedSource {
  if (input.storeOnboardingCompleted) return ONBOARDING_COMPLETED_SOURCE.LOCAL;
  if (!input.hasMe) return ONBOARDING_COMPLETED_SOURCE.NONE;
  return input.meUpdatedAt >= launchAt
    ? ONBOARDING_COMPLETED_SOURCE.ME_NETWORK
    : ONBOARDING_COMPLETED_SOURCE.ME_CACHE;
}

/** Fires `gate_routed` the first time the gate settles in this JS runtime; later calls no-op. */
export function trackGateRoutedOnce(input: GateRoutedInput, now = Date.now()): boolean {
  if (gateRoutedSent) return false;
  gateRoutedSent = true;
  trackEvent(AnalyticsEvent.GATE_ROUTED, {
    group: input.group,
    onboarding_completed_source: onboardingCompletedSource(input),
    me_age_s:
      input.hasMe && input.meUpdatedAt > 0
        ? Math.round((now - input.meUpdatedAt) / MS_PER_SECOND)
        : null,
  });
  return true;
}

/**
 * A signed-in session went away and local data is about to be cleared. Call
 * BEFORE `resetUser()` so the event lands on the rider's own person, and before
 * `resetForSignOut()` wipes the step it reports.
 */
export function trackAuthSessionLost(authEvent: string) {
  const { lastViewedScreen, lastCompletedScreen } = useOnboardingStore.getState();
  // Completion resets the onboarding store, and the gate clears the resume point
  // whenever it opens (tabs) (a rider who signed in from onboarding's sign-in
  // step skips completion), so any step on record means a run in progress.
  const lastStep = lastViewedScreen ?? lastCompletedScreen;
  trackEvent(AnalyticsEvent.AUTH_SESSION_LOST, {
    during_onboarding: lastStep !== null,
    last_step: stepName(lastStep),
    // Supabase's auth event: SIGNED_OUT (sign-out or a failed refresh) or
    // INITIAL_SESSION (a session revoked while the app was closed).
    auth_event: authEvent,
  });
}

/** Test-only: a fresh JS runtime, started at `startedAt`. */
export function resetOnboardingNavAnalyticsForTests(startedAt = Date.now()) {
  launchAt = startedAt;
  focused = null;
  consumeOnboardingButtonBack();
  backToWelcomeAt = null;
  gateRoutedSent = false;
}
