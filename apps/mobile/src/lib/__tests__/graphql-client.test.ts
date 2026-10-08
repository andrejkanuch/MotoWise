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
const mockBuildHeaders = jest.fn<Promise<Record<string, string>>, []>();
jest.mock('../gql-auth-session', () => ({
  buildGqlRequestHeaders: () => mockBuildHeaders(),
  refreshGqlSession: () => mockRefreshGqlSession(),
}));

import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import {
  AskTripAssistantDocument,
  GenerateArticleDocument,
  GenerateBikeHealthReportDocument,
  GenerateOnboardingInsightsDocument,
  RegenerateRideSummaryDocument,
  ScanReceiptDocument,
  SubmitDiagnosticDocument,
} from '@motovault/graphql';
import { GQL_TIMEOUT_MS, gqlFetcher } from '../graphql-client';
import {
  GqlRequestTimeoutError,
  GRAPHQL_ERROR_CODE,
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
  mockBuildHeaders.mockReset().mockResolvedValue({ 'x-locale': 'en' });
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
    expect(error).toBeInstanceOf(GqlRequestTimeoutError);
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

  // Every LLM-backed / report-generating document: one dropped from
  // LONG_RUNNING_DOCUMENTS would silently get the 30 s default.
  it.each([
    ['SubmitDiagnostic', SubmitDiagnosticDocument],
    ['ScanReceipt', ScanReceiptDocument],
    ['AskTripAssistant', AskTripAssistantDocument],
    ['GenerateArticle', GenerateArticleDocument],
    ['GenerateOnboardingInsights', GenerateOnboardingInsightsDocument],
    ['GenerateBikeHealthReport', GenerateBikeHealthReportDocument],
    ['RegenerateRideSummary', RegenerateRideSummaryDocument],
  ] as const)('gives %s the long-running timeout', async (_name, document) => {
    jest.useFakeTimers();
    hangUntilAborted();

    let error: unknown;
    const settled = gqlFetcher(document as TypedDocumentNode<unknown, unknown>, {}).catch(
      (e: unknown) => {
        error = e;
      },
    );
    await jest.advanceTimersByTimeAsync(GQL_TIMEOUT_MS.DEFAULT);
    expect(error).toBeUndefined();

    await jest.advanceTimersByTimeAsync(GQL_TIMEOUT_MS.LONG_RUNNING - GQL_TIMEOUT_MS.DEFAULT);
    await settled;
    expect(error).toBeInstanceOf(GqlRequestTimeoutError);
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
    expect(error).toBeInstanceOf(GqlRequestTimeoutError);
  });

  it('one deadline covers the UNAUTHENTICATED refresh and the retry', async () => {
    jest.useFakeTimers();
    const signals: AbortSignal[] = [];
    mockRequest
      .mockRejectedValueOnce(unauthenticated())
      .mockImplementationOnce(({ signal }: { signal: AbortSignal }) => {
        signals.push(signal);
        return new Promise(() => {});
      });
    // The refresh takes most of the budget; the retry must not get a fresh 30 s.
    mockRefreshGqlSession.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(true), GQL_TIMEOUT_MS.DEFAULT / 2)),
    );

    let error: unknown;
    const settled = gqlFetcher(DOCUMENT).catch((e: unknown) => {
      error = e;
    });
    await jest.advanceTimersByTimeAsync(GQL_TIMEOUT_MS.DEFAULT / 2);
    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(error).toBeUndefined();
    await jest.advanceTimersByTimeAsync(GQL_TIMEOUT_MS.DEFAULT / 2);
    await settled;

    expect(error).toBeInstanceOf(GqlRequestTimeoutError);
    expect(signals[0]?.aborted).toBe(true);
  });

  it('times out a header build that never settles, and sends nothing', async () => {
    jest.useFakeTimers();
    mockBuildHeaders.mockReturnValue(new Promise(() => {}));

    const settled = gqlFetcher(DOCUMENT).catch((e: unknown) => e);
    await jest.advanceTimersByTimeAsync(GQL_TIMEOUT_MS.DEFAULT);

    expect(await settled).toBeInstanceOf(GqlRequestTimeoutError);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('times out a session refresh that never settles', async () => {
    jest.useFakeTimers();
    mockRequest.mockRejectedValue(unauthenticated());
    mockRefreshGqlSession.mockReturnValue(new Promise(() => {}));

    const settled = gqlFetcher(DOCUMENT).catch((e: unknown) => e);
    await jest.advanceTimersByTimeAsync(GQL_TIMEOUT_MS.DEFAULT);

    expect(await settled).toBeInstanceOf(GqlRequestTimeoutError);
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('does not send a request whose headers arrive after the deadline', async () => {
    jest.useFakeTimers();
    mockBuildHeaders.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({}), GQL_TIMEOUT_MS.DEFAULT + 1)),
    );

    const settled = gqlFetcher(DOCUMENT).catch((e: unknown) => e);
    await jest.advanceTimersByTimeAsync(GQL_TIMEOUT_MS.DEFAULT + 1);

    expect(await settled).toBeInstanceOf(GqlRequestTimeoutError);
    expect(mockRequest).not.toHaveBeenCalled();
  });
});

describe('GqlRequestTimeoutError', () => {
  it('is classified as a transient network error by message alone', () => {
    expect(
      isNetworkError(new GqlRequestTimeoutError(GQL_TIMEOUT_MS.DEFAULT, 'MyMotorcycles')),
    ).toBe(true);
    expect(isNetworkError(new GqlRequestTimeoutError(GQL_TIMEOUT_MS.DEFAULT))).toBe(true);
  });
});
