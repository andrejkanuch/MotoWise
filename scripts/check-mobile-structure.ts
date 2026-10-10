#!/usr/bin/env tsx
/**
 * Mobile structure checker (ts-morph).
 *
 * Holds the shape of `apps/mobile/src` with three ratchets. Violations that
 * exist today are recorded in `scripts/mobile-structure-baseline.json` and do
 * not block; anything new does.
 *
 *   1. Deep imports: a specifier that climbs three or more directories to a
 *      TypeScript module under `apps/mobile/src` should be `@/…` instead.
 *      Specifiers that leave `src` (the carplay native module) and asset
 *      `require`s are allowed by rule.
 *   2. Layering (LAYER_RULES): `utils` imports no other layer, the shared
 *      layers import no UI, and nothing outside `app` imports `app`. Test
 *      files are exempt.
 *   3. Routes: a route file in the baseline may not grow past its recorded
 *      line count; any other route may not exceed ROUTE_LINE_CAP lines.
 *
 * Runs via `pnpm check:mobile-structure`. Exits non-zero on any violation.
 * `--update` rewrites the baseline, but only downwards: it lowers counts and
 * removes entries that are fixed. Raising a number is a hand edit to the
 * baseline file, so it shows up in review.
 */
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { type Node, Project, type SourceFile, SyntaxKind } from 'ts-morph';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'apps/mobile/src');
const BASELINE_REL = 'scripts/mobile-structure-baseline.json';
const BASELINE_PATH = path.join(ROOT, BASELINE_REL);

const UPDATE_FLAG = '--update';
const ALIAS_PREFIX = '@/';
const DEEP_IMPORT_MIN_LEVELS = 3;
const ROUTE_LINE_CAP = 300;
const ROUTES_DIR = 'app';

const RULE = {
  deepImports: 'deepImports',
  layering: 'layering',
  routes: 'routes',
} as const;
type Rule = (typeof RULE)[keyof typeof RULE];

/** `from` may not import `forbidden`. `from: null` means every layer except the forbidden one. */
const LAYER_RULES = [
  {
    from: ['utils'],
    forbidden: ['lib', 'stores', 'hooks', 'components', 'features', 'app'],
  },
  {
    from: ['lib', 'hooks', 'stores', 'theme', 'config'],
    forbidden: ['components', 'features', 'app'],
  },
  { from: null, forbidden: ['app'] },
] as const;

const WHAT_TO_DO: Readonly<Record<Rule, string>> = {
  [RULE.deepImports]: `Import through the alias instead: \`${ALIAS_PREFIX}<path from src>\`.`,
  [RULE.layering]:
    'Move the shared code down a layer, or pass it in from the caller. See "Where things go" in apps/mobile/CLAUDE.md.',
  [RULE.routes]: `Move the screen body, hooks and helpers out of the route into the domain's folder. A route not in the baseline is capped at ${ROUTE_LINE_CAP} lines.`,
};

/** Module-loading calls whose first argument is a specifier, beyond `import` and `export … from`. */
const SPECIFIER_CALLS: ReadonlySet<string> = new Set([
  'require',
  'jest.mock',
  'jest.doMock',
  'jest.unmock',
  'jest.requireActual',
  'jest.requireMock',
]);

const CODE_EXTENSIONS = ['.ts', '.tsx'] as const;
const PLATFORM_SUFFIXES = ['', '.ios', '.android', '.native', '.web'] as const;
const TEST_FILE = /(^|\/)(__tests__|__mocks__|test)\/|\.(test|spec)\.tsx?$/;

type Baseline = {
  /** file -> number of deep specifiers to code under src */
  [RULE.deepImports]: Record<string, number>;
  /** file -> forbidden target module -> number of specifiers */
  [RULE.layering]: Record<string, Record<string, number>>;
  /** route file -> line count, for routes over the cap */
  [RULE.routes]: Record<string, number>;
};

type Violation = { rule: Rule; file: string; detail: string };

const toPosix = (p: string): string => p.split(path.sep).join('/');
const isFile = (p: string): boolean => existsSync(p) && statSync(p).isFile();

