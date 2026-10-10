/**
 * Every `AnalyticsEvent` constant must have a call site in apps/mobile/src.
 *
 * A constant with no call site reads like an event the app sends, so people
 * build PostHog insights on it and wonder why it is flat at zero (route_viewed,
 * purchase_started, … were exactly that). Delete the constant when you delete
 * the last `trackEvent` that used it.
 *
 * Static scan, not a runtime check: it reads the catalog block out of
 * analytics.ts and looks for `AnalyticsEvent.<KEY>` in non-test source files.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC_DIR = join(__dirname, '..', '..');
const CATALOG_FILE = join(__dirname, '..', 'analytics.ts');
const SOURCE_EXTENSIONS = ['.ts', '.tsx'];
const SKIPPED_DIRS = ['__tests__', '__mocks__', 'test'];

/**
 * Constants deliberately kept WITHOUT a call site. Each entry needs a reason:
 * the only valid one is that historical events under that name still exist in
 * PostHog and saved insights resolve the name through this catalog.
 */
const HISTORY_ONLY_ALLOWLIST: readonly string[] = [
  // Retired 2026-08-24; signup is counted server-side now (see the constant's doc).
  'ACCOUNT_CREATED',
  // Retired 2026-10-09 with the never-rendered components/ride/pb-toast.tsx.
  'PB_TOAST_SEEN',
  'PB_TOAST_TAPPED',
  'PB_TOAST_DISMISSED',
  // Retired 2026-10-09 with the never-imported components/gpx-export-modal.tsx.
  'ROUTE_GPX_EXPORTED',
  // Retired 2026-10-10 with the never-imported components/share/share-ride.ts.
  'SHARE_CARD_GENERATED',
  'SHARE_CARD_FAILED',
];

function catalogKeys(): string[] {
  const source = readFileSync(CATALOG_FILE, 'utf8');
  const start = source.indexOf('export const AnalyticsEvent = {');
  const end = source.indexOf('} as const;', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return [...source.slice(start, end).matchAll(/^\s+([A-Z][A-Z0-9_]*):\s*'/gm)].map((m) => m[1]);
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return SKIPPED_DIRS.includes(entry.name) ? [] : sourceFiles(path);
    const isSource = SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext));
    return isSource && !entry.name.includes('.test.') ? [path] : [];
  });
}

describe('AnalyticsEvent catalog', () => {
  const keys = catalogKeys();
  const corpus = sourceFiles(SRC_DIR)
    .filter((file) => file !== CATALOG_FILE)
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');
  const hasCallSite = (key: string) => new RegExp(`\\bAnalyticsEvent\\.${key}\\b`).test(corpus);

  it('parses the catalog', () => {
    expect(keys.length).toBeGreaterThan(50);
  });

  it('has a call site for every constant (or an allowlisted history-only reason)', () => {
    const dead = keys.filter((key) => !HISTORY_ONLY_ALLOWLIST.includes(key) && !hasCallSite(key));
    expect(dead).toEqual([]);
  });

  it('keeps the allowlist honest — an allowlisted constant that is used again must leave it', () => {
    expect(HISTORY_ONLY_ALLOWLIST.filter(hasCallSite)).toEqual([]);
    expect(HISTORY_ONLY_ALLOWLIST.filter((key) => !keys.includes(key))).toEqual([]);
  });
});
