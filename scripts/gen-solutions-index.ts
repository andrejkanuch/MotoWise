#!/usr/bin/env tsx
/**
 * Solutions index generator.
 *
 * `docs/solutions/` is where solved problems are written up, and an agent can
 * only use a write-up it can find. This script writes `docs/solutions/README.md`
 * from the front matter of every document staged there, at any depth: one
 * row per document with its path, title, module and symptom, grouped by
 * category directory.
 *
 * Everything is read from the git index (what `git add` has staged), never
 * from the working tree: which documents exist, their content, and, for the
 * check, the index file itself. A commit of the staged state is what CI
 * checks out, so the answer here and there is the same. An untracked draft,
 * an unstaged edit and an unstaged delete are not seen until they are staged.
 *
 *   git add docs/solutions && pnpm exec tsx scripts/gen-solutions-index.ts   rewrite the index
 *   pnpm exec tsx scripts/gen-solutions-index.ts --check                      exit 1 if it is stale
 *
 * `pnpm check:agent-docs` runs the same comparison, so adding a solution
 * document without regenerating and staging the index fails the check.
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
/** Said wherever the index is reported stale, so an unstaged edit is not a mystery. */
export const SOLUTIONS_INDEX_STATE_READ =
  'Both are read from the git index (the staged state), not the working tree: an edit, a new document or a delete that is not staged is not seen.';

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

/** The staged Markdown files under `docs/solutions/`, the index file included. */
function stagedFiles(root: string): string[] {
  return execFileSync('git', ['ls-files', '--cached', '-z', '--', SOLUTIONS_DIR], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: GIT_BUFFER,
  })
    .split('\0')
    .filter((file) => file.endsWith('.md'));
}

/** The staged content of each file, in one git call. A file with nothing staged is left out. */
function stagedContent(root: string, files: readonly string[]): Map<string, string> {
  const contents = new Map<string, string>();
  if (files.length === 0) return contents;
  // `git cat-file --batch` answers each `:<path>` with `<oid> <type> <size>\n<content>\n`,
  // or with one line ending in `missing`.
  const out = execFileSync('git', ['cat-file', '--batch'], {
    cwd: root,
    input: files.map((file) => `:${file}\n`).join(''),
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
  return render(stagedContent(root, stagedFiles(root)));
}

function render(staged: ReadonlyMap<string, string>): string {
  const documents = [...staged.keys()].filter((file) => file !== SOLUTIONS_INDEX_PATH);
  const out: string[] = [
    '# Solved problems',
    '',
    `<!-- Generated by scripts/gen-solutions-index.ts from each document's front matter. Do not edit by hand: run \`${SOLUTIONS_INDEX_COMMAND}\`. -->`,
    '',
    'One row per document. Search this file for a symptom or a module before debugging something that may already have been solved. A dash means the document does not state that field.',
  ];
  for (const [category, files] of inIndexOrder(byCategory(documents))) {
    const rows = [...files].sort().map((file) => rowFor(file, staged.get(file) ?? ''));
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

/** True when the staged index file equals what the staged documents would generate. */
export function solutionsIndexIsCurrent(root: string = ROOT): boolean {
  try {
    const staged = stagedContent(root, stagedFiles(root));
    return staged.get(SOLUTIONS_INDEX_PATH) === render(staged);
  } catch {
    return false;
  }
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
      console.log(`✓ ${SOLUTIONS_INDEX_PATH} is up to date (staged state)`);
      return;
    }
    console.error(
      `✗ ${SOLUTIONS_INDEX_PATH} is stale. ${SOLUTIONS_INDEX_STATE_READ} Run: ${SOLUTIONS_INDEX_COMMAND} && git add ${SOLUTIONS_DIR}`,
    );
    process.exit(1);
  }
  writeFileSync(path.join(root, SOLUTIONS_INDEX_PATH), renderSolutionsIndex(root));
  console.log(
    `wrote ${SOLUTIONS_INDEX_PATH} from the staged documents. Stage it: git add ${SOLUTIONS_INDEX_PATH}`,
  );
  const unstaged = [...new Set(unstagedChanges(root))];
  if (unstaged.length > 0) {
    console.log(
      `Not read, because not staged (git add, then run this again):\n${unstaged.map((file) => `  ${file}`).join('\n')}`,
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
