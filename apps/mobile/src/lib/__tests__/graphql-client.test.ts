// gqlFetcher's UNAUTHENTICATED handling. The regression under test is
// MOTO-VAULT-REACT-NATIVE-1J: a request that goes out with no Authorization
// header is rejected, refreshed, and then sent AGAIN with no header — two
// identical "Missing authorization header" reports per doomed call, from
// background paths (CarPlay, sync drains) firing while signed out.

const mockRequest = jest.fn();

// A prototype method, not a class field: the client is constructed at module
// import time, before `mockRequest`'s initializer has run.
jest.mock('graphql-request', () => ({
  GraphQLClient: class {
    request(...args: unknown[]) {
      return mockRequest(...args);
    }
  },
}));

const mockRefreshGqlSession = jest.fn<Promise<boolean>, []>();
jest.mock('../gql-auth-session', () => ({
  buildGqlRequestHeaders: jest.fn().mockResolvedValue({ 'x-locale': 'en' }),
  refreshGqlSession: () => mockRefreshGqlSession(),
}));

import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { SubmitDiagnosticDocument } from '@motovault/graphql';
import { GQL_TIMEOUT_MS, gqlFetcher } from '../graphql-client';
import {
  GRAPHQL_ERROR_CODE,
  isGqlRequestTimeoutError,
  isMissingGqlSessionError,
} from '../graphql-error-classification';
import { hasGraphQLCode, userFriendlyError } from '../graphql-errors';
import { isNetworkError } from '../network-error';

type Result = { myMotorcycles: { id: string }[] };

const DOCUMENT = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'MyMotorcycles' },
    },
  ],
} as unknown as TypedDocumentNode<Result, Record<string, never>>;

function unauthenticated() {
  const response = {
    data: null,
    errors: [
      {
        message: 'Missing authorization header',
        path: ['myMotorcycles'],
        extensions: { code: GRAPHQL_ERROR_CODE.UNAUTHENTICATED },
      },
    ],
  };
  return Object.assign(new Error('Missing authorization header'), { response });
}

