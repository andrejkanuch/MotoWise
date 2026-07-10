#!/usr/bin/env tsx
/**
 * Architecture boundary checker (ts-morph).
 *
 * Enforces the monorepo rules from CLAUDE.md that Biome cannot express:
 *
 *   1. Types flow ONE direction: packages/ -> apps/. A file under packages/**
 *      must NEVER import from an app (`@motovault/{api,web,mobile}`, or a
 *      relative path that escapes into apps/).
 *   2. No relative imports that cross a package boundary. Code under
 *      packages/<pkg>/ must not reach into a sibling package via `../<other>`;
 *      use the `@motovault/<other>` alias instead.
 *
 * Runs in CI and via `pnpm check:arch`. Exits non-zero on any violation.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Project, type SourceFile, SyntaxKind } from 'ts-morph';

const ROOT = path.resolve(import.meta.dirname, '..');

const APP_PACKAGE_NAMES = ['@motovault/api', '@motovault/web', '@motovault/mobile'] as const;

type Violation = { file: string; line: number; specifier: string; rule: string };

/** All module specifiers in a file: static imports, re-exports, and dynamic import(). */
function moduleSpecifiers(sf: SourceFile): Array<{ value: string; line: number }> {
  const out: Array<{ value: string; line: number }> = [];

  for (const decl of sf.getImportDeclarations()) {
    out.push({ value: decl.getModuleSpecifierValue(), line: decl.getStartLineNumber() });
  }
  for (const decl of sf.getExportDeclarations()) {
    const value = decl.getModuleSpecifierValue();
    if (value) out.push({ value, line: decl.getStartLineNumber() });
  }
  // Dynamic import("...")
  for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (call.getExpression().getKind() !== SyntaxKind.ImportKeyword) continue;
    const arg = call.getArguments()[0];
    if (arg?.getKind() === SyntaxKind.StringLiteral) {
      out.push({ value: arg.getText().slice(1, -1), line: call.getStartLineNumber() });
    }
  }
  return out;
}

function packageNameOf(dir: string): string | null {
  try {
    return JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')).name ?? null;
  } catch {
    return null;
  }
}

function check(): Violation[] {
  const project = new Project({
    tsConfigFilePath: undefined,
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { allowJs: false },
  });
  project.addSourceFilesAtPaths([
    `${ROOT}/packages/*/src/**/*.{ts,tsx}`,
    '!**/*.d.ts',
    '!**/node_modules/**',
  ]);

  const violations: Violation[] = [];

  for (const sf of project.getSourceFiles()) {
    const filePath = sf.getFilePath();
    // Resolve which package this file lives in: packages/<pkg>/
    const rel = path.relative(ROOT, filePath);
    const match = rel.match(/^packages\/([^/]+)\//);
    if (!match) continue;
    const ownPkgDir = path.join(ROOT, 'packages', match[1]);
    const ownPkgName = packageNameOf(ownPkgDir);

    for (const { value, line } of moduleSpecifiers(sf)) {
      // Rule 1a: importing an app package by alias
      if (APP_PACKAGE_NAMES.some((name) => value === name || value.startsWith(`${name}/`))) {
        violations.push({ file: rel, line, specifier: value, rule: 'packages-imports-app' });
        continue;
      }

      // Relative imports only from here on
      if (!value.startsWith('.')) continue;

      const resolved = path.resolve(path.dirname(filePath), value);
      const resolvedRel = path.relative(ROOT, resolved);

      // Rule 1b: relative import escaping into apps/
      if (resolvedRel.startsWith('apps/') || resolvedRel === 'apps') {
        violations.push({ file: rel, line, specifier: value, rule: 'packages-imports-app' });
        continue;
      }

      // Rule 2: relative import crossing into a sibling package
      const siblingMatch = resolvedRel.match(/^packages\/([^/]+)/);
      if (siblingMatch && siblingMatch[1] !== match[1]) {
        const siblingName =
          packageNameOf(path.join(ROOT, 'packages', siblingMatch[1])) ?? '@motovault/*';
        violations.push({
          file: rel,
          line,
          specifier: value,
          rule: `cross-package-relative (use ${siblingName} instead of a relative path${ownPkgName ? ` from ${ownPkgName}` : ''})`,
        });
      }
    }
  }
  return violations;
}

const violations = check();

if (violations.length === 0) {
  console.log(
    '✓ architecture boundaries OK — no packages/ → apps/ leaks, no cross-package relative imports',
  );
  process.exit(0);
}

console.error(`\n✗ ${violations.length} architecture boundary violation(s):\n`);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}`);
  console.error(`      imports "${v.specifier}"`);
  console.error(`      rule: ${v.rule}\n`);
}
console.error('Types flow ONE direction: packages/ -> apps/. Fix the imports above.\n');
process.exit(1);
