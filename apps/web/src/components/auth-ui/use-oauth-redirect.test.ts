// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OAuthProvider } from './auth-ui';
import {
  OAUTH_REDIRECT_TIMEOUT_MS,
  OAUTH_STUCK_MESSAGE,
  useOAuthRedirect,
} from './use-oauth-redirect';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const GOOGLE = 'google' as OAuthProvider;
const APPLE = 'apple' as OAuthProvider;

type Hook = ReturnType<typeof useOAuthRedirect>;

let hook: Hook;
let root: Root;
const onFail = vi.fn();

function Harness() {
  hook = useOAuthRedirect(onFail);
  return null;
}

const pending = () => new Promise<{ error: null }>(() => {});

beforeEach(async () => {
  vi.useFakeTimers();
  onFail.mockReset();
  root = createRoot(document.createElement('div'));
  await act(async () => root.render(createElement(Harness)));
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
});

describe('useOAuthRedirect', () => {
  it('shows the provider as redirecting while the redirect is pending', async () => {
    await act(async () => void hook.start(GOOGLE, pending));
    expect(hook.provider).toBe(GOOGLE);
    expect(onFail).not.toHaveBeenCalled();
  });

  it('resets and reports a rider-facing message when signInWithOAuth fails', async () => {
    await act(async () =>
      hook.start(GOOGLE, async () => ({ error: { message: 'popup blocked', code: '' } })),
    );
    expect(hook.provider).toBeNull();
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(onFail.mock.calls[0][0]).toEqual(expect.any(String));
  });

  it('gives the buttons back after the timeout when the redirect never navigates', async () => {
    await act(async () => void hook.start(GOOGLE, pending));
    await act(async () => vi.advanceTimersByTime(OAUTH_REDIRECT_TIMEOUT_MS));
    expect(hook.provider).toBeNull();
    expect(onFail).toHaveBeenCalledWith(OAUTH_STUCK_MESSAGE);
  });

  it('ignores a second provider while one redirect is in flight', async () => {
    await act(async () => void hook.start(GOOGLE, pending));
    await act(async () => void hook.start(APPLE, pending));
    expect(hook.provider).toBe(GOOGLE);
  });

  it('resets when the page comes back from the back-forward cache', async () => {
    await act(async () => void hook.start(GOOGLE, pending));
    await act(async () => {
      const event = new Event('pageshow') as PageTransitionEvent;
      Object.defineProperty(event, 'persisted', { value: true });
      window.dispatchEvent(event);
    });
    expect(hook.provider).toBeNull();
    // The stuck timer was cleared with it.
    await act(async () => vi.advanceTimersByTime(OAUTH_REDIRECT_TIMEOUT_MS));
    expect(onFail).not.toHaveBeenCalled();
  });
});
