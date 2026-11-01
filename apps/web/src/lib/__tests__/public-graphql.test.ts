import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  classifyPublicResponse,
  GRAPHQL_NOT_FOUND_CODE,
  PublicQueryError,
  postPublicQuery,
} from '../public-graphql';

const err = (code?: string) => ({ message: 'x', extensions: code ? { code } : {} });

describe('classifyPublicResponse', () => {
  it('returns data on HTTP 200 with data', () => {
    expect(classifyPublicResponse(200, { data: { tripDetail: { id: '1' } } })).toEqual({
      tripDetail: { id: '1' },
    });
  });

  it('returns null on HTTP 200 with no data', () => {
    expect(classifyPublicResponse(200, { data: null })).toBeNull();
  });

  it('returns null when every error is NOT_FOUND (the only definitive absence)', () => {
    expect(
      classifyPublicResponse(200, {
        data: null,
        errors: [err(GRAPHQL_NOT_FOUND_CODE), err(GRAPHQL_NOT_FOUND_CODE)],
      }),
    ).toBeNull();
  });

  it.each([
    ['INTERNAL_SERVER_ERROR in a 200 body (resolver/DB failure)', 'INTERNAL_SERVER_ERROR'],
    ['SERVICE_UNAVAILABLE', 'SERVICE_UNAVAILABLE'],
    ['TOO_MANY_REQUESTS', 'TOO_MANY_REQUESTS'],
    ['an error with no code', undefined],
  ])('throws on %s', (_label, code) => {
    expect(() => classifyPublicResponse(200, { data: null, errors: [err(code)] })).toThrow(
      PublicQueryError,
    );
  });

  it('throws when NOT_FOUND is mixed with another error', () => {
    expect(() =>
      classifyPublicResponse(200, {
        data: null,
        errors: [err(GRAPHQL_NOT_FOUND_CODE), err('INTERNAL_SERVER_ERROR')],
      }),
    ).toThrow(PublicQueryError);
  });

  it.each([
    [400, { errors: [err('GRAPHQL_VALIDATION_FAILED')] }],
    [400, { errors: [err(GRAPHQL_NOT_FOUND_CODE)] }],
    [400, {}],
    [429, { errors: [err('TOO_MANY_REQUESTS')] }],
    [502, {}],
    [503, { data: null }],
  ])('throws on HTTP %i whatever the body says', (status, body) => {
    expect(() => classifyPublicResponse(status, body)).toThrow(PublicQueryError);
  });

  it('throws when the 200 body is not a GraphQL object', () => {
    expect(() => classifyPublicResponse(200, null)).toThrow(PublicQueryError);
    expect(() => classifyPublicResponse(200, 'oops')).toThrow(PublicQueryError);
  });
});

describe('postPublicQuery', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const stubFetch = (impl: () => Promise<Response>) => {
    const fetchMock = vi.fn(impl);
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };

  it('posts the query and returns the classified data', async () => {
    const fetchMock = stubFetch(async () =>
      Response.json({ data: { tripDetail: { id: '1' } } }, { status: 200 }),
    );
    await expect(
      postPublicQuery('https://api.test/graphql', 'q', { id: '1' }, 300),
    ).resolves.toEqual({ tripDetail: { id: '1' } });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ query: 'q', variables: { id: '1' } });
  });

  it('returns null for a NOT_FOUND answer', async () => {
    stubFetch(async () =>
      Response.json({ data: null, errors: [err(GRAPHQL_NOT_FOUND_CODE)] }, { status: 200 }),
    );
    await expect(postPublicQuery('https://api.test/graphql', 'q', {}, 300)).resolves.toBeNull();
  });

  it('throws on an HTML error page', async () => {
    stubFetch(async () => new Response('<html>Bad gateway</html>', { status: 502 }));
    await expect(postPublicQuery('https://api.test/graphql', 'q', {}, 300)).rejects.toThrow(
      PublicQueryError,
    );
  });

  it('propagates network errors and timeouts', async () => {
    stubFetch(async () => {
      throw new DOMException('The operation timed out.', 'TimeoutError');
    });
    await expect(postPublicQuery('https://api.test/graphql', 'q', {}, 300)).rejects.toThrow(
      'timed out',
    );
  });
});
