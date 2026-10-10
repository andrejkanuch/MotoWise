/**
 * Throwaway trees for the guard-script tests. Each guard takes the repository
 * root as an argument, so a test builds the smallest tree that shows one rule
 * and runs the guard on it.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** Repo-relative path → file content. */
export type Files = Readonly<Record<string, string>>;

// Under a git hook these point at the real repository; the guards must see the fixture's own.
for (const name of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_PREFIX']) {
  delete process.env[name];
}

const git = (root: string, ...args: string[]): void => {
  execFileSync('git', args, { cwd: root, stdio: 'ignore' });
};

export function writeFiles(root: string, files: Files): void {
  for (const [file, content] of Object.entries(files)) {
    const target = path.join(root, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
}

/** A plain directory tree. */
export function makeTree(files: Files): string {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'guard-fixture-')));
  writeFiles(root, files);
  return root;
}

/** A git repository with `files` in its index. Nothing is committed: the guards read the index. */
export function makeRepo(files: Files): string {
  const root = makeTree(files);
  git(root, 'init', '--quiet');
  track(root);
  return root;
}

/** Stages everything that is not ignored. */
export function track(root: string): void {
  git(root, 'add', '--all');
}

export function removeTree(root: string): void {
  rmSync(root, { recursive: true, force: true });
}

/** `count` lines of filler, for size and line-count rules. */
export const lines = (count: number, line = '//'): string => `${line}\n`.repeat(count);