beforeEach(() => {
  mockRequest.mockReset();
  mockRefreshGqlSession.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

/** A request whose fetch never settles unless its AbortSignal fires. */
function hangUntilAborted() {
  const signals: AbortSignal[] = [];
  mockRequest.mockImplementation(({ signal }: { signal: AbortSignal }) => {
    signals.push(signal);
    return new Promise(() => {});
  });
  return signals;
}

describe('gqlFetcher', () => {
  it('returns data and never refreshes on success', async () => {
    mockRequest.mockResolvedValue({ myMotorcycles: [{ id: 'b1' }] });

    await expect(gqlFetcher(DOCUMENT)).resolves.toEqual({ myMotorcycles: [{ id: 'b1' }] });
    expect(mockRefreshGqlSession).not.toHaveBeenCalled();
  });

  it('rethrows non-auth failures untouched', async () => {
    const boom = new Error('Network request failed');
    mockRequest.mockRejectedValue(boom);

    await expect(gqlFetcher(DOCUMENT)).rejects.toBe(boom);
    expect(mockRefreshGqlSession).not.toHaveBeenCalled();
  });

  it('refreshes and retries once when the refresh yields a session', async () => {
    mockRequest.mockRejectedValueOnce(unauthenticated()).mockResolvedValueOnce({
      myMotorcycles: [],
    });
    mockRefreshGqlSession.mockResolvedValue(true);

    await expect(gqlFetcher(DOCUMENT)).resolves.toEqual({ myMotorcycles: [] });
    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockRefreshGqlSession).toHaveBeenCalledTimes(1);
  });

  it('fails fast without a second request when no session can be obtained', async () => {
    mockRequest.mockRejectedValue(unauthenticated());
    mockRefreshGqlSession.mockResolvedValue(false);

    const error = await gqlFetcher(DOCUMENT).catch((e: unknown) => e);

    expect(isMissingGqlSessionError(error)).toBe(true);
    expect((error as Error).message).toContain('MyMotorcycles');
    // The whole point: exactly ONE request, not the doomed retry.
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('keeps the UNAUTHENTICATED shape so existing consumers behave identically', async () => {
    mockRequest.mockRejectedValue(unauthenticated());
    mockRefreshGqlSession.mockResolvedValue(false);

    const error = await gqlFetcher(DOCUMENT).catch((e: unknown) => e);

    // query-client.ts suppresses the alert on this exact check.
    expect(hasGraphQLCode(error, GRAPHQL_ERROR_CODE.UNAUTHENTICATED)).toBe(true);
  });

  it('still fails fast when the document carries no parsed operation name', async () => {
    mockRequest.mockRejectedValue(unauthenticated());
    mockRefreshGqlSession.mockResolvedValue(false);
    const anonymous = {
      kind: 'Document',
      definitions: [],
      loc: { source: { body: 'query StartRideFallback { startRide { id } }' } },
    } as unknown as TypedDocumentNode<Result, Record<string, never>>;

    const error = await gqlFetcher(anonymous).catch((e: unknown) => e);

    expect(isMissingGqlSessionError(error)).toBe(true);
    expect((error as Error).message).toContain('StartRideFallback');
  });
});

describe('gqlFetcher timeout', () => {
  it('passes an AbortSignal to every request', async () => {
    mockRequest.mockResolvedValue({ myMotorcycles: [] });

    await gqlFetcher(DOCUMENT);

    expect(mockRequest.mock.calls[0][0].signal).toBeDefined();
    expect(mockRequest.mock.calls[0][0].signal.aborted).toBe(false);
  });

  it('rejects a hung request after the default timeout and aborts its fetch', async () => {
    jest.useFakeTimers();
    const signals = hangUntilAborted();

    const settled = gqlFetcher(DOCUMENT).catch((e: unknown) => e);
    await jest.advanceTimersByTimeAsync(GQL_TIMEOUT_MS.DEFAULT - 1);
    expect(signals).toHaveLength(1);
    expect(signals[0].aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(1);

    const error = await settled;
    expect(isGqlRequestTimeoutError(error)).toBe(true);
    expect((error as Error).message).toContain('MyMotorcycles');
    expect(signals[0].aborted).toBe(true);
    // Existing handlers treat it as a transient connectivity failure: no Sentry
    // report, "Connection error" copy, and the save-failed path runs.
    expect(isNetworkError(error)).toBe(true);
    expect(userFriendlyError(error)).toMatch(/connection error/i);
    expect(mockRefreshGqlSession).not.toHaveBeenCalled();
  });

  it('clears the timer once the request settles', async () => {
    jest.useFakeTimers();
    mockRequest.mockResolvedValue({ myMotorcycles: [] });

    await gqlFetcher(DOCUMENT);

    expect(jest.getTimerCount()).toBe(0);
  });

  it('gives LLM-backed operations the long-running timeout', async () => {
    jest.useFakeTimers();
    hangUntilAborted();

    let error: unknown;
    const settled = gqlFetcher(SubmitDiagnosticDocument, {
      input: {} as never,
    }).catch((e: unknown) => {
      error = e;
    });
    await jest.advanceTimersByTimeAsync(GQL_TIMEOUT_MS.DEFAULT);
    expect(error).toBeUndefined();

    await jest.advanceTimersByTimeAsync(GQL_TIMEOUT_MS.LONG_RUNNING - GQL_TIMEOUT_MS.DEFAULT);
    await settled;
    expect(isGqlRequestTimeoutError(error)).toBe(true);
  });

  it('honours an explicit timeoutMs option', async () => {
    jest.useFakeTimers();
    hangUntilAborted();

    let error: unknown;
    const settled = gqlFetcher(DOCUMENT, undefined, {
      timeoutMs: GQL_TIMEOUT_MS.LONG_RUNNING,
    }).catch((e: unknown) => {
      error = e;
    });
    await jest.advanceTimersByTimeAsync(GQL_TIMEOUT_MS.DEFAULT);
    expect(error).toBeUndefined();

    await jest.advanceTimersByTimeAsync(GQL_TIMEOUT_MS.LONG_RUNNING);
    await settled;
    expect(isGqlRequestTimeoutError(error)).toBe(true);
  });
});
