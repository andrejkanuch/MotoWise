// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The hook module pulls in the GraphQL + Supabase browser clients at import
// time; stub them so importing the cache helpers has no side effects.
vi.mock('@/lib/graphql-client', () => ({ gqlFetcher: vi.fn() }));
vi.mock('@/lib/supabase-browser', () => ({ getSupabaseBrowserClient: vi.fn() }));

const { CACHE_KEY, INITIAL, readCache } = await import('../use-pro-status');

const FIVE_MIN = 5 * 60 * 1000;

describe('useProStatus cache (readCache)', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('INITIAL is the loading state used for the deterministic first render', () => {
    // This is the seam that fixes React #418: server + client first render
    // both start from INITIAL, never from a sessionStorage read.
    expect(INITIAL).toEqual({
      isPro: false,
      isTrialing: false,
      trialDaysLeft: null,
      isLoading: true,
    });
  });

  it('returns null when nothing is cached', () => {
    expect(readCache()).toBeNull();
  });

  it('returns a resolved (non-loading) status for a fresh cache entry', () => {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        isPro: true,
        isTrialing: false,
        trialDaysLeft: null,
        checkedAt: Date.now(),
      }),
    );
    expect(readCache()).toEqual({
      isPro: true,
      isTrialing: false,
      trialDaysLeft: null,
      isLoading: false,
    });
  });

  it('returns null for a cache entry older than the TTL', () => {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        isPro: true,
        isTrialing: false,
        trialDaysLeft: null,
        checkedAt: Date.now() - (FIVE_MIN + 1000),
      }),
    );
    expect(readCache()).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    sessionStorage.setItem(CACHE_KEY, 'not json{');
    expect(readCache()).toBeNull();
  });

  // Structurally valid JSON that isn't the expected shape must be rejected, not
  // read as a bogus never-expiring status (Date.now() - undefined === NaN).
  it.each([
    ['a JSON primitive', 'true'],
    ['the null literal', 'null'],
    ['an array', '[]'],
    ['an object with a string checkedAt', JSON.stringify({ isPro: true, checkedAt: 'yesterday' })],
    ['an object with no checkedAt', JSON.stringify({ isPro: true })],
  ])('returns null for %s', (_label, raw) => {
    sessionStorage.setItem(CACHE_KEY, raw);
    expect(readCache()).toBeNull();
  });

  it('narrows non-boolean isPro / non-numeric trialDaysLeft to safe defaults', () => {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ isPro: 'yes', isTrialing: 1, trialDaysLeft: 'x', checkedAt: Date.now() }),
    );
    expect(readCache()).toEqual({
      isPro: false,
      isTrialing: false,
      trialDaysLeft: null,
      isLoading: false,
    });
  });
});
