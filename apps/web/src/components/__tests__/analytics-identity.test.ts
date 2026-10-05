// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

type Session = { user: { id: string; user_metadata?: Record<string, unknown> } };
type AuthCallback = (event: string, session: Session | null) => void;

const identifyUser = vi.fn();
const resetUser = vi.fn();
const unsubscribe = vi.fn();
const getDistinctId = vi.fn();
let consent: boolean | null = true;
/** What the shared cookie holds as an explicit choice; undefined = same as `consent`. */
let cookieChoice: boolean | null | undefined;
const updateUser = vi.fn().mockResolvedValue({ error: null });
let authCallbacks: AuthCallback[] = [];

vi.mock('posthog-js', () => ({ default: { get_distinct_id: () => getDistinctId() } }));
vi.mock('@/lib/analytics', () => ({
  identifyUser: (...args: unknown[]) => identifyUser(...args),
  resetUser: () => resetUser(),
}));
vi.mock('@/components/cookie-consent', () => ({
  useCookieConsent: () => ({ consent }),
  readExplicitConsent: () => (cookieChoice === undefined ? consent : cookieChoice),
}));
vi.mock('@/lib/supabase-browser', () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      onAuthStateChange: (cb: AuthCallback) => {
        authCallbacks.push(cb);
        return { data: { subscription: { unsubscribe } } };
      },
      updateUser: (...args: unknown[]) => updateUser(...args),
    },
  }),
}));

const { AnalyticsIdentity } = await import('../analytics-identity');

const session = (id: string, user_metadata?: Record<string, unknown>): Session => ({
  user: { id, user_metadata },
});

/** Delivers an auth event to every subscriber, as Supabase does. */
const emit = (event: string, value: Session | null) => {
  for (const cb of authCallbacks) cb(event, value);
};

// React warns when act() is used without this flag outside a test renderer.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(): Root {
  const root = createRoot(document.createElement('div'));
  act(() => root.render(createElement(AnalyticsIdentity)));
  return root;
}

afterEach(() => {
  vi.clearAllMocks();
  consent = true;
  cookieChoice = undefined;
  authCallbacks = [];
  vi.useRealTimers();
});

describe('AnalyticsIdentity', () => {
  it('does nothing until analytics consent is granted', () => {
    consent = null;
    render();
    expect(authCallbacks).toHaveLength(0);
  });

  it('identifies a signed-in user once, not again for the same id', () => {
    getDistinctId.mockReturnValue('anon-1');
    render();
    emit('INITIAL_SESSION', session('user-a'));
    expect(identifyUser).toHaveBeenCalledWith('user-a');

    getDistinctId.mockReturnValue('user-a');
    emit('TOKEN_REFRESHED', session('user-a'));
    expect(identifyUser).toHaveBeenCalledTimes(1);
  });

  it('resets on sign-out but never on an anonymous page load', () => {
    render();
    emit('INITIAL_SESSION', null);
    expect(resetUser).not.toHaveBeenCalled();

    emit('SIGNED_IN', session('user-a'));
    emit('SIGNED_OUT', null);
    expect(resetUser).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes on unmount', () => {
    const root = render();
    act(() => root.unmount());
    expect(unsubscribe).toHaveBeenCalledTimes(authCallbacks.length);
  });
});

describe('AnalyticsIdentity — account consent sync', () => {
  /** Render, deliver one auth event, run the deferred write and drain the write queue. */
  const run = async (event: string, value: Session | null) => {
    vi.useFakeTimers();
    render();
    emit(event, value);
    vi.runAllTimers();
    for (let i = 0; i < 5; i++) await Promise.resolve();
  };

  it('saves a declined banner on a signed-in account that still says yes', async () => {
    consent = false;
    updateUser.mockResolvedValue({ error: null });
    await run('INITIAL_SESSION', session('user-a', { analytics_consent: true }));
    expect(updateUser).toHaveBeenCalledWith({ data: { analytics_consent: false } });
  });

  it('saves the decision for an OAuth account with no metadata decision', async () => {
    consent = true;
    updateUser.mockResolvedValue({ error: null });
    await run('SIGNED_IN', session('user-a', {}));
    expect(updateUser).toHaveBeenCalledWith({ data: { analytics_consent: true } });
  });

  it('does not write when the account already matches', async () => {
    consent = false;
    await run('INITIAL_SESSION', session('user-a', { analytics_consent: false }));
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('does not write when signed out', async () => {
    consent = false;
    await run('INITIAL_SESSION', null);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('does not write (or subscribe) when the visitor has not decided', async () => {
    consent = null;
    await run('INITIAL_SESSION', session('user-a', { analytics_consent: true }));
    expect(authCallbacks).toHaveLength(0);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('never reacts to USER_UPDATED (broadcast to every tab), whatever the metadata says', async () => {
    consent = false;
    await run('USER_UPDATED', session('user-a', { analytics_consent: true }));
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('a stale tab writes the shared cookie’s answer, not the one it captured', async () => {
    // This tab still holds "yes" in memory; another tab changed the cookie to "no".
    consent = true;
    cookieChoice = false;
    await run('SIGNED_IN', session('user-a', { analytics_consent: false }));
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('background sync never turns a stored "no" into "yes" (stale or shared browser)', async () => {
    consent = true;
    await run('INITIAL_SESSION', session('user-a', { analytics_consent: false }));
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('never writes the automatic grant outside the EU (implied, not chosen)', async () => {
    consent = true;
    cookieChoice = null;
    await run('INITIAL_SESSION', session('user-a', {}));
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('a change of decision cancels a write still queued for the old one (Undo race)', async () => {
    vi.useFakeTimers();
    consent = true;
    const root = render();
    emit('INITIAL_SESSION', session('user-a', {}));
    // Undo before the deferred write runs: the effect re-runs with no decision.
    consent = null;
    act(() => root.render(createElement(AnalyticsIdentity)));
    vi.runAllTimers();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('swallows a failed write', async () => {
    consent = false;
    updateUser.mockRejectedValue(new Error('network'));
    await expect(run('INITIAL_SESSION', session('user-a', {}))).resolves.toBeUndefined();
    expect(updateUser).toHaveBeenCalledTimes(1);
  });
});
