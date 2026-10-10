#!/usr/bin/env tsx
/**
 * Mobile alias codemod (ts-morph).
 *
 * Rewrites a module specifier in `apps/mobile/src` that climbs three or more
 * directories into the `@/` alias from `apps/mobile/tsconfig.json`:
 *
 *   import { palette } from '../../../theme/palette';   →   '@/theme/palette'
 *
 * It replaces the text inside the string literal and nothing else: no
 * statement moves, no quote changes, no formatting. Import order is Biome's
 * job afterwards (`pnpm lint:fix`).
 *
 * A specifier is rewritten only when it resolves to a TypeScript module under
 * `apps/mobile/src`. Left relative, and listed in the report:
 *   - specifiers that leave `src` (the carplay native module under
 *     `apps/mobile/modules`),
 *   - specifiers that resolve to anything else (asset `require`s, JSON).
 *
 * Before writing, the old and the new specifier are both resolved and the run
 * aborts without touching a file if any pair differs.
 *
 * Usage:
 *   tsx scripts/codemod-mobile-alias.ts            report what a run would do
 *   tsx scripts/codemod-mobile-alias.ts --check    exit 1 if a run would change a file
 *   tsx scripts/codemod-mobile-alias.ts --write    rewrite the files
 */
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { type Node, Project, type SourceFile, SyntaxKind } from 'ts-morph';

const ROOT = path.resolve(import.meta.dirname, '..');
const MOBILE = path.join(ROOT, 'apps/mobile');
const SRC = path.join(MOBILE, 'src');
const TSCONFIG_PATH = path.join(MOBILE, 'tsconfig.json');

const MODE = {
  report: 'report',
  check: 'check',
  write: 'write',
} as const;
type Mode = (typeof MODE)[keyof typeof MODE];

const MODE_FLAGS: Readonly<Record<string, Mode>> = {
  '--check': MODE.check,
  '--write': MODE.write,
};

const ALIAS_PATTERN = '@/*';
const ALIAS_PREFIX = '@/';
const PARENT_SEGMENT = '../';
const DEEP_IMPORT_MIN_LEVELS = 3;

const KIND = {
  importExport: 'import / export … from',
  dynamicImport: 'import()',
  require: 'require()',
  jest: 'jest.*()',
} as const;
type Kind = (typeof KIND)[keyof typeof KIND];

/** Module-loading calls whose first argument is a specifier, beyond `import` and `export … from`. */
const SPECIFIER_CALLS: Readonly<Record<string, Kind>> = {
  require: KIND.require,
  'jest.mock': KIND.jest,
  'jest.doMock': KIND.jest,
  'jest.unmock': KIND.jest,
  'jest.requireActual': KIND.jest,
  'jest.requireMock': KIND.jest,
};

const SKIP_REASON = {
  outsideSrc: 'resolves outside apps/mobile/src',
  notCode: 'does not resolve to a .ts/.tsx module (asset or data file)',
} as const;
type SkipReason = (typeof SKIP_REASON)[keyof typeof SKIP_REASON];

const CODE_EXTENSIONS = ['.ts', '.tsx'] as const;
const PLATFORM_SUFFIXES = ['', '.ios', '.android', '.native', '.web'] as const;
const TEST_FILE = /(^|\/)(__tests__|__mocks__|test)\/|\.(test|spec)\.tsx?$/;

type Literal = { kind: Kind; value: string; start: number; end: number };
type Rewrite = Literal & { file: string; replacement: string };
type Skip = { file: string; specifier: string; reason: SkipReason };

const toPosix = (p: string): string => p.split(path.sep).join('/');
const isFile = (p: string): boolean => existsSync(p) && statSync(p).isFile();

/** Every module specifier literal in a file, with the span of the text between its quotes. */
function specifierLiterals(sf: SourceFile): Literal[] {
  const out: Literal[] = [];
  const push = (node: Node | undefined, kind: Kind) => {
    if (node?.getKind() !== SyntaxKind.StringLiteral) return;
    out.push({
      kind,
      value: node.getText().slice(1, -1),
      start: node.getStart() + 1,
      end: node.getEnd() - 1,
    });
  };

  for (const decl of sf.getImportDeclarations()) {
    push(decl.getModuleSpecifier(), KIND.importExport);
  }
  for (const decl of sf.getExportDeclarations()) {
    push(decl.getModuleSpecifier(), KIND.importExport);
  }
  for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const callee = call.getExpression();
    const kind =
      callee.getKind() === SyntaxKind.ImportKeyword
        ? KIND.dynamicImport
        : SPECIFIER_CALLS[callee.getText()];
    if (kind) push(call.getArguments()[0], kind);
  }
  return out;
}

/** The TypeScript module an extensionless path points at, or null when there is none. */
function resolveCodeModule(base: string): string | null {
  const candidates = [base];
  for (const stem of [base, path.join(base, 'index')]) {
    for (const suffix of PLATFORM_SUFFIXES) {
      for (const extension of CODE_EXTENSIONS) candidates.push(`${stem}${suffix}${extension}`);
    }
  }
  return (
    candidates.find(
      (candidate) => CODE_EXTENSIONS.some((ext) => candidate.endsWith(ext)) && isFile(candidate),
    ) ?? null
  );
}

/** Where `@/*` points, read from the mobile tsconfig so the codemod and the compiler cannot disagree. */
function aliasTargetDir(): string {
  const { compilerOptions } = JSON.parse(readFileSync(TSCONFIG_PATH, 'utf8')) as {
    compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> };
  };
  const target = compilerOptions?.paths?.[ALIAS_PATTERN]?.[0];
  if (!target?.endsWith('/*')) {
    throw new Error(
      `${toPosix(path.relative(ROOT, TSCONFIG_PATH))} has no "${ALIAS_PATTERN}" path`,
    );
  }
  return path.resolve(MOBILE, compilerOptions?.baseUrl ?? '.', target.slice(0, -'/*'.length));
}

