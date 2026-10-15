/**
 * A GraphQL document that `lib/query-options.ts` owns has ONE `queryOptions()`
 * factory there, and every `useQuery` / `useInfiniteQuery` / `fetchQuery` site
 * of that document goes through it. `SHARED_DOCUMENTS` is the ratchet: the
 * documents converted so far. A document fetched by several files but not yet
 * listed (`MyRidesDocument`, `MyTripsDocument`, `RideOverviewDocument` at the
 * time of writing) is not governed until it is converted and added here.
 *
 * Why: a key written by hand at each site drifts from its variables. The
 * dashboard and the health report both cached `ExpensesByMotorcycle` under the
 * bare per-bike key — one for every year, one for this year — and each showed
 * whichever payload arrived first. A factory holds key and variables together.
 *
 * Two checks, both static over `apps/mobile/src` except for the hashing one:
 *   1. Source scan — a shared document appears in a `gqlFetcher(` call only in
 *      the factory file or in an imperative cache-or-fetch site (which keeps
 *      its own fetch so background code never picks up the cache's retries and
 *      the global error alert).
 *   2. Every factory that takes variables hashes two variable sets to two keys,
 *      and hands the fetcher the same variables its key carries.
 *
 * `lib/__tests__/analytics-event-catalog.test.ts` is the precedent for a test
 * that scans source.
 */
const mockFetcher = jest.fn();
jest.mock('../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));
jest.mock('../lib/account-gone', () => ({
  isAccountGoneError: () => false,
  getRequestSessionUserId: () => null,
  signOutGoneAccount: jest.fn(),
}));
jest.mock('../lib/analytics', () => ({ addBreadcrumb: jest.fn(), captureException: jest.fn() }));

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { hashKey } from '@tanstack/react-query';
import {
  documentCategoriesOptions,
  expenseDashboardQueryOptions,
  expensesOptions,
  maintenanceTasksOptions,
  rideWaypointsOptions,
} from '../lib/query-options';

const SRC_DIR = join(__dirname, '..');
const SOURCE_EXTENSIONS = ['.ts', '.tsx'];
const SKIPPED_DIRS = ['__tests__', '__mocks__', 'test'];

/** The one place a shared document's query is defined. */
const FACTORY_FILE = 'lib/query-options.ts';

/**
 * Cache-or-fetch sites outside React. They read the cache and fall back to a
 * direct `gqlFetcher` on purpose: routing them through the query cache would
 * add retries and the global error alert to CarPlay, the ride controller and
 * the widget. Their code is not touched by the conversions.
 */
const IMPERATIVE_SITES: readonly string[] = [
  'features/carplay/carplay-coordinator.ts',
  'features/ride/ride-controller.ts',
  'lib/widget-sync.ts',
];

/** Documents the factory file owns; each is fetched from two or more files. */
const SHARED_DOCUMENTS: readonly string[] = [
  'AllMaintenanceTasksDocument',
  'MyMotorcyclesDocument',
  'MaintenanceTasksByMotorcycleDocument',
  'ExpensesByMotorcycleDocument',
  'DocumentCategoriesDocument',
  'MyRidesForHeatmapDocument',
  'GetRideWaypointsDocument',
  'ExpenseDashboardDocument',
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return SKIPPED_DIRS.includes(entry.name) ? [] : sourceFiles(path);
    const isSource = SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext));
    return isSource && !entry.name.includes('.test.') ? [path] : [];
  });
}

/**
 * `gqlFetcher(<Document>` with any whitespace, including a line break, in
 * between, and with or without an explicit type argument (`gqlFetcher<...>(`).
 */
function fetchesDocument(source: string, document: string): boolean {
  return new RegExp(`\\bgqlFetcher\\s*(?:<[^()]*>)?\\s*\\(\\s*${document}\\b`).test(source);
}

/** Relative source path -> the shared documents it fetches directly. */
function directFetchSites(): Map<string, string[]> {
  const sites = new Map<string, string[]>();
  for (const file of sourceFiles(SRC_DIR)) {
    const source = readFileSync(file, 'utf8');
    const fetched = SHARED_DOCUMENTS.filter((document) => fetchesDocument(source, document));
    if (fetched.length > 0) sites.set(relative(SRC_DIR, file), fetched);
  }
  return sites;
}

