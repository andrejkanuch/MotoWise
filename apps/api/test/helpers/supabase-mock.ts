import { vi } from 'vitest';

interface MockResponse {
  data: unknown;
  error: unknown;
  count?: number | null;
}

export function createMockQueryBuilder(
  initialResponse: MockResponse = { data: null, error: null, count: null },
) {
  let response = { ...initialResponse };
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};

  const chainableMethods = [
    'from',
    'select',
    'insert',
    'update',
    'upsert',
    'delete',
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'like',
    'ilike',
    'is',
    'in',
    'contains',
    'textSearch',
    'order',
    'limit',
    'range',
    'match',
    'not',
    'or',
    'filter',
  ];

  for (const method of chainableMethods) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }

  builder.single = vi.fn().mockImplementation(() => Promise.resolve(response));
  builder.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(response));
  builder.then = vi
    .fn()
    .mockImplementation((resolve: (v: MockResponse) => void) => resolve(response));

  const mock = builder as Record<string, ReturnType<typeof vi.fn>> & {
    resolveWith: (res: MockResponse) => void;
  };

  mock.resolveWith = (res: MockResponse) => {
    response = res;
    builder.single.mockImplementation(() => Promise.resolve(response));
    builder.maybeSingle.mockImplementation(() => Promise.resolve(response));
    builder.then.mockImplementation((resolve: (v: MockResponse) => void) => resolve(response));
  };

  return mock;
}

export function createMockSupabaseClient() {
  const queryBuilder = createMockQueryBuilder();

  const client = {
    from: vi.fn().mockReturnValue(queryBuilder),
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn(),
    },
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn(),
        getPublicUrl: vi.fn(),
      }),
    },
  };

  return { client, queryBuilder };
}
