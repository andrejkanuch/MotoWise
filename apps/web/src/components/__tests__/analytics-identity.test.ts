// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

type AuthCallback = (event: string, session: { user: { id: string } } | null) => void;

const identifyUser = vi.fn();
const resetUser = vi.fn();
const unsubscribe = vi.fn();
const getDistinctId = vi.fn();
let consent: boolean | null = true;
let authCallback: AuthCallback | null = null;

vi.mock('posthog-js', () => ({ default: { get_distinct_id: () => getDistinctId() } }));
vi.mock('@/lib/analytics', () => ({
  identifyUser: (...args: unknown[]) => identifyUser(...args),
  resetUser: () => resetUser(),
}));
vi.mock('@/components/cookie-consent', () => ({ useCookieConsent: () => ({ consent }) }));
vi.mock('@/lib/supabase-browser', () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      onAuthStateChange: (cb: AuthCallback) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe } } };
      },
    },
  }),
}));

const { AnalyticsIdentity } = await import('../analytics-identity');

const session = (id: string) => ({ user: { id } });

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
  authCallback = null;
});

describe('AnalyticsIdentity', () => {
  it('does nothing until analytics consent is granted', () => {
    consent = null;
    render();
    expect(authCallback).toBeNull();
  });

  it('identifies a signed-in user once, not again for the same id', () => {
    getDistinctId.mockReturnValue('anon-1');
    render();
    authCallback?.('INITIAL_SESSION', session('user-a'));
    expect(identifyUser).toHaveBeenCalledWith('user-a');

    getDistinctId.mockReturnValue('user-a');
    authCallback?.('TOKEN_REFRESHED', session('user-a'));
    expect(identifyUser).toHaveBeenCalledTimes(1);
  });

  it('resets on sign-out but never on an anonymous page load', () => {
    render();
    authCallback?.('INITIAL_SESSION', null);
    expect(resetUser).not.toHaveBeenCalled();

    authCallback?.('SIGNED_IN', session('user-a'));
    authCallback?.('SIGNED_OUT', null);
    expect(resetUser).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes on unmount', () => {
    const root = render();
    act(() => root.unmount());
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
