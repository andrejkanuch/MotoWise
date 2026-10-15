/**
 * A GraphQL document that two or more files fetch has ONE `queryOptions()`
 * factory in `lib/query-options.ts`, and every `useQuery` / `useInfiniteQuery` /
 * `fetchQuery` site of that document goes through it.
 *
 * Why: a key written by hand at each site drifts from its variables. The
 * dashboard and the health report both cached `ExpensesByMotorcycle` under the
 * bare per-bike key — one for every year, one for this year — and each showed
 * whichever payload arrived first. A factory holds key and variables together.
 *
 * Two checks, both static over `apps/mobile/src` except for the hashing one:
 *   1. Source scan — a shared document appears in a `gqlFetcher(` call only in
 *      the factory file, in an imperative cache-or-fetch site (which keeps its
 *      own fetch so background code never picks up the cache's retries and the
 *      global error alert), or in `KNOWN_UNCONVERTED`. Each conversion unit
 *      deletes its files from that list; it is empty when every site is through.
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
import { expenseDashboardQueryOptions, expensesOptions } from '../lib/query-options';

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

/** Documents fetched from two or more files. */
const SHARED_DOCUMENTS: readonly string[] = [
  'MyMotorcyclesDocument',
  'MaintenanceTasksByMotorcycleDocument',
  'ExpensesByMotorcycleDocument',
  'DocumentCategoriesDocument',
  'MyRidesForHeatmapDocument',
  'GetRideWaypointsDocument',
  'ExpenseDashboardDocument',
];

/**
 * Files that still fetch a shared document themselves, with the documents each
 * one fetches directly. An entry leaves this list in the unit that converts
 * that site; an entry whose file no longer fetches that document fails the
 * honesty check below so the list cannot go stale.
 */
