import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import {
  isEngagedScreenName,
  NON_ENGAGED_LEGACY_SCREEN_NAMES,
  NON_ENGAGED_SCREEN_NAMES,
  NON_ENGAGED_SCREEN_PREFIXES,
} from '../engaged-routes';

/**
 * S3 "day-2 engaged return" (issue 365, board/06 F14) excludes home, What's New,
 * onboarding and sign-in screens by their `$screen_name`. A `$screen_name` is the
 * route template (lib/analytics-screen.ts), and older builds sent the bare
 * pathname, so renaming a route file silently changes which day-2 visits count
 * as engaged. This test ties every listed name to a route file that exists today:
 * rename one of those routes and it fails, so the list (and the SQL that reads it)
 * is updated in the same change.
 */
const APP_DIR = join(__dirname, '..', '..', 'app');
const LAYOUT_FILE = '_layout';
const INDEX_FILE = 'index';
const ROUTE_EXTENSION = /\.tsx?$/;
const GROUP_SEGMENT = /^\(.+\)$/;

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return ROUTE_EXTENSION.test(entry.name) ? [path] : [];
  });
}

/** `(tabs)/(home)/index.tsx` → `/(tabs)/(home)`; a layout names its directory. */
function templateOf(file: string): string {
  const segments = relative(APP_DIR, file).replace(ROUTE_EXTENSION, '').split(sep);
  const last = segments.at(-1);
  if (last === INDEX_FILE || last === LAYOUT_FILE) segments.pop();
  return `/${segments.join('/')}`;
}

/** Expo Router drops `(group)` segments from the pathname. */
function pathnameOf(template: string): string {
  const kept = template.split('/').filter((segment) => segment && !GROUP_SEGMENT.test(segment));
  return `/${kept.join('/')}`;
}

const templates = new Set(routeFiles(APP_DIR).map(templateOf));
const pathnames = new Set([...templates].map(pathnameOf));
const resolves = (name: string) => templates.has(name) || pathnames.has(name);

describe('F14 non-engaged screens vs route files', () => {
  it('finds the route tree', () => {
    expect(templates.has('/(tabs)/(home)')).toBe(true);
  });

  it.each([...NON_ENGAGED_SCREEN_NAMES])('%s is still a registered route', (name) => {
    expect(resolves(name)).toBe(true);
  });

  it.each([...NON_ENGAGED_SCREEN_PREFIXES])('%s is still a route group with screens', (prefix) => {
    expect([...templates].some((template) => template.startsWith(`${prefix}/`))).toBe(true);
  });

  it('keeps the legacy names honest: a route that comes back moves to the main list', () => {
    expect(NON_ENGAGED_LEGACY_SCREEN_NAMES.filter(resolves)).toEqual([]);
  });

  it('is the F14 list exactly (the S3 baseline 37/367 was computed with it)', () => {
    expect([...NON_ENGAGED_SCREEN_NAMES, ...NON_ENGAGED_LEGACY_SCREEN_NAMES].sort()).toEqual(
      [
        '/',
        '/(tabs)/(home)',
        '/(tabs)',
        '/whats-new',
        '/(modals)/whats-new',
        '/login',
        '/account',
        '/commitment',
        '/goals',
        '/reveal',
        '/bike-setup',
        '/personalizing',
        '/notifications',
        '/paywall',
        '/heard-about',
        '/experience',
        '/welcome',
        '/consent',
        '/no-bike-value',
      ].sort(),
    );
    expect([...NON_ENGAGED_SCREEN_PREFIXES]).toEqual(['/(onboarding)', '/(auth)']);
  });
});

describe('isEngagedScreenName', () => {
  it.each([
    '/(tabs)/(garage)',
    '/(tabs)/(garage)/bike/[id]',
    '/(tabs)/(discover)',
    '/(modals)/start-ride',
    '/(tabs)/(home)/add-expense',
  ])('%s is engaged', (name) => {
    expect(isEngagedScreenName(name)).toBe(true);
  });

  it.each([
    '/',
    '/(tabs)/(home)',
    '/(modals)/whats-new',
    '/goals',
    '/welcome',
    '/(onboarding)/goals',
    '/(onboarding)',
    '/(auth)/login',
  ])('%s is not engaged', (name) => {
    expect(isEngagedScreenName(name)).toBe(false);
  });
});
