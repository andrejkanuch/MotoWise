#!/usr/bin/env node
/**
 * Post-build guard: every route listed in ROUTES must ship the --mv-* design
 * tokens in its CSS. Runs after `next build` (see the `build` script), so it
 * checks the exact output Vercel deploys and fails the deployment instead of
 * shipping an unstyled page.
 *
 * Why it exists: the PR #285 production build reused a stale Turbopack
 * persistent build cache (restored by Vercel from the previous deployment).
 * globals.css had gained `@import ".../mv-tokens.css"`, but the emitted global
 * CSS chunk was byte-identical to the previous deployment's, without the tokens.
 * /login, /signup, /garage and /welcome rendered white-on-black-text in
 * production while every local build and `next dev` looked right.
 *
 * Source of truth: each route's `page_client-reference-manifest.js`. Its
 * `entryCSSFiles` lists every stylesheet the route gets, and with
 * `experimental.inlineCss` each entry carries the CSS it inlines into the HTML.
 * Entries without `content` (inlineCss off, or a webpack build) are read from
 * `.next/<path>`.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

/** A token *definition*, not a `var(--mv-page)` usage. */
export const REQUIRED_TOKEN_DEFINITION = /--mv-page\s*:/;

/** App-router route keys (as Next names them in the manifest). */
export const ROUTES = [
  '/login/page',
  '/signup/page',
  '/welcome/page',
  '/(community)/garage/page',
  '/[locale]/(marketing)/page',
];

/**
 * @param {string} route e.g. "/login/page"
 * @returns {string} manifest path relative to `.next/server/app`
 */
export function manifestPathFor(route) {
  return `${route.replace(/^\//, '')}_client-reference-manifest.js`;
}

/**
 * Evaluates a client-reference manifest file and returns the route's manifest.
 * @param {string} source file contents
 * @param {string} route
 */
export function parseManifest(source, route) {
  const sandbox = {};
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox);
  const manifest = sandbox.__RSC_MANIFEST?.[route];
  if (!manifest) throw new Error(`manifest for ${route} has no __RSC_MANIFEST entry`);
  return manifest;
}

/**
 * Collects the CSS text a route ships, across every segment (layout, page, …).
 * @param {{ entryCSSFiles?: Record<string, Array<string | { path: string, content?: string }>> }} manifest
 * @param {(relPath: string) => string} readCssFile reads `.next/<relPath>`
 */
export function collectRouteCss(manifest, readCssFile) {
  const seen = new Set();
  let css = '';
  for (const files of Object.values(manifest.entryCSSFiles ?? {})) {
    for (const file of files) {
      const relPath = typeof file === 'string' ? file : file.path;
      if (seen.has(relPath)) continue;
      seen.add(relPath);
      const inlined = typeof file === 'object' ? file.content : undefined;
      css += inlined ?? readCssFile(relPath);
    }
  }
  return { css, files: [...seen] };
}

/**
 * @param {{ routes: string[], readManifest: (route: string) => string | null, readCssFile: (relPath: string) => string }} io
 * @returns {string[]} one human-readable failure per broken route
 */
export function findRoutesMissingTokens({ routes, readManifest, readCssFile }) {
  const failures = [];
  for (const route of routes) {
    const source = readManifest(route);
    if (source === null) {
      failures.push(`${route}: no client-reference manifest (route renamed or removed? update ROUTES)`);
      continue;
    }
    const { css, files } = collectRouteCss(parseManifest(source, route), readCssFile);
    if (!REQUIRED_TOKEN_DEFINITION.test(css)) {
      failures.push(
        `${route}: none of its ${files.length} stylesheet(s) defines --mv-page (${files.join(', ') || 'no CSS at all'})`,
      );
    }
  }
  return failures;
}

function main() {
  const nextDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.next');
  const appDir = path.join(nextDir, 'server', 'app');
  const failures = findRoutesMissingTokens({
    routes: ROUTES,
    readManifest: (route) => {
      const file = path.join(appDir, manifestPathFor(route));
      return existsSync(file) ? readFileSync(file, 'utf8') : null;
    },
    readCssFile: (relPath) => readFileSync(path.join(nextDir, relPath), 'utf8'),
  });
  if (failures.length > 0) {
    console.error('✗ Route CSS check failed. These routes would render without the --mv-* tokens:');
    for (const failure of failures) console.error(`  - ${failure}`);
    console.error(
      'If this build restored .next/cache, a stale Turbopack build cache is the first suspect: rebuild without it.',
    );
    process.exit(1);
  }
  console.log(`✓ Route CSS check: ${ROUTES.length} routes ship the --mv-* tokens`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