describe('the scan recognises a direct fetch', () => {
  it.each([
    ['plain call', 'gqlFetcher(MyMotorcyclesDocument)'],
    ['line break', 'gqlFetcher(\n  MyMotorcyclesDocument,\n)'],
    [
      'explicit type argument',
      'gqlFetcher<MyMotorcyclesQuery, MyMotorcyclesQueryVariables>(MyMotorcyclesDocument)',
    ],
  ])('%s', (_name, source) => {
    expect(fetchesDocument(source, 'MyMotorcyclesDocument')).toBe(true);
  });

  it('ignores an import or a different document', () => {
    expect(
      fetchesDocument(
        "import { MyMotorcyclesDocument } from '@motovault/graphql';",
        'MyMotorcyclesDocument',
      ),
    ).toBe(false);
    expect(fetchesDocument('gqlFetcher(MyMotorcyclesDocumentExtra)', 'MyMotorcyclesDocument')).toBe(
      false,
    );
  });
});

describe('shared documents are fetched through their factory', () => {
  const sites = directFetchSites();
  const allowedFiles = new Set([FACTORY_FILE, ...IMPERATIVE_SITES]);

  it('finds the factory file', () => {
    expect(sites.has(FACTORY_FILE)).toBe(true);
  });

  it('no file outside the factory and the imperative sites fetches one', () => {
    const offenders = [...sites.entries()]
      .filter(([file]) => !allowedFiles.has(file))
      .flatMap(([file, documents]) => documents.map((d) => `${file}: ${d}`))
      .sort();
    expect(offenders).toEqual([]);
  });

  it('keeps the imperative allowlist honest', () => {
    expect(IMPERATIVE_SITES.filter((file) => !sites.has(file))).toEqual([]);
  });

  it('every listed document is still shared, or already lives in the factory', () => {
    const notShared = SHARED_DOCUMENTS.filter((document) => {
      const fetchers = [...sites.entries()].filter(([, documents]) => documents.includes(document));
      const inFactory = fetchers.some(([file]) => file === FACTORY_FILE);
      return !inFactory && fetchers.length < 2;
    });
    expect(notShared).toEqual([]);
  });
});

interface VariableCase {
  name: string;
  build: (variables: Record<string, unknown>) => {
    queryKey: readonly unknown[];
    queryFn?: unknown;
  };
  a: Record<string, unknown>;
  b: Record<string, unknown>;
}

/** Every factory that takes variables, with two variable sets that must not share a key. */
const VARIABLE_FACTORIES: VariableCase[] = [
  {
    name: 'expensesOptions',
    build: (v) => expensesOptions(v.motorcycleId as string, v.year as number),
    a: { motorcycleId: 'bike-a', year: 0 },
    b: { motorcycleId: 'bike-a', year: 2026 },
  },
  {
    name: 'documentCategoriesOptions',
    build: (v) => documentCategoriesOptions(v.includeHidden as boolean),
    a: { includeHidden: true },
    b: { includeHidden: false },
  },
  {
    name: 'expenseDashboardQueryOptions',
    build: (v) => expenseDashboardQueryOptions(v.motorcycleId as string),
    a: { motorcycleId: 'bike-a' },
    b: { motorcycleId: 'bike-b' },
  },
  {
    name: 'maintenanceTasksOptions',
    build: (v) => maintenanceTasksOptions(v.motorcycleId as string),
    a: { motorcycleId: 'bike-a' },
    b: { motorcycleId: 'bike-b' },
  },
  {
    name: 'rideWaypointsOptions',
    build: (v) => rideWaypointsOptions(v.rideId as string, v.maxPoints as number),
    a: { rideId: 'ride-a', maxPoints: 300 },
    b: { rideId: 'ride-a', maxPoints: 400 },
  },
];

describe('factories that take variables', () => {
  beforeEach(() => {
    mockFetcher.mockReset();
    mockFetcher.mockResolvedValue({});
  });

  it.each(VARIABLE_FACTORIES)('$name: two variable sets hash to two keys', ({ build, a, b }) => {
    expect(hashKey(build(a).queryKey)).not.toBe(hashKey(build(b).queryKey));
  });

  it.each(VARIABLE_FACTORIES)('$name: the fetcher receives the variables the key carries', async ({
    build,
    a,
  }) => {
    const options = build(a);
    await (options.queryFn as () => Promise<unknown>)();
    expect(mockFetcher).toHaveBeenCalledTimes(1);
    const [, variables] = mockFetcher.mock.calls[0];
    expect(variables).toEqual(a);
    for (const value of Object.values(a)) expect(options.queryKey).toContain(value);
  });
});
