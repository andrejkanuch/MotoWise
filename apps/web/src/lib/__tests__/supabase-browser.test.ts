import { afterEach, describe, expect, it, vi } from 'vitest';

const createBrowserClient = vi.fn();
vi.mock('@supabase/ssr', () => ({ createBrowserClient }));

const { getSupabaseBrowserClient } = await import('../supabase-browser');

type ClientOptions = { realtime?: { transport?: new () => unknown } };

function lastOptions(): ClientOptions {
  return createBrowserClient.mock.calls.at(-1)?.[2] as ClientOptions;
}

describe('getSupabaseBrowserClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    createBrowserClient.mockClear();
  });

  it('leaves realtime on the native WebSocket when the browser has one', () => {
    vi.stubGlobal('WebSocket', class {});

    getSupabaseBrowserClient();

    expect(lastOptions()).toEqual({});
  });

  it('passes a stand-in transport when the browser exposes no WebSocket (MOTOVAULT-WEB-1X)', () => {
    vi.stubGlobal('WebSocket', undefined);

    getSupabaseBrowserClient();

    const Transport = lastOptions().realtime?.transport;
    expect(Transport).toBeDefined();
    expect(() => new (Transport as new () => unknown)()).toThrow(/not available/);
  });
});