const KNOWN_UNCONVERTED: Readonly<Record<string, readonly string[]>> = {
  'app/(modals)/ride-detail.tsx': ['GetRideWaypointsDocument'],
  'app/(modals)/ride-flyover.tsx': ['GetRideWaypointsDocument'],
  'app/(modals)/scan-receipt.tsx': ['MyMotorcyclesDocument'],
  'app/(modals)/start-ride.tsx': ['MyMotorcyclesDocument'],
  'app/(modals)/whats-new.tsx': ['MyMotorcyclesDocument'],
  'app/(tabs)/(diagnose)/[id].tsx': ['MyMotorcyclesDocument'],
  'app/(tabs)/(diagnose)/index.tsx': ['MyMotorcyclesDocument'],
  'app/(tabs)/(garage)/add-document.tsx': ['DocumentCategoriesDocument'],
  'app/(tabs)/(garage)/bike-tasks.tsx': [
    'MyMotorcyclesDocument',
    'MaintenanceTasksByMotorcycleDocument',
  ],
  'app/(tabs)/(garage)/complete-task.tsx': ['MaintenanceTasksByMotorcycleDocument'],
  'app/(tabs)/(garage)/document/[id].tsx': ['DocumentCategoriesDocument'],
  'app/(tabs)/(garage)/edit-bike.tsx': ['MyMotorcyclesDocument'],
  'app/(tabs)/(garage)/edit-maintenance-task.tsx': ['MaintenanceTasksByMotorcycleDocument'],
  'app/(tabs)/(garage)/expense-dashboard.tsx': ['MyMotorcyclesDocument'],
  'app/(tabs)/(garage)/expense-detail.tsx': ['MaintenanceTasksByMotorcycleDocument'],
  'app/(tabs)/(garage)/health-report.tsx': [
    'MyMotorcyclesDocument',
    'MaintenanceTasksByMotorcycleDocument',
  ],
  'app/(tabs)/(garage)/index.tsx': ['MyMotorcyclesDocument'],
  'app/(tabs)/(garage)/manage-document-categories.tsx': ['DocumentCategoriesDocument'],
  'app/(tabs)/(learn)/index.tsx': ['MyMotorcyclesDocument'],
  'app/(tabs)/(profile)/heatmap.tsx': ['MyRidesForHeatmapDocument'],
  'app/(tabs)/(profile)/rides.tsx': ['MyMotorcyclesDocument'],
  'components/bike-hub/documents-section.tsx': ['DocumentCategoriesDocument'],
  'components/bike-hub/expenses-section.tsx': ['MaintenanceTasksByMotorcycleDocument'],
  'components/bike-hub/notes/use-notes.ts': ['MaintenanceTasksByMotorcycleDocument'],
  'components/bike-hub/overview/use-overview-data.ts': ['DocumentCategoriesDocument'],
  'components/bike-hub/shell/use-bike-hub-data.ts': [
    'MyMotorcyclesDocument',
    'MaintenanceTasksByMotorcycleDocument',
  ],
  'components/bike-hub/shell/use-hub-bike.ts': ['MyMotorcyclesDocument'],
  'components/diagnostic-flow/step-bike-selection.tsx': ['MyMotorcyclesDocument'],
  'components/diagnostic-flow/step-review-submit.tsx': ['MyMotorcyclesDocument'],
  'components/discover/bike-banner.tsx': ['MyMotorcyclesDocument'],
  'components/home/use-checklist-signals.ts': ['MyMotorcyclesDocument'],
  'components/home/use-home-data.ts': ['MyMotorcyclesDocument'],
  'components/ride/pre-flight-checklist.tsx': ['MaintenanceTasksByMotorcycleDocument'],
  'features/carplay/use-carplay.ts': ['MyMotorcyclesDocument'],
  'features/receipt-scan/review-card.tsx': ['MyMotorcyclesDocument'],
  'hooks/use-analytics-super-properties.ts': ['MyMotorcyclesDocument'],
  'hooks/use-primary-bike-fuel-data.ts': ['MyMotorcyclesDocument'],
  'hooks/use-profile-data.ts': ['MyMotorcyclesDocument'],
  'hooks/use-ride-heatmap-data.ts': ['MyRidesForHeatmapDocument'],
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return SKIPPED_DIRS.includes(entry.name) ? [] : sourceFiles(path);
    const isSource = SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext));
    return isSource && !entry.name.includes('.test.') ? [path] : [];
  });
}

/** `gqlFetcher(<Document>` with any whitespace, including a line break, in between. */
function fetchesDocument(source: string, document: string): boolean {
  return new RegExp(`\\bgqlFetcher\\(\\s*${document}\\b`).test(source);
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

describe('shared documents are fetched through their factory', () => {
  const sites = directFetchSites();
  const allowedFiles = new Set([FACTORY_FILE, ...IMPERATIVE_SITES]);
  const isKnown = (file: string, document: string) =>
    KNOWN_UNCONVERTED[file]?.includes(document) ?? false;

  it('finds the factory file', () => {
    expect(sites.has(FACTORY_FILE)).toBe(true);
  });

  it('no file outside the factory, the imperative sites and KNOWN_UNCONVERTED fetches one', () => {
    const offenders = [...sites.entries()]
      .filter(([file]) => !allowedFiles.has(file))
      .flatMap(([file, documents]) =>
        documents.filter((document) => !isKnown(file, document)).map((d) => `${file}: ${d}`),
      )
      .sort();
    expect(offenders).toEqual([]);
  });

  it('keeps KNOWN_UNCONVERTED honest — a converted site must leave the list', () => {
    const stale = Object.entries(KNOWN_UNCONVERTED).flatMap(([file, documents]) =>
      documents.filter((d) => !sites.get(file)?.includes(d)).map((d) => `${file}: ${d}`),
    );
    expect(stale).toEqual([]);
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
    name: 'expenseDashboardQueryOptions',
    build: (v) => expenseDashboardQueryOptions(v.motorcycleId as string),
    a: { motorcycleId: 'bike-a' },
    b: { motorcycleId: 'bike-b' },
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
