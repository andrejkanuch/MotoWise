#!/usr/bin/env tsx
/**
 * Solutions index generator.
 *
 * `docs/solutions/` is where solved problems are written up, and an agent can
 * only use a write-up it can find. This script writes `docs/solutions/README.md`
 * from the front matter of every document there, at any depth: one row per
 * document with its path, title, module and symptom, grouped by category
 * directory.
 *
 * The two modes read two states of the repository, neither the working tree:
 *
 *   - Writing reads the git index (what `git add` has staged): which
 *     documents exist and their content. An untracked draft, an unstaged edit
 *     and an unstaged delete are not in the file it writes; it names them.
 *   - `--check` reads the last commit (`HEAD`): the documents and the index
 *     file. That commit is what `git push` sends and what CI checks out, so
 *     pre-push and CI judge the same content. Nothing staged or unstaged
 *     changes the answer, in either direction: a regenerated index passes
 *     only once it is committed, and a staged document that is not committed
 *     does not block a push. A repository with no commit passes: there is
 *     nothing to push. (On a pull request CI checks out the merge with the
 *     base branch, so a document added on the base since the branch was cut
 *     can still make CI fail where pre-push passed.)
 *
 *   pnpm exec tsx scripts/gen-solutions-index.ts           rewrite the index from the staged documents
 *   pnpm exec tsx scripts/gen-solutions-index.ts --check   exit 1 if the committed index is stale
 *
 * The steps that update it are SOLUTIONS_INDEX_REMEDY below, in that order.
 * `pnpm check:agent-docs` runs the same check, so committing a solution
 * document without regenerating and committing the index fails it.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { rootFromArgs } from './cli-root';

const ROOT = path.resolve(import.meta.dirname, '..');

const CHECK_FLAG = '--check';
export const SOLUTIONS_DIR = 'docs/solutions';
const INDEX_NAME = 'README.md';
const EMPTY_CELL = '—';
/** Heading for a document that sits directly in `docs/solutions/`. */
const NO_CATEGORY = '(no category)';

export const SOLUTIONS_INDEX_PATH = `${SOLUTIONS_DIR}/${INDEX_NAME}`;
export const SOLUTIONS_INDEX_COMMAND = 'pnpm exec tsx scripts/gen-solutions-index.ts';
const COMMIT_COMMAND = 'git commit';
/**
 * What makes a stale index current, in an order that works on the first run.
 * `git add -u` stages edits and deletes of tracked documents and never an
 * untracked file, so a draft is not swept into the commit.
 */
export const SOLUTIONS_INDEX_REMEDY = [
  `git add -u ${SOLUTIONS_DIR}`,
  SOLUTIONS_INDEX_COMMAND,
  `git add ${SOLUTIONS_INDEX_PATH}`,
  COMMIT_COMMAND,
] as const;
/** Said wherever the index is reported stale, so a fix that is not committed is not a mystery. */
const STATE_CHECKED =
  'Both are read from the last commit (HEAD), which is what a push sends and CI checks out: nothing staged or in the working tree is seen.';

/** The states of the repository a file can be read from: the prefix of `<state>:<path>`. */
const STATE = { index: '', head: 'HEAD' } as const;
type State = (typeof STATE)[keyof typeof STATE];

/** Front matter keys that name what a document is about, in order of preference. */
const MODULE_KEYS = ['module', 'modules', 'affected_modules', 'component', 'components'] as const;
const TITLE_KEY = 'title';
const SYMPTOM_KEY = 'symptom';

type FrontMatter = Readonly<Record<string, string>>;
type Row = { file: string; title: string; module: string; symptom: string };

const FRONT_MATTER_FENCE = '---';
const KEY_LINE = /^([A-Za-z_][\w-]*):\s*(.*)$/;
const LIST_ITEM = /^\s+-\s+(.*)$/;
const FIRST_HEADING = /^#\s+(.+)$/m;

function unquote(value: string): string {
  const trimmed = value.trim();
  const quote = trimmed[0];
  if ((quote === '"' || quote === "'") && trimmed.endsWith(quote) && trimmed.length > 1) {
    const inner = trimmed.slice(1, -1);
    return quote === '"' ? inner.replace(/\\"/g, '"') : inner.replace(/''/g, "'");
  }
  return trimmed;
}

/** `[a, b]` becomes `a, b`; anything else is returned unquoted. */
function scalarOrInlineList(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed.slice(1, -1).split(',').map(unquote).filter(Boolean).join(', ');
  }
  return unquote(trimmed);
}

