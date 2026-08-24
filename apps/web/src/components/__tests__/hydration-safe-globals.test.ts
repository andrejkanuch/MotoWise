import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guard: a `useState` initializer in a client component must not read a
 * browser-only global.
 *
 * The server has no `window`, so such an initializer resolves to the "absent"
 * branch during SSR and to the "present" branch on the client's *first* render
 * whenever the global happens to already be there. React compares that first
 * render against the server HTML, sees a different element, and throws the
 * hydration mismatch (#418) — discarding the whole server-rendered subtree.
 *
 * This has now shipped three times with the CDN-loaded `mapboxgl` global:
 *   - `trip-detail/trip-detail-map.tsx`  (fixed in b3490255, Sentry MOTOVAULT-WEB-J on /trips/*)
 *   - `explore/mapbox-map.tsx`           (fixed here, same issue on /explore/*)
 *   - `map-hero-interactive.tsx`         (fixed here, latent)
 *
 * It is invisible on a cold cache and in dev, which is why a review pass keeps
 * missing it — hence a source-level tripwire rather than a runtime test.
 *
 * The correct shape is: seed the state with the server's value, then detect the
 * global in `useEffect` (post-mount, after hydration has committed).
 *
 * Deliberately out of scope: `new Date()` / `Date.now()` initializers. Those
 * diverge only across a clock boundary and are used here for form defaults, not
 * for choosing which tree to render.
 */

const SRC_DIR = path.join(process.cwd(), 'src');

/** Reading any of these during render makes the first client render server-divergent. */
const BROWSER_ONLY_GLOBALS = [
  'globalThis',
  'window',
  'document',
  'localStorage',
  'sessionStorage',
  'navigator',
  'matchMedia',
] as const;

const USE_STATE = 'useState';

function collectClientComponents(dir: string, acc: string[]) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      collectClientComponents(abs, acc);
      continue;
    }
    if (!entry.name.endsWith('.tsx')) continue;
    const src = fs.readFileSync(abs, 'utf8');
    if (src.includes("'use client'") || src.includes('"use client"')) acc.push(abs);
  }
  return acc;
}

/** Text of the argument list of every `useState(...)` call, comments stripped. */
function useStateInitializers(src: string): { text: string; line: number }[] {
  const found: { text: string; line: number }[] = [];
  let cursor = 0;
  while (true) {
    const at = src.indexOf(USE_STATE, cursor);
    if (at === -1) return found;
    cursor = at + USE_STATE.length;

    // Skip the generic parameter list, if any: useState<Foo | null>(...)
    let i = cursor;
    if (src[i] === '<') {
      let angle = 0;
      for (; i < src.length; i++) {
        if (src[i] === '<') angle++;
        else if (src[i] === '>' && --angle === 0) {
          i++;
          break;
        }
      }
    }
    if (src[i] !== '(') continue;

    let depth = 0;
    const start = i + 1;
    for (; i < src.length; i++) {
      if (src[i] === '(') depth++;
      else if (src[i] === ')' && --depth === 0) break;
    }
    const raw = src.slice(start, i);
    found.push({
      text: raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''),
      line: src.slice(0, at).split('\n').length,
    });
    cursor = i;
  }
}

describe('hydration contract: no browser global in a useState initializer', () => {
  const files = collectClientComponents(SRC_DIR, []);

  it('finds the client components it is meant to protect (guard is not vacuous)', () => {
    expect(files.length).toBeGreaterThan(20);
    expect(files.some((f) => f.endsWith('mapbox-map.tsx'))).toBe(true);
  });

  it('parses a known useState initializer (extractor is not silently empty)', () => {
    const sample = 'const [a, setA] = useState<Foo | null>(() => window.foo ?? null);';
    expect(useStateInitializers(sample)).toEqual([{ text: '() => window.foo ?? null', line: 1 }]);
  });

  it('has no client component seeding useState from a browser-only global', () => {
    const violations = files.flatMap((file) => {
      const rel = path.relative(SRC_DIR, file);
      return useStateInitializers(fs.readFileSync(file, 'utf8'))
        .filter(({ text }) =>
          BROWSER_ONLY_GLOBALS.some((global) => new RegExp(`\\b${global}\\b`).test(text)),
        )
        .map(({ line, text }) => `${rel}:${line} — useState(${text.trim()})`);
    });

    expect(
      violations,
      'These initializers make the first client render diverge from the server HTML ' +
        '(React #418). Seed the state with the server value and detect the global in ' +
        'useEffect instead.',
    ).toEqual([]);
  });
});
