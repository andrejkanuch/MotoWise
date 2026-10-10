#!/usr/bin/env tsx
/**
 * Mobile structure checker (ts-morph).
 *
 * Holds the shape of `apps/mobile/src` with three ratchets and one closed
 * list. Violations that exist today are recorded in
 * `scripts/mobile-structure-baseline.json` and do not block; anything new does.
 *
 *   1. Deep imports: a specifier that climbs three or more directories to a
 *      TypeScript module under `apps/mobile/src` should be `@/…` instead.
 *      Specifiers that leave `src` (the carplay native module) and asset
 *      `require`s are allowed by rule.
 *   2. Layering (LAYERS): `utils` imports no `lib`, `stores`, `hooks` or UI,
 *      the shared layers import no UI, and nothing outside `app` imports
 *      `app`. Test files are exempt.
 *   3. Routes: a route file in the baseline may not grow past its recorded
 *      line count; any other route may not exceed ROUTE_LINE_CAP lines.
 *   4. Placement: LAYERS is a closed list. TypeScript in a top-level directory
 *      it does not declare, or directly in `src/`, fails; a new directory is
 *      declared there together with what it may not import.
 *
 * The baseline is also held tight: an entry that allows more than the tree
 * now has, or names a file that is gone, fails until the baseline is lowered.
 * A file that was cleaned up therefore cannot grow back to its old allowance.
 *
 * Runs via `pnpm check:mobile-structure`. Exits non-zero on any violation.
 * `--update` rewrites the baseline, but only downwards: it lowers counts and
 * removes entries that are fixed. Raising a number is a hand edit to the
 * baseline file, so it shows up in review.
 */
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { type Node, Project, type SourceFile, SyntaxKind } from 'ts-morph';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC_REL = 'apps/mobile/src';
const BASELINE_REL = 'scripts/mobile-structure-baseline.json';

const UPDATE_FLAG = '--update';
const ALIAS_PREFIX = '@/';
const DEEP_IMPORT_MIN_LEVELS = 3;
const ROUTE_LINE_CAP = 300;
const ROUTES_DIR = 'app';

/** The three ratchets: what the baseline file records. */
const RULE = {
  deepImports: 'deepImports',
  layering: 'layering',
  routes: 'routes',
} as const;

/** What a violation can be: a ratchet, or one of the two checks that take no baseline entry. */
const VIOLATION = {
  ...RULE,
  placement: 'placement',
  staleBaseline: 'staleBaseline',
} as const;
type ViolationKind = (typeof VIOLATION)[keyof typeof VIOLATION];

const UI_LAYERS = ['components', 'features', 'app'] as const;

/**
 * Every top-level directory of `src` that holds TypeScript, with the layers
 * it may not import. The list is closed: a directory missing from it fails
 * the placement check, so code cannot sidestep a rule by moving to a new one.
 *
 * `app`, `features`, `components`, `hooks`, `lib`, `stores`, `theme`, `config`
 * and `utils` carry the rules of "Where things go" in apps/mobile/CLAUDE.md.
 * That table does not rank `i18n`, `data`, `widgets`, `graphql` or `assets`.
 * `lib`, `stores` and `utils` import the first three, so all five get the
 * shared-layer rule (no UI); none of them imports UI today.
 */
const LAYERS: Readonly<Record<string, readonly string[]>> = {
  app: [],
  features: ['app'],
  components: ['app'],
  hooks: UI_LAYERS,
  lib: UI_LAYERS,
  stores: UI_LAYERS,
  theme: UI_LAYERS,
  config: UI_LAYERS,
  i18n: UI_LAYERS,
  data: UI_LAYERS,
  widgets: UI_LAYERS,
  graphql: UI_LAYERS,
  assets: UI_LAYERS,
  utils: ['lib', 'stores', 'hooks', ...UI_LAYERS],
};

/** Top-level directories that hold only tests and test support; TEST_FILE exempts their files. */
const TEST_ONLY_DIRS: readonly string[] = ['__tests__', 'test'];

const UPDATE_COMMAND = `pnpm check:mobile-structure ${UPDATE_FLAG}`;