/**
 * Reads the subset of YAML the solution documents use: `key: value`,
 * `key: [a, b]`, and a `key:` followed by `- item` lines. Lists are joined
 * with commas. Nothing else is needed, so no YAML dependency is.
 */
function readFrontMatter(content: string): FrontMatter {
  const lines = content.split('\n');
  if (lines[0]?.trim() !== FRONT_MATTER_FENCE) return {};
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === FRONT_MATTER_FENCE);
  if (end === -1) return {};

  const data: Record<string, string> = {};
  let listKey: string | null = null;
  for (const line of lines.slice(1, end)) {
    const item = LIST_ITEM.exec(line);
    if (item && listKey) {
      data[listKey] = [data[listKey], unquote(item[1])].filter(Boolean).join(', ');
      continue;
    }
    const pair = KEY_LINE.exec(line);
    if (!pair) continue;
    const [, key, value] = pair;
    data[key] = scalarOrInlineList(value);
    listKey = value.trim() === '' ? key : null;
  }
  return data;
}

function rowFor(file: string, content: string): Row {
  const data = readFrontMatter(content);
  const moduleKey = MODULE_KEYS.find((key) => data[key]);
  return {
    file,
    title: data[TITLE_KEY] || FIRST_HEADING.exec(content)?.[1].trim() || path.basename(file),
    module: moduleKey ? data[moduleKey] : EMPTY_CELL,
    symptom: data[SYMPTOM_KEY] || EMPTY_CELL,
  };
}

const GIT_BUFFER = 256 * 1024 * 1024;
const NEWLINE = 0x0a;

const GIT_NOT_FOUND = 1;

/** False in a repository with no commit yet. A detached HEAD is a commit like any other. */
function hasCommit(root: string): boolean {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', `${STATE.head}^{commit}`], {
      cwd: root,
      stdio: 'ignore',
    });
    return true;
  } catch (error) {
    if ((error as { status?: number }).status === GIT_NOT_FOUND) return false;
    throw error;
  }
}

/** The Markdown files under `docs/solutions/` in `state`, the index file included. */
function filesIn(root: string, state: State): string[] {
  const list =
    state === STATE.head
      ? ['ls-tree', '-r', '-z', '--name-only', STATE.head]
      : ['ls-files', '--cached', '-z'];
  return execFileSync('git', [...list, '--', SOLUTIONS_DIR], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: GIT_BUFFER,
  })
    .split('\0')
    .filter((file) => file.endsWith('.md'));
}

/** The content of each file in `state`, in one git call. A file that is not a blob there is left out. */
function contentIn(root: string, state: State): Map<string, string> {
  const files = filesIn(root, state);
  const contents = new Map<string, string>();
  if (files.length === 0) return contents;
  // `git cat-file --batch` answers each `<state>:<path>` with `<oid> <type> <size>\n<content>\n`,
  // or with one line ending in `missing`.
  const out = execFileSync('git', ['cat-file', '--batch'], {
    cwd: root,
    input: files.map((file) => `${state}:${file}\n`).join(''),
    maxBuffer: GIT_BUFFER,
  });
  let at = 0;
  for (const file of files) {
    const headerEnd = out.indexOf(NEWLINE, at);
    const header = out.toString('utf8', at, headerEnd).split(' ');
    at = headerEnd + 1;
    const size = Number(header[2]);
    if (header.length !== 3 || Number.isNaN(size)) continue;
    contents.set(file, out.toString('utf8', at, at + size));
    at += size + 1;
  }
  return contents;
}

/** Documents grouped by the category directory they sit under. */
function byCategory(documents: readonly string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const file of documents) {
    const [first, ...rest] = path.posix.relative(SOLUTIONS_DIR, file).split('/');
    const category = rest.length > 0 ? first : NO_CATEGORY;
    groups.set(category, [...(groups.get(category) ?? []), file]);
  }
  return groups;
}

/** Category directories in name order, then the documents with no category. */
function inIndexOrder(groups: Map<string, string[]>): [string, string[]][] {
  const named = [...groups].filter(([category]) => category !== NO_CATEGORY).sort();
  const loose = groups.get(NO_CATEGORY);
  return loose ? [...named, [NO_CATEGORY, loose]] : named;
}

const cell = (text: string): string => text.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