/** Every module specifier in a file: imports, re-exports, `import()`, `require()` and the jest calls. */
function moduleSpecifiers(sf: SourceFile): string[] {
  const out: string[] = [];
  const pushLiteral = (node: Node | undefined) => {
    if (node?.getKind() === SyntaxKind.StringLiteral) out.push(node.getText().slice(1, -1));
  };

  for (const decl of sf.getImportDeclarations()) out.push(decl.getModuleSpecifierValue());
  for (const decl of sf.getExportDeclarations()) {
    const value = decl.getModuleSpecifierValue();
    if (value) out.push(value);
  }
  for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const callee = call.getExpression();
    const isDynamicImport = callee.getKind() === SyntaxKind.ImportKeyword;
    if (isDynamicImport || SPECIFIER_CALLS.has(callee.getText())) {
      pushLiteral(call.getArguments()[0]);
    }
  }
  return out;
}

/**
 * The TypeScript module under `src` that a specifier points at, as a path
 * relative to `src`, or null when it points anywhere else (a package, an
 * asset, a JSON file, or outside `src`).
 */
function resolveToSrcModule(specifier: string, fromFile: string): string | null {
  let base: string;
  if (specifier.startsWith(ALIAS_PREFIX)) {
    base = path.join(SRC, specifier.slice(ALIAS_PREFIX.length));
  } else if (specifier.startsWith('.')) {
    base = path.resolve(path.dirname(fromFile), specifier);
  } else {
    return null;
  }
  if (path.relative(SRC, base).startsWith('..')) return null;

  const candidates = [base];
  for (const stem of [base, path.join(base, 'index')]) {
    for (const suffix of PLATFORM_SUFFIXES) {
      for (const extension of CODE_EXTENSIONS) candidates.push(`${stem}${suffix}${extension}`);
    }
  }
  const hit = candidates.find(
    (candidate) => CODE_EXTENSIONS.some((ext) => candidate.endsWith(ext)) && isFile(candidate),
  );
  return hit ? toPosix(path.relative(SRC, hit)) : null;
}

const leadingParents = (specifier: string): number =>
  specifier.match(/^(?:\.\.\/)+/)?.[0].length ?? 0;
const isDeep = (specifier: string): boolean =>
  leadingParents(specifier) >= DEEP_IMPORT_MIN_LEVELS * '../'.length;

const layerOf = (srcRelative: string): string | null =>
  srcRelative.includes('/') ? srcRelative.split('/')[0] : null;

function isForbidden(fromLayer: string | null, toLayer: string | null): boolean {
  if (toLayer === null || fromLayer === toLayer) return false;
  return LAYER_RULES.some(
    (rule) =>
      (rule.forbidden as readonly string[]).includes(toLayer) &&
      (rule.from === null ||
        (fromLayer !== null && (rule.from as readonly string[]).includes(fromLayer))),
  );
}

/** The tree as it stands, in the shape of the baseline. */
function measure(): Baseline {
  const project = new Project({
    tsConfigFilePath: undefined,
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { allowJs: false },
  });
  project.addSourceFilesAtPaths([`${toPosix(SRC)}/**/*.{ts,tsx}`, '!**/*.d.ts']);

  const current: Baseline = { [RULE.deepImports]: {}, [RULE.layering]: {}, [RULE.routes]: {} };

  for (const sf of project.getSourceFiles()) {
    const filePath = sf.getFilePath();
    const file = toPosix(path.relative(SRC, filePath));
    const isTest = TEST_FILE.test(file);
    const fromLayer = layerOf(file);

    for (const specifier of moduleSpecifiers(sf)) {
      const target = resolveToSrcModule(specifier, filePath);
      if (!target) continue;

      if (isDeep(specifier)) {
        current[RULE.deepImports][file] = (current[RULE.deepImports][file] ?? 0) + 1;
      }
      if (!isTest && isForbidden(fromLayer, layerOf(target))) {
        const edges = current[RULE.layering][file] ?? {};
        edges[target] = (edges[target] ?? 0) + 1;
        current[RULE.layering][file] = edges;
      }
    }

    if (fromLayer === ROUTES_DIR && !isTest) {
      const lines = sf.getFullText().split('\n').length - 1;
      if (lines > ROUTE_LINE_CAP) current[RULE.routes][file] = lines;
    }
  }
  return current;
}

function readBaseline(): Baseline | null {
  if (!existsSync(BASELINE_PATH)) return null;
  const parsed = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Partial<Baseline>;
  return {
    [RULE.deepImports]: parsed[RULE.deepImports] ?? {},
    [RULE.layering]: parsed[RULE.layering] ?? {},
    [RULE.routes]: parsed[RULE.routes] ?? {},
  };
}

function sortKeys<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
}

function writeBaseline(baseline: Baseline): void {
  const sorted: Baseline = {
    [RULE.deepImports]: sortKeys(baseline[RULE.deepImports]),
    [RULE.layering]: sortKeys(
      Object.fromEntries(
        Object.entries(baseline[RULE.layering]).map(([file, edges]) => [file, sortKeys(edges)]),
      ),
    ),
    [RULE.routes]: sortKeys(baseline[RULE.routes]),
  };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
}

