import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guard: no `Intl` constructor or `toLocale*` formatter may receive a *dynamic*
 * locale argument.
 *
 * The `[locale]` route segment is untrusted. `src/proxy.ts` matches
 * `/((?!api|_next|_vercel|apple-app-site-association|.*\..*).*)`, and that
 * `.*\..*` clause excludes any path containing a dot — so
 * `/motovault.app/blog/<slug>` (a crawler following a site-absolute link that
 * lost its scheme) never reaches the next-intl middleware and arrives at
 * `[locale]/(marketing)/blog/[slug]` with `locale === 'motovault.app'`.
 * `components/marketing/author-byline.tsx` passed that straight to
 * `toLocaleDateString`, which threw `RangeError: Incorrect locale information
 * provided` — a hard 500 on an indexable route (Sentry MOTOVAULT-WEB-16).
 *
 * Per MDN, `Intl.getCanonicalLocales` throws `RangeError: invalid language tag`
 * on a structurally malformed tag, and the `Intl` constructors behave the same
 * way — so *any* unvalidated string reaching them is a latent 500. Rather than
 * sanitising at each call site, the rule is: pass a literal, or go through
 * next-intl's formatter (`getFormatter()` / `useFormatter()`), which takes its
 * locale from `src/i18n/request.ts` — already narrowed by `hasLocale()` with a
 * `routing.defaultLocale` fallback, so a bogus segment cannot reach `Intl` at
 * all.
 *
 * A literal argument is allowed because it cannot come from a request.
 */

const SRC_DIR = path.join(process.cwd(), 'src');

/** Every call that takes a BCP-47 locale tag as its first argument. */
const LOCALE_SINKS = [
  'Intl.Collator',
  'Intl.DateTimeFormat',
  'Intl.DisplayNames',
  'Intl.DurationFormat',
  'Intl.ListFormat',
  'Intl.NumberFormat',
  'Intl.PluralRules',
  'Intl.RelativeTimeFormat',
  'Intl.Segmenter',
  'Intl.getCanonicalLocales',
  '.toLocaleDateString',
  '.toLocaleTimeString',
  '.toLocaleString',
] as const;

const LITERAL_ARG = /^(?:'[^']*'|"[^"]*"|`[^`$]*`|undefined)$/;

/**
 * Blank out comment content so prose describing a bad call (including the
 * explanation above) is not reported as one. Line numbers are preserved.
 *
 * Only block comments and whole-line `//` / ` * ` comments are stripped —
 * stripping from any `//` would eat the rest of a line holding a URL literal
 * and could hide a real call site.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((line) => {
      const trimmed = line.trimStart();
      return trimmed.startsWith('//') || trimmed.startsWith('*') ? '' : line;
    })
    .join('\n');
}

function collectSourceFiles(dir: string, acc: string[]) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      collectSourceFiles(abs, acc);
      continue;
    }
    if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) acc.push(abs);
  }
  return acc;
}

/** The first argument of each `sink(...)` call, or `''` when called with none. */
function firstArguments(src: string, sink: string): { arg: string; line: number }[] {
  const found: { arg: string; line: number }[] = [];
  let cursor = 0;
  while (true) {
    const at = src.indexOf(sink, cursor);
    if (at === -1) return found;
    cursor = at + sink.length;
    if (src[cursor] !== '(') continue;

    let depth = 0;
    let i = cursor;
    const start = i + 1;
    let firstComma = -1;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (ch === '(' || ch === '[' || ch === '{') depth++;
      else if (ch === ')' && --depth === 0) break;
      else if (ch === ']' || ch === '}') depth--;
      else if (ch === ',' && depth === 1 && firstComma === -1) firstComma = i;
    }
    const end = firstComma === -1 ? i : firstComma;
    found.push({
      arg: src.slice(start, end).trim(),
      line: src.slice(0, at).split('\n').length,
    });
    cursor = i;
  }
}

describe('Intl contract: no dynamic locale reaches an Intl formatter', () => {
  const files = collectSourceFiles(SRC_DIR, []);

  it('finds the call sites it is meant to protect (guard is not vacuous)', () => {
    const total = files.reduce((sum, file) => {
      const src = stripComments(fs.readFileSync(file, 'utf8'));
      return sum + LOCALE_SINKS.reduce((n, sink) => n + firstArguments(src, sink).length, 0);
    }, 0);
    // ~40 hardcoded 'en-US' call sites live in this app today.
    expect(total).toBeGreaterThan(20);
  });

  it('classifies literal vs dynamic first arguments correctly', () => {
    expect(firstArguments("d.toLocaleDateString('en-US', {x: 1})", '.toLocaleDateString')).toEqual([
      { arg: "'en-US'", line: 1 },
    ]);
    expect(firstArguments('n.toLocaleString()', '.toLocaleString')).toEqual([{ arg: '', line: 1 }]);
    expect(firstArguments('d.toLocaleDateString(locale, {})', '.toLocaleDateString')).toEqual([
      { arg: 'locale', line: 1 },
    ]);
    expect(LITERAL_ARG.test("'en-US'")).toBe(true);
    expect(LITERAL_ARG.test('undefined')).toBe(true);
    expect(LITERAL_ARG.test('locale')).toBe(false);
    // An interpolating template is dynamic. Assembled from pieces so the `${`
    // never appears literally in a quoted string (Biome flags that as a typo).
    const interpolatingTemplate = ['`$', '{locale}`'].join('');
    expect(LITERAL_ARG.test(interpolatingTemplate)).toBe(false);
    expect(LITERAL_ARG.test('`no-expression`')).toBe(true);
  });

  it('ignores calls that only appear in prose', () => {
    const doc = ['/**', ' * Do not use d.toLocaleDateString(locale) here.', ' */'].join('\n');
    expect(firstArguments(stripComments(doc), '.toLocaleDateString')).toEqual([]);
    // A URL literal must survive stripping, or a real call could be hidden.
    const withUrl = "const u = 'https://api.mapbox.com/x'; d.toLocaleDateString(locale);";
    expect(firstArguments(stripComments(withUrl), '.toLocaleDateString')).toEqual([
      { arg: 'locale', line: 1 },
    ]);
  });

  it('has no Intl call site taking a non-literal locale', () => {
    const violations = files.flatMap((file) => {
      const rel = path.relative(SRC_DIR, file);
      const src = stripComments(fs.readFileSync(file, 'utf8'));
      return LOCALE_SINKS.flatMap((sink) =>
        firstArguments(src, sink)
          .filter(({ arg }) => arg !== '' && !LITERAL_ARG.test(arg))
          .map(({ line, arg }) => `${rel}:${line} — ${sink}(${arg})`),
      );
    });

    expect(
      violations,
      'A locale from the request must never reach Intl directly — a malformed tag ' +
        "throws RangeError and 500s the route (MOTOVAULT-WEB-16). Use next-intl's " +
        'getFormatter()/useFormatter(), which resolves the locale through ' +
        'hasLocale() in src/i18n/request.ts.',
    ).toEqual([]);
  });
});
