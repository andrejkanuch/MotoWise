import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// vi.mock factories are hoisted above the module body, so the mock fns they
// reference must come from vi.hoisted (declared before the factories run).
const { mockRequest, mockGetSession } = vi.hoisted(() => ({
  mockRequest: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock('graphql-request', () => ({
  // Must be `new`-able: graphql-server.ts does `new GraphQLClient(apiUrl)`.
  GraphQLClient: vi.fn(function GraphQLClient() {
    return { request: mockRequest };
  }),
}));

vi.mock('../supabase-server', () => ({
  getSupabaseServerClient: vi.fn(async () => ({
    auth: { getSession: mockGetSession },
  })),
}));

const { gqlServerFetcher, gqlServerFetcherAuthed } = await import('../graphql-server');

const FAKE_DOC = {} as TypedDocumentNode<{ ok: boolean }, Record<string, unknown>>;

describe('gqlServerFetcherAuthed', () => {
  afterEach(() => vi.clearAllMocks());

  it('forwards the Supabase access token as a Bearer header', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'tok123' } } });
    mockRequest.mockResolvedValue({ ok: true });

    const result = await gqlServerFetcherAuthed(FAKE_DOC, { motorcycleId: 'm1' });

    expect(result).toEqual({ ok: true });
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        requestHeaders: { Authorization: 'Bearer tok123' },
        variables: { motorcycleId: 'm1' },
      }),
    );
  });

  it('throws and never issues a request when no session is present', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    await expect(gqlServerFetcherAuthed(FAKE_DOC)).rejects.toThrow('no authenticated session');
    expect(mockRequest).not.toHaveBeenCalled();
  });
});

const timeoutError = () => {
  const e = new Error('The operation was aborted due to timeout');
  e.name = 'TimeoutError';
  return e;
};

const httpError = (status: number) =>
  Object.assign(new Error(`HTTP ${status}`), { response: { status } });

describe('gqlServerFetcher (public, retry-on-transient)', () => {
  // Run backoff callbacks synchronously so retries don't add real wall-clock delay.
  beforeAll(() => {
    vi.stubGlobal('setTimeout', (fn: () => void) => {
      fn();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });
  });
  afterAll(() => vi.unstubAllGlobals());
  afterEach(() => vi.clearAllMocks());

  it('retries a timed-out request and returns the eventual success', async () => {
    mockRequest.mockRejectedValueOnce(timeoutError()).mockResolvedValueOnce({ ok: true });

    const result = await gqlServerFetcher(FAKE_DOC);

    expect(result).toEqual({ ok: true });
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });

  it('retries gateway statuses (502/503/504)', async () => {
    mockRequest.mockRejectedValueOnce(httpError(503)).mockResolvedValueOnce({ ok: true });

    await expect(gqlServerFetcher(FAKE_DOC)).resolves.toEqual({ ok: true });
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry non-transient errors (e.g. 400)', async () => {
    mockRequest.mockRejectedValue(httpError(400));

    await expect(gqlServerFetcher(FAKE_DOC)).rejects.toThrow('HTTP 400');
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('gives up after the attempt cap on persistent transient failure', async () => {
    mockRequest.mockRejectedValue(timeoutError());

    await expect(gqlServerFetcher(FAKE_DOC)).rejects.toThrow('aborted due to timeout');
    expect(mockRequest).toHaveBeenCalledTimes(3);
  });
});