const WHAT_TO_DO: Readonly<Record<ViolationKind, string>> = {
  [RULE.deepImports]: `Import through the alias instead: \`${ALIAS_PREFIX}<path from src>\`.`,
  [RULE.layering]:
    'Move the shared code down a layer, or pass it in from the caller. See "Where things go" in apps/mobile/CLAUDE.md.',
  [RULE.routes]: `Move the screen body, hooks and helpers out of the route into the domain's folder. A route not in the baseline is capped at ${ROUTE_LINE_CAP} lines.`,
  [VIOLATION.placement]:
    'Put the code in an existing directory, per "Where things go" in apps/mobile/CLAUDE.md. A new top-level directory is declared in LAYERS in scripts/check-mobile-structure.ts with the layers it may not import, so the choice shows up in review.',
  [VIOLATION.staleBaseline]: `Run \`${UPDATE_COMMAND}\` and commit ${BASELINE_REL}: it lowers these entries to what the tree has now. If a file was renamed, rename its key in the baseline by hand instead and keep the number, because ${UPDATE_FLAG} drops the entry and the new path then counts as new.`,
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
const DECLARATION_SUFFIX = '.d.ts';
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

type Violation = { rule: ViolationKind; file: string; detail: string };

/** The tree as measured: its counts in the shape of the baseline, every file seen, and what is misplaced. */
type Tree = { counts: Baseline; files: ReadonlySet<string>; misplaced: Violation[] };

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
function resolveToSrcModule(src: string, specifier: string, fromFile: string): string | null {
  let base: string;
  if (specifier.startsWith(ALIAS_PREFIX)) {
    base = path.join(src, specifier.slice(ALIAS_PREFIX.length));
  } else if (specifier.startsWith('.')) {
    base = path.resolve(path.dirname(fromFile), specifier);
  } else {
    return null;
  }
  if (path.relative(src, base).startsWith('..')) return null;

  const candidates = [base];
  for (const stem of [base, path.join(base, 'index')]) {
    for (const suffix of PLATFORM_SUFFIXES) {
      for (const extension of CODE_EXTENSIONS) candidates.push(`${stem}${suffix}${extension}`);
    }
  }
  const hit = candidates.find(
    (candidate) => CODE_EXTENSIONS.some((ext) => candidate.endsWith(ext)) && isFile(candidate),
  );
  return hit ? toPosix(path.relative(src, hit)) : null;
}

const leadingParents = (specifier: string): number =>
  specifier.match(/^(?:\.\.\/)+/)?.[0].length ?? 0;
const isDeep = (specifier: string): boolean =>
  leadingParents(specifier) >= DEEP_IMPORT_MIN_LEVELS * '../'.length;

const layerOf = (srcRelative: string): string | null =>
  srcRelative.includes('/') ? srcRelative.split('/')[0] : null;

function isForbidden(fromLayer: string | null, toLayer: string | null): boolean {
  if (fromLayer === null || toLayer === null || fromLayer === toLayer) return false;
  return LAYERS[fromLayer]?.includes(toLayer) ?? false;
}

/** Files that sit where LAYERS has no rule for them: directly in `src`, or in an undeclared directory. */
function misplacedIn(files: readonly string[]): Violation[] {
  const violations: Violation[] = [];
  const undeclared = new Map<string, number>();
  for (const file of files) {
    const layer = layerOf(file);
    if (layer === null) {
      violations.push({
        rule: VIOLATION.placement,
        file,
        detail: 'a TypeScript file directly in src/, where no layer rule applies to it',
      });
    } else if (!(layer in LAYERS) && !TEST_ONLY_DIRS.includes(layer)) {
      undeclared.set(layer, (undeclared.get(layer) ?? 0) + 1);
    }
  }
  for (const [layer, count] of undeclared) {
    violations.push({
      rule: VIOLATION.placement,
      file: `${layer}/`,
      detail: `\`${layer}\` is not a declared top-level directory (${count} TypeScript file(s) in it)`,
    });
  }
  return violations;
}

/** The tree under `src` as it stands. */
function measure(src: string): Tree {
  const project = new Project({
    tsConfigFilePath: undefined,
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { allowJs: false },
  });
  project.addSourceFilesAtPaths([`${toPosix(src)}/**/*.{ts,tsx}`, `!**/*${DECLARATION_SUFFIX}`]);

  const counts: Baseline = { [RULE.deepImports]: {}, [RULE.layering]: {}, [RULE.routes]: {} };
  const files: string[] = [];

  for (const sf of project.getSourceFiles()) {
    const filePath = sf.getFilePath();
    const file = toPosix(path.relative(src, filePath));
    // The negated glob above does not keep declaration files out.
    if (file.endsWith(DECLARATION_SUFFIX)) continue;
    const isTest = TEST_FILE.test(file);
    const fromLayer = layerOf(file);
    files.push(file);

    for (const specifier of moduleSpecifiers(sf)) {
      const target = resolveToSrcModule(src, specifier, filePath);
      if (!target) continue;

      if (isDeep(specifier)) {
        counts[RULE.deepImports][file] = (counts[RULE.deepImports][file] ?? 0) + 1;
      }
      if (!isTest && isForbidden(fromLayer, layerOf(target))) {
        const edges = counts[RULE.layering][file] ?? {};
        edges[target] = (edges[target] ?? 0) + 1;
        counts[RULE.layering][file] = edges;
      }
    }

    if (fromLayer === ROUTES_DIR && !isTest) {
      const lines = sf.getFullText().split('\n').length - 1;
      if (lines > ROUTE_LINE_CAP) counts[RULE.routes][file] = lines;
    }
  }
  return { counts, files: new Set(files), misplaced: misplacedIn(files) };
}

function readBaseline(baselinePath: string): Baseline | null {
  if (!existsSync(baselinePath)) return null;
  const parsed = JSON.parse(readFileSync(baselinePath, 'utf8')) as Partial<Baseline>;
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

function writeBaseline(baselinePath: string, baseline: Baseline): void {
  const sorted: Baseline = {
    [RULE.deepImports]: sortKeys(baseline[RULE.deepImports]),
    [RULE.layering]: sortKeys(
      Object.fromEntries(
        Object.entries(baseline[RULE.layering]).map(([file, edges]) => [file, sortKeys(edges)]),
      ),
    ),
    [RULE.routes]: sortKeys(baseline[RULE.routes]),
  };
  writeFileSync(baselinePath, `${JSON.stringify(sorted, null, 2)}\n`);
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

/** The baseline as `--update` writes it: every entry at most what the tree has now. */
export function lowered(baseline: Baseline, current: Baseline): Baseline {
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

/** What is new beyond the baseline. */
function grown(baseline: Baseline, { counts, files }: Tree): Violation[] {
  const violations: Violation[] = [];

  for (const [file, count] of Object.entries(counts[RULE.deepImports])) {
    const allowed = baseline[RULE.deepImports][file] ?? 0;
    if (count > allowed) {
      violations.push({
        rule: RULE.deepImports,
        file,
        detail: `${count} import(s) climb ${DEEP_IMPORT_MIN_LEVELS}+ directories to code under src; the baseline allows ${allowed}`,
      });
    }
  }

  for (const [file, edges] of Object.entries(counts[RULE.layering])) {
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

  // A baselined route that is gone may have been renamed to one of the new
  // ones: name it, so the author moves the entry instead of losing it.
  const goneRoutes = Object.entries(baseline[RULE.routes]).filter(([file]) => !files.has(file));
  for (const [file, lines] of Object.entries(counts[RULE.routes])) {
    const allowed = baseline[RULE.routes][file] ?? ROUTE_LINE_CAP;
    if (lines <= allowed) continue;
    if (file in baseline[RULE.routes]) {
      violations.push({
        rule: RULE.routes,
        file,
        detail: `${lines} lines; its baseline is ${allowed}`,
      });
      continue;
    }
    const renamedFrom = goneRoutes.filter(([, was]) => was >= lines).map(([gone]) => gone);
    const hint =
      renamedFrom.length > 0
        ? `. If this is ${renamedFrom.join(' or ')} renamed, rename that key in ${BASELINE_REL} to this path and keep its number`
        : '';
    violations.push({
      rule: RULE.routes,
      file,
      detail: `${lines} lines; the cap for a new route is ${allowed}${hint}`,
    });
  }
  return violations;
}

/** Baseline entries that allow more than the tree now has. */
function stale(baseline: Baseline, { counts, files }: Tree): Violation[] {
  const violations: Violation[] = [];
  const report = (file: string, detail: string) =>
    violations.push({ rule: VIOLATION.staleBaseline, file, detail });
  const gone = (file: string) => !files.has(file);
  const GONE = 'the file no longer exists';

  for (const [file, allowed] of Object.entries(baseline[RULE.deepImports])) {
    const now = counts[RULE.deepImports][file] ?? 0;
    if (gone(file)) report(file, `${RULE.deepImports}: ${GONE}`);
    else if (now < allowed)
      report(file, `${RULE.deepImports}: the baseline allows ${allowed}, the file has ${now}`);
  }

  for (const [file, edges] of Object.entries(baseline[RULE.layering])) {
    if (gone(file)) {
      report(file, `${RULE.layering}: ${GONE}`);
      continue;
    }
    for (const [target, allowed] of Object.entries(edges)) {
      const now = counts[RULE.layering][file]?.[target] ?? 0;
      if (now < allowed) {
        report(
          file,
          `${RULE.layering}: the baseline allows ${allowed} import(s) of ${target}, the file has ${now}`,
        );
      }
    }
  }

  for (const [file, allowed] of Object.entries(baseline[RULE.routes])) {
    const now = counts[RULE.routes][file];
    if (gone(file)) report(file, `${RULE.routes}: ${GONE}`);
    else if (now === undefined) {
      report(
        file,
        `${RULE.routes}: the baseline allows ${allowed} lines, the route is now within the ${ROUTE_LINE_CAP}-line cap`,
      );
    } else if (now < allowed) {
      report(file, `${RULE.routes}: the baseline allows ${allowed} lines, the route has ${now}`);
    }
  }
  return violations;
}

/** Every violation: what grew past the baseline, what is misplaced, and where the baseline is looser than the tree. */
export function compare(baseline: Baseline, tree: Tree): Violation[] {
  return [...grown(baseline, tree), ...tree.misplaced, ...stale(baseline, tree)];
}

const baselinePathOf = (root: string): string => path.join(root, BASELINE_REL);

/**
 * Checks the mobile app of the repository at `root` against its baseline.
 * With `update`, the baseline is lowered (or created) first. Returns null
 * when there is no baseline to check against.
 */
export function checkMobileStructure(
  root: string = ROOT,
  { update = false }: { update?: boolean } = {},
): { baseline: Baseline; violations: Violation[]; updated: 'lowered' | 'created' | null } | null {
  const tree = measure(path.join(root, SRC_REL));
  const baselinePath = baselinePathOf(root);
  const existing = readBaseline(baselinePath);

  // With no baseline yet, today's tree is the baseline. After that, downwards only.
  if (update) writeBaseline(baselinePath, existing ? lowered(existing, tree.counts) : tree.counts);

  const baseline = readBaseline(baselinePath);
  if (!baseline) return null;
  return {
    baseline,
    violations: compare(baseline, tree),
    updated: update ? (existing ? 'lowered' : 'created') : null,
  };
}

function main(): void {
  const result = checkMobileStructure(ROOT, { update: process.argv.includes(UPDATE_FLAG) });
  if (!result) {
    console.error(`\n✗ ${BASELINE_REL} is missing. Create it with: ${UPDATE_COMMAND}\n`);
    process.exit(1);
  }
  const { baseline, violations, updated } = result;
  if (updated) console.log(`${updated === 'lowered' ? 'Lowered' : 'Created'} ${BASELINE_REL}`);

  if (violations.length === 0) {
    const count = (record: Record<string, unknown>) => Object.keys(record).length;
    console.log(
      `✓ mobile structure OK — nothing new beyond the baseline, and the baseline is no looser than the tree (${count(baseline[RULE.deepImports])} files with deep imports, ${count(baseline[RULE.layering])} with layering edges, ${count(baseline[RULE.routes])} routes over ${ROUTE_LINE_CAP} lines)`,
    );
    return;
  }

  console.error(`\n✗ ${violations.length} mobile structure violation(s):\n`);
  for (const rule of Object.values(VIOLATION)) {
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
    `Existing violations are recorded in ${BASELINE_REL}. \`${UPDATE_COMMAND}\` only lowers that file. If this change must land as it is, raise the one entry there by hand (key "<rule>" → the file above) so the reviewer sees it.\n`,
  );
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
