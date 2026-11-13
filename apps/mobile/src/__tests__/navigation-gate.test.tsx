/**
 * issue 365 T14 (FS-OB1e): a rider who finished onboarding must not be routed
 * back into it on a cold start, whatever the persisted `me` cache says.
 *
 * Rendering the root layout in Jest is impractical (auth, RevenueCat, PostHog,
 * notifications, deep links; see sign-out-reset-contract.test.ts), so this
 * drives the same inputs the root NavigationGate reads: the auth store across a
 * simulated cold start (persisted MMKV blob → fresh store → rehydrate → the auth
 * listener's setSession) and the `me` preferences, combined exactly as the gate
 * combines them. A source check pins the gate to that combination.
 *
 * The file lives outside `app/`: Expo Router treats every file under `app/` as a
 * route, test files included.
 */
jest.mock('react-native-mmkv', () => require('../test/mocks').makeMmkvMock());
jest.mock('../lib/analytics', () => require('../test/mocks').mockAnalytics());
jest.mock('../i18n', () => ({
  __esModule: true,
  default: { changeLanguage: jest.fn() },
  applyLocalePreference: jest.fn(),
}));
jest.mock('expo-localization', () => ({ getLocales: () => [{ measurementSystem: 'metric' }] }));
jest.mock('../../modules/app-locale', () => ({
  isAppLocaleSupported: () => false,
  getAppLocales: () => [],
  setAppLocales: jest.fn(),
}));

import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Session } from '@supabase/supabase-js';
import { createZustandMMKVStorage } from '../lib/mmkv-storage';
import { isServerOnboardingComplete } from '../lib/onboarding-paywall';
import { useAuthStore } from '../stores/auth.store';

const STORE_KEY = 'auth-preferences';
const storage = createZustandMMKVStorage(STORE_KEY);

const sessionFor = (id: string) => ({ access_token: 't', user: { id } }) as unknown as Session;

type MePreferences = { onboardingCompleted?: boolean } | null | undefined;
const GATE = { TABS: 'tabs', ONBOARDING: 'onboarding' } as const;

/** The root gate's signed-in branch: `(tabs)` when onboarding counts as completed. */
function gateGroup(preferences: MePreferences) {
  const { session, onboardingCompleted } = useAuthStore.getState();
  if (!session) throw new Error('gateGroup expects a signed-in rider');
  const completed = onboardingCompleted || isServerOnboardingComplete(preferences, false);
  return completed ? GATE.TABS : GATE.ONBOARDING;
}

/** Kill the app: only what was persisted survives; the auth listener replays the session. */
async function coldStart(sessionUserId: string | null) {
  const persisted = storage.getItem(STORE_KEY);
  useAuthStore.setState(useAuthStore.getInitialState(), true);
  if (persisted === null) storage.removeItem(STORE_KEY);
  else storage.setItem(STORE_KEY, persisted);
  await useAuthStore.persist.rehydrate();
  useAuthStore.getState().setSession(sessionUserId ? sessionFor(sessionUserId) : null);
}

/** Sign in as `userId` and tap "Open my garage" (personalizing's completion trigger). */
function completeOnboardingAs(userId: string) {
  useAuthStore.getState().setSession(sessionFor(userId));
  useAuthStore.getState().setOnboardingCompleted(true);
}

beforeEach(() => {
  useAuthStore.setState(useAuthStore.getInitialState(), true);
  storage.removeItem(STORE_KEY);
});

describe('NavigationGate onboarding completion across a cold start (FS-OB1e)', () => {
  it('opens the tabs from the local flag even when the cached `me` still says not completed', async () => {
    completeOnboardingAs('u1');
    await coldStart('u1');

    expect(useAuthStore.getState().onboardingCompleted).toBe(true);
    expect(gateGroup({ onboardingCompleted: false })).toBe(GATE.TABS);
  });

  it('opens the tabs when `me` from the network says completed (no local flag)', async () => {
    await coldStart('u1');

    expect(gateGroup({ onboardingCompleted: true })).toBe(GATE.TABS);
  });

  it('routes to onboarding when `me` failed and there is no local flag', async () => {
    await coldStart('u1');

    expect(gateGroup(undefined)).toBe(GATE.ONBOARDING);
  });

  it("ignores another rider's flag on this install", async () => {
    completeOnboardingAs('u1');
    await coldStart('u2');

    expect(useAuthStore.getState().onboardingCompleted).toBe(false);
    expect(gateGroup({ onboardingCompleted: false })).toBe(GATE.ONBOARDING);
    // The user change clears it: u1 signing back in later relies on `me`.
    expect(useAuthStore.getState().onboardingCompletedForUserId).toBeNull();
  });

  it('clears the flag on sign-out', async () => {
    completeOnboardingAs('u1');
    useAuthStore.getState().setSession(null);
    await coldStart('u1');

    expect(useAuthStore.getState().onboardingCompleted).toBe(false);
    expect(gateGroup({ onboardingCompleted: false })).toBe(GATE.ONBOARDING);
  });

  it('records the flag when the server confirms completion (the gate sync)', async () => {
    useAuthStore.getState().setSession(sessionFor('u1'));
    // NavigationGate's "sync server state to store" effect.
    useAuthStore.getState().setOnboardingCompleted(true);
    await coldStart('u1');

    expect(gateGroup(undefined)).toBe(GATE.TABS);
  });
});

describe('NavigationGate source', () => {
  const layout = readFileSync(path.join(__dirname, '..', 'app', '_layout.tsx'), 'utf8');

  it('combines the store flag and the server flag the way gateGroup does', () => {
    expect(layout).toContain(
      'const onboardingCompleted = storeOnboardingCompleted || serverOnboardingCompleted;',
    );
    expect(layout).toContain('<Stack.Protected guard={isSignedIn && onboardingCompleted}>');
  });
});
