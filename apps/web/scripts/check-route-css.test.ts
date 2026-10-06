import { describe, expect, it } from 'vitest';
import { findRoutesMissingTokens, manifestPathFor } from './check-route-css.mjs';

const TOKENS = ':root{--mv-page:#030201;--mv-bg-2:#040201}';
// What production /login shipped after PR #285: the stale global chunk carries
// the old tokens.css, and the new auth CSS only *uses* --mv-page.
const STALE_GLOBALS = ':root{--color-neutral-900:#171717}';
const AUTH_CSS = '.mva-root{background:var(--mv-page)}';

function manifest(route: string, entryCSSFiles: Record<string, unknown[]>) {
  return `globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};
globalThis.__RSC_MANIFEST[${JSON.stringify(route)}] = ${JSON.stringify({ entryCSSFiles })};`;
}

describe('findRoutesMissingTokens', () => {
  it('passes when an inlined stylesheet defines the tokens', () => {
    const failures = findRoutesMissingTokens({
      routes: ['/login/page'],
      readManifest: (route) =>
        manifest(route, {
          '[project]/apps/web/src/app/layout': [
            { path: 'static/chunks/a.css', inlined: true, content: STALE_GLOBALS + TOKENS },
          ],
          '[project]/apps/web/src/app/login/page': [
            { path: 'static/chunks/b.css', inlined: true, content: AUTH_CSS },
          ],
        }),
      readCssFile: () => {
        throw new Error('inlined CSS must not be read from disk');
      },
    });
    expect(failures).toEqual([]);
  });

  it('fails the stale-cache shape: tokens only used, never defined', () => {
    const failures = findRoutesMissingTokens({
      routes: ['/login/page'],
      readManifest: (route) =>
        manifest(route, {
          '[project]/apps/web/src/app/layout': [
            { path: 'static/chunks/a.css', inlined: true, content: STALE_GLOBALS },
          ],
          '[project]/apps/web/src/app/login/page': [
            { path: 'static/chunks/b.css', inlined: true, content: AUTH_CSS },
          ],
        }),
      readCssFile: () => '',
    });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('/login/page');
    expect(failures[0]).toContain('static/chunks/a.css');
  });

  it('reads non-inlined entries (string or object) from disk', () => {
    const files: Record<string, string> = { 'static/chunks/a.css': TOKENS };
    const failures = findRoutesMissingTokens({
      routes: ['/signup/page'],
      readManifest: (route) => manifest(route, { layout: ['static/chunks/a.css'] }),
      readCssFile: (relPath) => files[relPath] ?? '',
    });
    expect(failures).toEqual([]);
  });

  it('fails a route whose manifest is missing', () => {
    const failures = findRoutesMissingTokens({
      routes: ['/welcome/page'],
      readManifest: () => null,
      readCssFile: () => '',
    });
    expect(failures[0]).toContain('no client-reference manifest');
  });
});

describe('manifestPathFor', () => {
  it('maps a route key to its manifest file', () => {
    expect(manifestPathFor('/(community)/garage/page')).toBe(
      '(community)/garage/page_client-reference-manifest.js',
    );
  });
});
