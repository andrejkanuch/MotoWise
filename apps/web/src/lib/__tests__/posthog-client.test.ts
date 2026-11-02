// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The consent-gated lazy loader (lib/posthog-client.ts): calls made before the
// SDK is in wait in a bounded queue, run in order right after init, and are dropped
// on a "no". The consent tests below
// hold the posthog-js import open to cover the window a first-time visitor sees.

const optIn = vi.fn();
const optOut = vi.fn();
const capture = vi.fn();
const sdk = {
  init: vi.fn(),
  set_config: vi.fn(),
  opt_in_capturing: (...args: unknown[]) => optIn(...args),
  opt_out_capturing: (...args: unknown[]) => optOut(...args),
  capture: (...args: unknown[]) => capture(...args),
  register: vi.fn(),
  setPersonProperties: vi.fn(),
  get_property: vi.fn(),
};

/** The posthog-js import resolves only when the test calls `release()`. */
let gate: Promise<void> = Promise.resolve();
let release: () => void = () => {};

function holdImport() {
  gate = new Promise<void>((resolve) => {
    release = resolve;
  });
}

vi.mock('posthog-js', async () => {
  await gate;
  return { default: sdk };
});

vi.mock('@/lib/supabase-browser', () => ({
  getSupabaseBrowserClient: () => ({
    auth: { getUser: vi.fn(), updateUser: vi.fn() },
  }),
}));

async function settle() {
  await vi.dynamicImportSettled();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  gate = Promise.resolve();
  for (const name of ['mv_region', 'mv_consent']) {
    // biome-ignore lint/suspicious/noDocumentCookie: resetting the test's cookies
    document.cookie = `${name}=; path=/; max-age=0`;
  }
});

describe('posthog-client queue', () => {
  it('runs calls made before the SDK loads, in order, once it loads', async () => {
    const { loadPostHog, withPostHog, getPostHog } = await import('../posthog-client');
    const order: string[] = [];
    withPostHog(() => order.push('a'));
    withPostHog(() => order.push('b'));
    expect(getPostHog()).toBeNull();
    expect(order).toEqual([]);

    await loadPostHog();
    expect(order).toEqual(['a', 'b']);
    withPostHog(() => order.push('c'));
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('keeps at most 50 queued calls', async () => {
    const { loadPostHog, withPostHog } = await import('../posthog-client');
    const ran = vi.fn();
    for (let i = 0; i < 51; i++) withPostHog(ran);
    await loadPostHog();
    expect(ran).toHaveBeenCalledTimes(50);
  });

  it('runs nothing that was queued before a "no"', async () => {
    const { loadPostHog, withPostHog, dropQueuedPostHogCalls } = await import('../posthog-client');
    const ran = vi.fn();
    withPostHog(ran);
    dropQueuedPostHogCalls();
    await loadPostHog();
    expect(ran).not.toHaveBeenCalled();
  });

  it('a throwing queued call does not stop the ones after it', async () => {
    const { loadPostHog, withPostHog } = await import('../posthog-client');
    const after = vi.fn();
    withPostHog(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    withPostHog(after);
    await loadPostHog();
    expect(after).toHaveBeenCalledTimes(1);
  });
});

describe('applyPostHogConsent before the SDK has loaded', () => {
  it('opts in once the SDK arrives for a "yes"', async () => {
    holdImport();
    const { applyPostHogConsent } = await import('@/components/cookie-consent');
    applyPostHogConsent(true, { announce: true });
    expect(optIn).not.toHaveBeenCalled();

    release();
    await settle();
    expect(optIn).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith('$consent_granted');
  });

  it('an Undo made while the SDK downloads wins over the earlier Accept', async () => {
    holdImport();
    const { applyPostHogConsent } = await import('@/components/cookie-consent');
    applyPostHogConsent(true, { announce: true });
    applyPostHogConsent(false);

    release();
    await settle();
    expect(optIn).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
    expect(optOut).toHaveBeenCalledTimes(1);
  });

  it('accept, undo, accept again while loading opts in exactly once', async () => {
    holdImport();
    const { applyPostHogConsent } = await import('@/components/cookie-consent');
    applyPostHogConsent(true, { announce: true });
    applyPostHogConsent(false);
    applyPostHogConsent(true, { announce: true });

    release();
    await settle();
    expect(optIn).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(optOut).not.toHaveBeenCalled();
  });
});

describe('consent gate', () => {
  it('a "no" never downloads the SDK', async () => {
    const { applyPostHogConsent } = await import('@/components/cookie-consent');
    const { getPostHog } = await import('../posthog-client');
    applyPostHogConsent(false);
    await settle();
    expect(getPostHog()).toBeNull();
  });

  it('initialises opted out, with no cookie, in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { loadPostHog } = await import('../posthog-client');
    await loadPostHog();
    expect(sdk.init).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ opt_out_capturing_by_default: true, persistence: 'memory' }),
    );
    expect(optIn).not.toHaveBeenCalled();
  });

  async function mountProvider() {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { createElement } = await import('react');
    const { act } = await import('react');
    const { createRoot } = await import('react-dom/client');
    const { CookieConsentProvider } = await import('@/components/cookie-consent');
    const root = createRoot(document.createElement('div'));
    await act(async () => {
      root.render(createElement(CookieConsentProvider, null, null));
    });
    await settle();
    root.unmount();
    // The loader's own module instance: non-null only once the SDK was imported.
    const { getPostHog } = await import('../posthog-client');
    return getPostHog();
  }

  it('an undecided EU visitor never downloads the SDK', async () => {
    // biome-ignore lint/suspicious/noDocumentCookie: the proxy's region cookie
    document.cookie = 'mv_region=EU; path=/';
    expect(await mountProvider()).toBeNull();
    expect(optIn).not.toHaveBeenCalled();
  });

  it('a visitor with no region cookie is treated as EU', async () => {
    expect(await mountProvider()).toBeNull();
    expect(optIn).not.toHaveBeenCalled();
  });

  it('outside the EU the automatic grant loads the SDK and opts in', async () => {
    // biome-ignore lint/suspicious/noDocumentCookie: the proxy's region cookie
    document.cookie = 'mv_region=OTHER; path=/';
    expect(await mountProvider()).not.toBeNull();
    expect(optIn).toHaveBeenCalledTimes(1);
  });
});
