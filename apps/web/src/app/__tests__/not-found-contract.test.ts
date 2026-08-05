import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guard: no `loading.tsx` may sit above a page that calls `notFound()`,
 * `redirect()` or `permanentRedirect()`.
 *
 * A `loading.tsx` creates a Suspense boundary for its whole subtree, so the shell
 * streams before the page resolves — and per Next's `not-found` reference a streamed
 * response can only carry HTTP 200. Every `notFound()` under such a boundary
 * therefore serves the not-found page at 200, which Google indexes as a real, thin
 * page. The same applies to a status-carrying redirect.
 *
 * This is exactly the regression that hid for ~2 months across two PRs (Sentry
 * MOTOVAULT-WEB-Q/-P/-R, ~1k GSC "Not found (404)" entries) — see
 * docs/solutions/runtime-errors/nextjs-streaming-swallows-404s-and-redirects.md. It was invisible
 * because dev mode does not reproduce it and no unit test can observe a prerender's
 * HTTP status.
 *
 * This test is the cheap tripwire: it catches a reintroduced boundary at PR time
 * rather than after a deploy. The end-to-end proof that real requests get real
 * statuses is `scripts/check-404-contract.sh`, which needs a running server.
 */

const APP_DIR = path.join(process.cwd(), 'src/app');
const STATUS_CALLS = ['notFound(', 'redirect(', 'permanentRedirect('] as const;
/** Route-group and private folders don't create URL segments but still nest. */
const PAGE_FILES = ['page.tsx', 'page.ts'] as const;
const LOADING_FILE = 'loading.tsx';

interface RouteFile {
  /** Path relative to src/app, e.g. `explore/[country]/page.tsx`. */
  rel: string;
  /** Directory containing it, relative to src/app. `''` for the app root. */
  dir: string;
}

function walk(dir: string, acc: { pages: RouteFile[]; loaders: RouteFile[] }) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      walk(abs, acc);
      continue;
    }
    const rel = path.relative(APP_DIR, abs);
    const record: RouteFile = { rel, dir: path.dirname(rel) === '.' ? '' : path.dirname(rel) };
    if ((PAGE_FILES as readonly string[]).includes(entry.name)) {
      const src = fs.readFileSync(abs, 'utf8');
      if (STATUS_CALLS.some((call) => src.includes(call))) acc.pages.push(record);
    } else if (entry.name === LOADING_FILE) {
      acc.loaders.push(record);
    }
  }
}

/** True when `loaderDir` is an ancestor of (or equal to) `pageDir`. */
function isAbove(loaderDir: string, pageDir: string): boolean {
  if (loaderDir === '') return true;
  return pageDir === loaderDir || pageDir.startsWith(`${loaderDir}${path.sep}`);
}

describe('404 contract: no Suspense boundary above a status-carrying page', () => {
  const acc: { pages: RouteFile[]; loaders: RouteFile[] } = { pages: [], loaders: [] };
  walk(APP_DIR, acc);

  it('finds the routes it is meant to protect (guard is not vacuous)', () => {
    // If this ever drops to 0 the guard below passes for the wrong reason.
    expect(acc.pages.length).toBeGreaterThan(5);
  });

  it('has no loading.tsx above any page that calls notFound()/redirect()', () => {
    const violations = acc.loaders.flatMap((loader) =>
      acc.pages
        .filter((page) => isAbove(loader.dir, page.dir))
        .map((page) => `${loader.rel} streams above ${page.rel}`),
    );

    expect(
      violations,
      'A loading.tsx above these pages turns their 404s/redirects into indexable 200s. ' +
        'Render the loading UI inside the page below its existence check, or use a ' +
        'client-side navigation-event component (no Suspense boundary).',
    ).toEqual([]);
  });
});