/** Keeps only what the baseline already allowed, at the lower of the two counts. Never adds, never raises. */
function lowerCounts(
  allowed: Record<string, number>,
  current: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, limit] of Object.entries(allowed)) {
    const now = current[key] ?? 0;
    if (now > 0) out[key] = Math.min(limit, now);
  }
  return out;
}

function lowered(baseline: Baseline, current: Baseline): Baseline {
  const layering: Baseline[typeof RULE.layering] = {};
  for (const [file, edges] of Object.entries(baseline[RULE.layering])) {
    const kept = lowerCounts(edges, current[RULE.layering][file] ?? {});
    if (Object.keys(kept).length > 0) layering[file] = kept;
  }
  return {
    [RULE.deepImports]: lowerCounts(baseline[RULE.deepImports], current[RULE.deepImports]),
    [RULE.layering]: layering,
    [RULE.routes]: lowerCounts(baseline[RULE.routes], current[RULE.routes]),
  };
}

function compare(baseline: Baseline, current: Baseline): Violation[] {
  const violations: Violation[] = [];

  for (const [file, count] of Object.entries(current[RULE.deepImports])) {
    const allowed = baseline[RULE.deepImports][file] ?? 0;
    if (count > allowed) {
      violations.push({
        rule: RULE.deepImports,
        file,
        detail: `${count} import(s) climb ${DEEP_IMPORT_MIN_LEVELS}+ directories to code under src; the baseline allows ${allowed}`,
      });
    }
  }

  for (const [file, edges] of Object.entries(current[RULE.layering])) {
    for (const [target, count] of Object.entries(edges)) {
      const allowed = baseline[RULE.layering][file]?.[target] ?? 0;
      if (count > allowed) {
        violations.push({
          rule: RULE.layering,
          file,
          detail: `\`${layerOf(file) ?? 'src'}\` may not import \`${layerOf(target)}\`: imports ${target} (${count}×, the baseline allows ${allowed})`,
        });
      }
    }
  }

  for (const [file, lines] of Object.entries(current[RULE.routes])) {
    const allowed = baseline[RULE.routes][file] ?? ROUTE_LINE_CAP;
    if (lines > allowed) {
      const source = file in baseline[RULE.routes] ? 'its baseline' : 'the cap for a new route';
      violations.push({
        rule: RULE.routes,
        file,
        detail: `${lines} lines; ${source} is ${allowed}`,
      });
    }
  }
  return violations;
}

const update = process.argv.includes(UPDATE_FLAG);
const current = measure();
const existing = readBaseline();

if (update) {
  // With no baseline yet, today's tree is the baseline. After that, downwards only.
  writeBaseline(existing ? lowered(existing, current) : current);
  console.log(`${existing ? 'Lowered' : 'Created'} ${BASELINE_REL}`);
}

const baseline = readBaseline();
if (!baseline) {
  console.error(
    `\n✗ ${BASELINE_REL} is missing. Create it with: pnpm check:mobile-structure ${UPDATE_FLAG}\n`,
  );
  process.exit(1);
}

const violations = compare(baseline, current);

if (violations.length === 0) {
  const count = (record: Record<string, unknown>) => Object.keys(record).length;
  console.log(
    `✓ mobile structure OK — nothing new beyond the baseline (${count(baseline[RULE.deepImports])} files with deep imports, ${count(baseline[RULE.layering])} with layering edges, ${count(baseline[RULE.routes])} routes over ${ROUTE_LINE_CAP} lines)`,
  );
  process.exit(0);
}

console.error(`\n✗ ${violations.length} mobile structure violation(s):\n`);
for (const rule of Object.values(RULE)) {
  const ofRule = violations.filter((v) => v.rule === rule);
  if (ofRule.length === 0) continue;
  console.error(`  rule: ${rule}`);
  for (const v of ofRule) {
    console.error(`    apps/mobile/src/${v.file}`);
    console.error(`        ${v.detail}`);
  }
  console.error(`    fix: ${WHAT_TO_DO[rule]}\n`);
}
console.error(
  `Existing violations are recorded in ${BASELINE_REL}. \`pnpm check:mobile-structure ${UPDATE_FLAG}\` only lowers that file. If this change must land as it is, raise the one entry there by hand (key "<rule>" → the file above) so the reviewer sees it.\n`,
);
process.exit(1);
