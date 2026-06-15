import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

const { gqlServerFetcherAuthed } = await import('../graphql-server');

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