/** The full text of the index, built from the staged documents of the repository at `root`. */
export function renderSolutionsIndex(root: string = ROOT): string {
  return render(contentIn(root, STATE.index));
}

function render(contents: ReadonlyMap<string, string>): string {
  const documents = [...contents.keys()].filter((file) => file !== SOLUTIONS_INDEX_PATH);
  const out: string[] = [
    '# Solved problems',
    '',
    `<!-- Generated by scripts/gen-solutions-index.ts from each document's front matter. Do not edit by hand: run \`${SOLUTIONS_INDEX_COMMAND}\`. -->`,
    '',
    'One row per document. Search this file for a symptom or a module before debugging something that may already have been solved. A dash means the document does not state that field.',
  ];
  for (const [category, files] of inIndexOrder(byCategory(documents))) {
    const rows = [...files].sort().map((file) => rowFor(file, contents.get(file) ?? ''));
    const categoryDir = category === NO_CATEGORY ? SOLUTIONS_DIR : `${SOLUTIONS_DIR}/${category}`;
    out.push(
      '',
      `## ${category}`,
      '',
      '| Document | Title | Module | Symptom |',
      '|---|---|---|---|',
    );
    for (const row of rows) {
      const relative = path.posix.relative(SOLUTIONS_DIR, row.file);
      out.push(
        `| [${path.posix.relative(categoryDir, row.file)}](${relative}) | ${cell(row.title)} | ${cell(row.module)} | ${cell(row.symptom)} |`,
      );
    }
  }
  return `${out.join('\n')}\n`;
}

/** True when the index file in `state` equals what the documents in `state` would generate. */
function isCurrentIn(root: string, state: State): boolean {
  try {
    const contents = contentIn(root, state);
    return contents.get(SOLUTIONS_INDEX_PATH) === render(contents);
  } catch {
    return false;
  }
}

/**
 * True when the committed index file equals what the committed documents
 * would generate, or when nothing is committed yet.
 */
export function solutionsIndexIsCurrent(root: string = ROOT): boolean {
  try {
    return !hasCommit(root) || isCurrentIn(root, STATE.head);
  } catch {
    return false;
  }
}

/** What to do about a stale index: only the commit, when the fix is already staged. */
export function solutionsIndexRemedy(root: string = ROOT): string {
  if (isCurrentIn(root, STATE.index)) {
    return `${STATE_CHECKED} The staged index is current, so only the commit is missing: ${COMMIT_COMMAND}`;
  }
  return `${STATE_CHECKED} Run, in this order: ${SOLUTIONS_INDEX_REMEDY.join(' && ')}. A new document is listed once it is staged, so git add it by its path first.`;
}

/** Paths under `docs/solutions/` whose working-tree state is not what is staged, the index file aside. */
function unstagedChanges(root: string): string[] {
  return execFileSync(
    'git',
    [
      'ls-files',
      '--modified',
      '--deleted',
      '--others',
      '--exclude-standard',
      '-z',
      '--',
      SOLUTIONS_DIR,
    ],
    { cwd: root, encoding: 'utf8', maxBuffer: GIT_BUFFER },
  )
    .split('\0')
    .filter((file) => file.endsWith('.md') && file !== SOLUTIONS_INDEX_PATH);
}

function main(): void {
  const root = rootFromArgs(ROOT);
  if (process.argv.includes(CHECK_FLAG)) {
    if (solutionsIndexIsCurrent(root)) {
      console.log(
        hasCommit(root)
          ? `✓ ${SOLUTIONS_INDEX_PATH} is up to date (last commit)`
          : `✓ ${SOLUTIONS_INDEX_PATH} was not checked: this repository has no commit`,
      );
      return;
    }
    console.error(`✗ ${SOLUTIONS_INDEX_PATH} is stale. ${solutionsIndexRemedy(root)}`);
    process.exit(1);
  }
  writeFileSync(path.join(root, SOLUTIONS_INDEX_PATH), renderSolutionsIndex(root));
  console.log(
    `wrote ${SOLUTIONS_INDEX_PATH} from the staged documents. The check reads the last commit: git add ${SOLUTIONS_INDEX_PATH} && ${COMMIT_COMMAND}`,
  );
  const unstaged = [...new Set(unstagedChanges(root))];
  if (unstaged.length > 0) {
    console.log(
      `Not read, because not staged (git add, then run this again):\n${unstaged.map((file) => `  ${file}`).join('\n')}`,
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
