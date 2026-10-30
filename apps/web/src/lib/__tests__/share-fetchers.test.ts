import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchProfile } from '../fetch-profile';
import { fetchRide } from '../fetch-ride';
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

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchProfile', () => {
  it('returns null when the API answers that the rider is absent', async () => {
    mockFetch(async () => jsonResponse({ errors: [{ message: 'Not found' }], data: null }));
    await expect(fetchProfile(`absent-${Math.random()}`)).resolves.toBeNull();
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

  it('throws UpstreamError on a timeout-shaped failure', async () => {
    mockFetch(async () => {
      throw new DOMException('timeout', 'TimeoutError');
    });
    await expect(fetchRide(`timeout-${Math.random()}`)).rejects.toSatisfy(isUpstreamError);
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