const isDeep = (specifier: string): boolean =>
  specifier.startsWith(PARENT_SEGMENT.repeat(DEEP_IMPORT_MIN_LEVELS));

function plan(): { rewrites: Rewrite[]; skips: Skip[]; mismatches: string[] } {
  const aliasDir = aliasTargetDir();
  const project = new Project({
    tsConfigFilePath: undefined,
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { allowJs: false },
  });
  project.addSourceFilesAtPaths([`${toPosix(SRC)}/**/*.{ts,tsx}`, '!**/*.d.ts']);

  const rewrites: Rewrite[] = [];
  const skips: Skip[] = [];
  const mismatches: string[] = [];

  for (const sf of project.getSourceFiles()) {
    const filePath = sf.getFilePath();
    const file = toPosix(path.relative(SRC, filePath));

    for (const literal of specifierLiterals(sf)) {
      if (!isDeep(literal.value)) continue;

      const base = path.resolve(path.dirname(filePath), literal.value);
      const fromSrc = toPosix(path.relative(SRC, base));
      if (fromSrc === '' || fromSrc.startsWith('..')) {
        skips.push({ file, specifier: literal.value, reason: SKIP_REASON.outsideSrc });
        continue;
      }
      const oldTarget = resolveCodeModule(base);
      if (!oldTarget) {
        skips.push({ file, specifier: literal.value, reason: SKIP_REASON.notCode });
        continue;
      }

      const replacement = `${ALIAS_PREFIX}${fromSrc}`;
      const newTarget = resolveCodeModule(
        path.join(aliasDir, replacement.slice(ALIAS_PREFIX.length)),
      );
      if (newTarget !== oldTarget) {
        mismatches.push(
          `${file}: '${literal.value}' → ${oldTarget}, but '${replacement}' → ${newTarget}`,
        );
        continue;
      }
      rewrites.push({ ...literal, file, replacement });
    }
  }
  return { rewrites, skips, mismatches };
}

function groupByFile(rewrites: readonly Rewrite[]): Map<string, Rewrite[]> {
  const byFile = new Map<string, Rewrite[]>();
  for (const rewrite of rewrites) {
    byFile.set(rewrite.file, [...(byFile.get(rewrite.file) ?? []), rewrite]);
  }
  return byFile;
}

/** Applies the spans back to front so earlier offsets stay valid. Every other byte is untouched. */
function apply(byFile: Map<string, Rewrite[]>): void {
  for (const [file, fileRewrites] of byFile) {
    const filePath = path.join(SRC, file);
    let text = readFileSync(filePath, 'utf8');
    for (const { start, end, replacement } of [...fileRewrites].sort((a, b) => b.start - a.start)) {
      text = `${text.slice(0, start)}${replacement}${text.slice(end)}`;
    }
    writeFileSync(filePath, text);
  }
}

function report(rewrites: readonly Rewrite[], skips: readonly Skip[], fileCount: number): void {
  console.log(
    `${rewrites.length} specifier(s) in ${fileCount} file(s) would become ${ALIAS_PREFIX}…`,
  );
  for (const kind of Object.values(KIND)) {
    console.log(`  ${String(rewrites.filter((r) => r.kind === kind).length).padStart(5)}  ${kind}`);
  }

  const perLayer = new Map<string, Set<string>>();
  for (const { file } of rewrites) {
    if (TEST_FILE.test(file)) continue;
    const layer = file.includes('/') ? file.split('/')[0] : '(src root)';
    perLayer.set(layer, (perLayer.get(layer) ?? new Set()).add(file));
  }
  console.log('\nNon-test files per top-level directory:');
  for (const [layer, files] of [...perLayer].sort(([a], [b]) => (a < b ? -1 : 1))) {
    console.log(`  ${String(files.size).padStart(5)}  ${layer}`);
  }

  console.log(`\n${skips.length} deep specifier(s) left relative:`);
  for (const skip of skips) {
    console.log(`  ${skip.file}: '${skip.specifier}' — ${skip.reason}`);
  }
}

const mode: Mode = process.argv.map((arg) => MODE_FLAGS[arg]).find(Boolean) ?? MODE.report;
const { rewrites, skips, mismatches } = plan();

if (mismatches.length > 0) {
  console.error(
    `\n✗ ${mismatches.length} specifier(s) would resolve to a different module. Nothing was written.\n`,
  );
  for (const mismatch of mismatches) console.error(`  ${mismatch}`);
  process.exit(2);
}

const byFile = groupByFile(rewrites);

const RUN: Readonly<Record<Mode, () => number>> = {
  [MODE.report]: () => {
    report(rewrites, skips, byFile.size);
    return 0;
  },
  [MODE.check]: () => {
    if (rewrites.length === 0) {
      console.log(`✓ no deep relative import to code under apps/mobile/src`);
      return 0;
    }
    console.error(
      `\n✗ ${rewrites.length} specifier(s) in ${byFile.size} file(s) should use ${ALIAS_PREFIX}…\n`,
    );
    for (const file of byFile.keys()) console.error(`  apps/mobile/src/${file}`);
    console.error(
      '\nfix: pnpm exec tsx scripts/codemod-mobile-alias.ts --write, then pnpm lint:fix\n',
    );
    return 1;
  },
  [MODE.write]: () => {
    apply(byFile);
    console.log(`Rewrote ${rewrites.length} specifier(s) in ${byFile.size} file(s).`);
    return 0;
  },
};

process.exit(RUN[mode]());
