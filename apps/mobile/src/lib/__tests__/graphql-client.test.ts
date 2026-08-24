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
import { gqlFetcher } from '../graphql-client';
import { GRAPHQL_ERROR_CODE, isMissingGqlSessionError } from '../graphql-error-classification';
import { hasGraphQLCode } from '../graphql-errors';

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
