import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchProfile } from '../fetch-profile';
import { fetchRide } from '../fetch-ride';
import { fetchSharedHistory } from '../fetch-shared-history';
import { GRAPHQL_BAD_REQUEST_CODE, GRAPHQL_NOT_FOUND_CODE } from '../public-graphql';
import { isUpstreamError, settleUpstream } from '../upstream-error';

/**
 * The share pages (/rider, /ride, /u) must tell an API outage apart from a
 * missing record: `null` is "the API said no such thing" (→ 404), a thrown
 * UpstreamError is "we never got an answer" (→ "didn't load, try again").
 * Folding both into null served riders a false 404 during every API blip.
 */
function mockFetch(impl: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl));
}

const gqlError = (code: string) => ({ message: 'x', extensions: { code } });

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchProfile', () => {
  it('returns null when the API answers that the rider is absent', async () => {
    mockFetch(async () => jsonResponse({ errors: [gqlError(GRAPHQL_NOT_FOUND_CODE)], data: null }));
    await expect(fetchProfile(`absent-${Math.random()}`)).resolves.toBeNull();
  });

  it('throws UpstreamError on a resolver failure answered at HTTP 200', async () => {
    mockFetch(async () =>
      jsonResponse({ errors: [gqlError('INTERNAL_SERVER_ERROR')], data: null }),
    );
    await expect(fetchProfile(`resolver-${Math.random()}`)).rejects.toSatisfy(isUpstreamError);
  });

  it('throws UpstreamError on a 5xx', async () => {
    mockFetch(async () => jsonResponse({ errors: [{ message: 'Bad gateway' }] }, 502));
    await expect(fetchProfile(`gateway-${Math.random()}`)).rejects.toSatisfy(isUpstreamError);
  });

  it('throws UpstreamError when the network fails', async () => {
    mockFetch(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(fetchProfile(`network-${Math.random()}`)).rejects.toSatisfy(isUpstreamError);
  });
});

describe('fetchRide', () => {
  it('returns null for a private ride', async () => {
    mockFetch(async () =>
      jsonResponse({ data: { getPublicRide: { id: 'r1', isPublic: false, startedAt: '' } } }),
    );
    await expect(fetchRide(`private-${Math.random()}`)).resolves.toBeNull();
  });

  it('returns null for a malformed id the resolver rejects with BAD_REQUEST', async () => {
    mockFetch(async () =>
      jsonResponse({ errors: [gqlError(GRAPHQL_BAD_REQUEST_CODE)], data: null }),
    );
    await expect(fetchRide(`junk-${Math.random()}`)).resolves.toBeNull();
  });

  it('throws UpstreamError on an untyped GraphQL error at HTTP 200', async () => {
    mockFetch(async () => jsonResponse({ errors: [{ message: 'boom' }], data: null }));
    await expect(fetchRide(`untyped-${Math.random()}`)).rejects.toSatisfy(isUpstreamError);
  });

  it('throws UpstreamError on a timeout-shaped failure', async () => {
    mockFetch(async () => {
      throw new DOMException('timeout', 'TimeoutError');
    });
    await expect(fetchRide(`timeout-${Math.random()}`)).rejects.toSatisfy(isUpstreamError);
  });
});

describe('fetchSharedHistory', () => {
  it.each([
    GRAPHQL_NOT_FOUND_CODE,
    GRAPHQL_BAD_REQUEST_CODE,
  ])('returns null (link gone) on %s', async (code) => {
    mockFetch(async () => jsonResponse({ errors: [gqlError(code)], data: null }));
    await expect(fetchSharedHistory(`gone-${code}`)).resolves.toBeNull();
  });

  it('throws UpstreamError on a resolver failure answered at HTTP 200', async () => {
    mockFetch(async () =>
      jsonResponse({ errors: [gqlError('INTERNAL_SERVER_ERROR')], data: null }),
    );
    await expect(fetchSharedHistory('outage')).rejects.toSatisfy(isUpstreamError);
  });
});

describe('settleUpstream', () => {
  it('maps an outage to undefined, absence to null, and re-throws anything else', async () => {
    mockFetch(async () => jsonResponse({}, 503));
    await expect(settleUpstream(fetchProfile(`settle-${Math.random()}`))).resolves.toBeUndefined();
    await expect(settleUpstream(Promise.resolve(null))).resolves.toBeNull();
    await expect(settleUpstream(Promise.reject(new Error('boom')))).rejects.toThrow('boom');
  });
});
