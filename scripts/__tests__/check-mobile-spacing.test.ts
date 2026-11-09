/**
 * check-no-hardcoded-mobile-spacing: which added lines fail and which pass.
 *
 * Each case builds a fixture repository with `main` holding a legacy file, then
 * adds lines on a branch (committed, uncommitted or as a new untracked file) and
 * runs the shell guard there. Legacy numbers must never fail; new raw spacing
 * must, in every way it can arrive.
 */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { commit, type Files, makeRepo, removeTree, track, writeFiles } from './fixture';

const SCRIPT = path.resolve(__dirname, '..', 'check-no-hardcoded-mobile-spacing.sh');
const SCREEN = 'apps/mobile/src/components/screen.tsx';
const LEGACY = `const legacy = { padding: 12, gap: 8 };\n`;

const roots: string[] = [];
after(() => {
  for (const root of roots) removeTree(root);
});

const git = (root: string, ...args: string[]) =>
  execFileSync('git', args, { cwd: root, stdio: 'ignore' });

/** A repo whose `main` has the legacy screen, checked out on a feature branch. */
function repoOnBranch(): string {
  const root = makeRepo({ [SCREEN]: LEGACY });
  roots.push(root);
  git(root, 'checkout', '--quiet', '-b', 'main');
  commit(root);
  git(root, 'checkout', '--quiet', '-b', 'feature');
  return root;
}

function runGuard(root: string) {
  const { status, stdout } = spawnSync('sh', [SCRIPT], { cwd: root, encoding: 'utf8' });
  return { failed: status !== 0, output: stdout };
}

/** Adds `line` to the screen as an uncommitted edit and runs the guard. */
function guardWithAddedLine(line: string) {
  const root = repoOnBranch();
  writeFiles(root, { [SCREEN]: `${LEGACY}${line}\n` });
  return runGuard(root);
}

describe('check-no-hardcoded-mobile-spacing', () => {
  const flagged = [
    'const a = { padding: 12 };',
    'const a = { marginTop: -8 };',
    'const a = { gap: 6 };',
    'const a = { rowGap: 4 };',
    'const a = { paddingHorizontal: 20 };',
    'const a = { paddingBottom: insets.bottom + 100 };',
    'const a = { paddingTop: insets.top - 4 };',
    'const a = { padding: isWide ? 24 : space.md };',
    'const a = { gap: space.md + 2 };',
    'const a = { paddingBottom: Math.max(insets.bottom, 16) };',
    'const a = { padding: 0.5 };',
    "const a = { margin: '12%' };",
  ];
  for (const line of flagged) {
    test(`flags: ${line}`, () => {
      const { failed, output } = guardWithAddedLine(line);
      assert.equal(failed, true, output);
      assert.match(output, /screen\.tsx/);
    });
  }

  const allowed = [
    'const a = { padding: 0, gap: 0 };',
    'const a = { paddingHorizontal: layout.sheetGutter, gap: space.xs };',
    'const a = { paddingTop: insets.top + space.sm };',
    'const a = { marginTop: -layout.fieldGap };',
    'const a = { marginBottom: index === 0 ? 0 : space.xs };',
    'const a = { gap: space.md * 2 };',
    'const a = { padding: space.md, opacity: pressed ? 1 : 0.5 };',
    'const a = { borderRadius: 12, minHeight: 52 };',
    'const a = { paddingBottom: Math.max(insets.bottom, space.md) };',
    "const a = { width: '50%', padding: space.xs };",
  ];
  for (const line of allowed) {
    test(`allows: ${line}`, () => {
      const { failed, output } = guardWithAddedLine(line);
      assert.equal(failed, false, output);
    });
  }

  test('ignores the legacy numbers already on main', () => {
    assert.equal(runGuard(repoOnBranch()).failed, false);
  });

  test('flags raw spacing in a committed change', () => {
    const root = repoOnBranch();
    writeFiles(root, { [SCREEN]: `${LEGACY}const a = { margin: 10 };\n` });
    track(root);
    commit(root);
    assert.equal(runGuard(root).failed, true);
  });

  test('flags raw spacing in a new untracked file', () => {
    const root = repoOnBranch();
    writeFiles(root, { 'apps/mobile/src/components/new-card.tsx': 'const a = { gap: 6 };\n' });
    const { failed, output } = runGuard(root);
    assert.equal(failed, true, output);
    assert.match(output, /new-card\.tsx/);
  });

  for (const file of [
    'apps/mobile/src/components/two words/card.tsx',
    'apps/mobile/src/components/r\u00e9sum\u00e9-card.tsx',
  ]) {
    test(`reads paths with spaces and non-ASCII characters: ${file}`, () => {
      // Tracked (staged) and untracked both go through the same path parsing.
      const staged = repoOnBranch();
      writeFiles(staged, { [file]: 'const a = { gap: 6 };\n' });
      track(staged);
      assert.equal(runGuard(staged).failed, true);
      const untracked = repoOnBranch();
      writeFiles(untracked, { [file]: 'const a = { gap: 6 };\n' });
      assert.equal(runGuard(untracked).failed, true);
    });
  }

  for (const setting of [
    'diff.mnemonicPrefix=true',
    'diff.noprefix=true',
    'diff.external=/usr/bin/true',
  ]) {
    test(`still reads the diff with ${setting}`, () => {
      const root = repoOnBranch();
      const [key, value] = setting.split('=');
      git(root, 'config', key, value);
      writeFiles(root, { [SCREEN]: `${LEGACY}const a = { gap: 6 };\n` });
      track(root);
      assert.equal(runGuard(root).failed, true);
    });
  }

  test('reads the real lines when a textconv filter is configured', () => {
    const root = repoOnBranch();
    writeFiles(root, { '.git/info/attributes': '*.tsx diff=hide\n' });
    git(root, 'config', 'diff.hide.textconv', 'sed s/6/seven/');
    writeFiles(root, { [SCREEN]: `${LEGACY}const a = { gap: 6 };\n` });
    track(root);
    assert.equal(runGuard(root).failed, true);
  });

  test('does not treat a renamed file as new', () => {
    const root = repoOnBranch();
    git(root, 'mv', SCREEN, 'apps/mobile/src/components/renamed-screen.tsx');
    commit(root);
    assert.equal(runGuard(root).failed, false);
  });

  test('skips tests and the token home', () => {
    const root = repoOnBranch();
    const files: Files = {
      'apps/mobile/src/components/__tests__/screen.test.tsx': 'const a = { padding: 12 };\n',
      'apps/mobile/src/theme/spacing.ts': 'export const space = { md: 16, gap: 4 };\n',
    };
    writeFiles(root, files);
    assert.equal(runGuard(root).failed, false);
  });
});
