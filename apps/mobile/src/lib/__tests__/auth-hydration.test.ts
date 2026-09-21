import {
  APP_STATE_ACTIVE,
  AUTH_HYDRATION,
  AUTH_HYDRATION_TIMEOUT_MS,
  type AuthGateInput,
  SPLASH_FAILSAFE_MS,
  shouldRenderAuthGroup,
  shouldRenderRestoring,
  shouldReportHydrationTimeout,
  splashFailsafeOutlastsHydration,
} from '../auth-hydration';

function gate(overrides: Partial<AuthGateInput> = {}): AuthGateInput {
  return {
    isSignedIn: false,
    isAnonOnboarding: false,
    hydration: AUTH_HYDRATION.RESOLVED,
    ...overrides,
  };
}

const ALL_HYDRATION_STATES = [
  AUTH_HYDRATION.PENDING,
  AUTH_HYDRATION.RESOLVED,
  AUTH_HYDRATION.UNRESOLVED,
] as const;

describe('shouldRenderAuthGroup', () => {
  // THE REGRESSION ASSERTION. On `main` the guard was `!isSignedIn &&
  // !isAnonOnboarding`, which is unconditionally true here — so a rider whose
  // Keychain read simply had not finished was routed to /login. A timeout is an
  // unanswered question, not an answer.
  it('does NOT render the login group when hydration is UNRESOLVED', () => {
    expect(shouldRenderAuthGroup(gate({ hydration: AUTH_HYDRATION.UNRESOLVED }))).toBe(false);
  });

  it('does NOT render the login group while hydration is still PENDING', () => {
    expect(shouldRenderAuthGroup(gate({ hydration: AUTH_HYDRATION.PENDING }))).toBe(false);
  });

  it('renders the login group for a genuinely signed-out user (RESOLVED null session)', () => {
    expect(shouldRenderAuthGroup(gate({ hydration: AUTH_HYDRATION.RESOLVED }))).toBe(true);
  });

  it.each(
    ALL_HYDRATION_STATES,
  )('never renders the login group when signed in (%s)', (hydration) => {
    expect(shouldRenderAuthGroup(gate({ isSignedIn: true, hydration }))).toBe(false);
  });

  it.each(
    ALL_HYDRATION_STATES,
  )('never renders the login group during anonymous onboarding (%s)', (hydration) => {
    expect(shouldRenderAuthGroup(gate({ isAnonOnboarding: true, hydration }))).toBe(false);
  });
});

describe('shouldRenderRestoring', () => {
  it('renders only when hydration is UNRESOLVED and nobody is signed in', () => {
    expect(shouldRenderRestoring(gate({ hydration: AUTH_HYDRATION.UNRESOLVED }))).toBe(true);
  });

  it('does not render while PENDING — the splash is still the right surface', () => {
    expect(shouldRenderRestoring(gate({ hydration: AUTH_HYDRATION.PENDING }))).toBe(false);
  });

  it('does not render once hydration is RESOLVED', () => {
    expect(shouldRenderRestoring(gate({ hydration: AUTH_HYDRATION.RESOLVED }))).toBe(false);
  });

  it.each(ALL_HYDRATION_STATES)('does not render when signed in (%s)', (hydration) => {
    expect(shouldRenderRestoring(gate({ isSignedIn: true, hydration }))).toBe(false);
  });

  it.each(ALL_HYDRATION_STATES)('does not render during anonymous onboarding (%s)', (hydration) => {
    expect(shouldRenderRestoring(gate({ isAnonOnboarding: true, hydration }))).toBe(false);
  });
});

describe('gate mutual exclusion', () => {
  // The two predicates drive two different render branches in NavigationGate.
  // If both could be true the restoring screen would shadow a legitimate login
  // screen (or vice versa) depending on statement order.
  it('never reports both "render login" and "render restoring" for the same input', () => {
    for (const hydration of ALL_HYDRATION_STATES) {
      for (const isSignedIn of [true, false]) {
        for (const isAnonOnboarding of [true, false]) {
          const input = gate({ hydration, isSignedIn, isAnonOnboarding });
          expect(shouldRenderAuthGroup(input) && shouldRenderRestoring(input)).toBe(false);
        }
      }
    }
  });
});

describe('shouldReportHydrationTimeout', () => {
  it('reports when still loading AND app is foregrounded (active)', () => {
    expect(shouldReportHydrationTimeout(true, APP_STATE_ACTIVE)).toBe(true);
  });

  it('does NOT report on a background launch — the timeout fired harmlessly', () => {
    // Sentry MOTO-VAULT-REACT-NATIVE-W: iOS throttles JS in the background so
    // hydration can't resolve in wall-clock time. Not an actionable stall.
    expect(shouldReportHydrationTimeout(true, 'background')).toBe(false);
  });

  it('does NOT report when the app is inactive (transitioning)', () => {
    expect(shouldReportHydrationTimeout(true, 'inactive')).toBe(false);
  });

  it('does NOT report once hydration has completed, even in foreground', () => {
    expect(shouldReportHydrationTimeout(false, APP_STATE_ACTIVE)).toBe(false);
  });

  it('does NOT report when not loading and backgrounded', () => {
    expect(shouldReportHydrationTimeout(false, 'background')).toBe(false);
  });
});

describe('timer ordering', () => {
  // The splash failsafe hides the native splash directly, while the hydration
  // timer is what puts a real surface (SessionRestoring) on screen. If the
  // failsafe fired first the rider would get an empty root view in between —
  // which is exactly what a hardcoded 10000ms failsafe would have produced once
  // the hydration budget was raised to cover a Keychain read plus a refresh.
  it('keeps the splash failsafe strictly after the hydration timeout', () => {
    expect(splashFailsafeOutlastsHydration()).toBe(true);
    expect(SPLASH_FAILSAFE_MS).toBeGreaterThan(AUTH_HYDRATION_TIMEOUT_MS);
  });
});
