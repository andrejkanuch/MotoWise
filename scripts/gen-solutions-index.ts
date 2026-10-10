#!/usr/bin/env tsx
/**
 * Solutions index generator.
 *
 * `docs/solutions/` is where solved problems are written up, and an agent can
 * only use a write-up it can find. This script writes `docs/solutions/README.md`
 * from the front matter of every document git tracks there, at any depth: one
 * row per document with its path, title, module and symptom, grouped by
 * category directory. An untracked draft is not indexed until it is added, so
 * the index is the same on a clean checkout as on the machine that wrote it.
 *
 *   pnpm exec tsx scripts/gen-solutions-index.ts           rewrite the index
 *   pnpm exec tsx scripts/gen-solutions-index.ts --check   exit 1 if it is stale
 *
 * `pnpm check:agent-docs` runs the same comparison, so adding a solution
 * document without regenerating the index fails the check.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');

const CHECK_FLAG = '--check';
const SOLUTIONS_DIR = 'docs/solutions';
const INDEX_NAME = 'README.md';
const EMPTY_CELL = '—';
/** Heading for a document that sits directly in `docs/solutions/`. */
const NO_CATEGORY = '(no category)';

export const SOLUTIONS_INDEX_PATH = `${SOLUTIONS_DIR}/${INDEX_NAME}`;
export const SOLUTIONS_INDEX_COMMAND = 'pnpm exec tsx scripts/gen-solutions-index.ts';

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

function rowFor(root: string, file: string): Row {
  const content = readFileSync(path.join(root, file), 'utf8');
  const data = readFrontMatter(content);
  const moduleKey = MODULE_KEYS.find((key) => data[key]);
  return {
    file,
    title: data[TITLE_KEY] || FIRST_HEADING.exec(content)?.[1].trim() || path.basename(file),
    module: moduleKey ? data[moduleKey] : EMPTY_CELL,
    symptom: data[SYMPTOM_KEY] || EMPTY_CELL,
  };
}

/**
 * The tracked solution documents, grouped by the category directory they sit
 * under. A file deleted from the working tree but not yet from the index is
 * left out.
 */
function documentsByCategory(root: string): Map<string, string[]> {
  const tracked = execFileSync('git', ['ls-files', '--cached', '-z', '--', SOLUTIONS_DIR], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\0')
    .filter(
      (file) =>
        file.endsWith('.md') && file !== SOLUTIONS_INDEX_PATH && existsSync(path.join(root, file)),
    );

  const groups = new Map<string, string[]>();
  for (const file of tracked) {
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

/** The full text of the index, built from the tracked documents of the repository at `root`. */
export function renderSolutionsIndex(root: string = ROOT): string {
  const out: string[] = [
    '# Solved problems',
    '',
    `<!-- Generated by scripts/gen-solutions-index.ts from each document's front matter. Do not edit by hand: run \`${SOLUTIONS_INDEX_COMMAND}\`. -->`,
    '',
    'One row per document. Search this file for a symptom or a module before debugging something that may already have been solved. A dash means the document does not state that field.',
  ];
  for (const [category, files] of inIndexOrder(documentsByCategory(root))) {
    const rows = [...files].sort().map((file) => rowFor(root, file));
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

/** True when the index file equals what the tracked documents would generate. */
export function solutionsIndexIsCurrent(root: string = ROOT): boolean {
  try {
    return (
      readFileSync(path.join(root, SOLUTIONS_INDEX_PATH), 'utf8') === renderSolutionsIndex(root)
    );
  } catch {
    return false;
  }
}

function main(): void {
  if (process.argv.includes(CHECK_FLAG)) {
    if (solutionsIndexIsCurrent()) {
      console.log(`✓ ${SOLUTIONS_INDEX_PATH} is up to date`);
      return;
    }
    console.error(`✗ ${SOLUTIONS_INDEX_PATH} is stale. Run: ${SOLUTIONS_INDEX_COMMAND}`);
    process.exit(1);
  }
  writeFileSync(path.join(ROOT, SOLUTIONS_INDEX_PATH), renderSolutionsIndex());
  console.log(`wrote ${SOLUTIONS_INDEX_PATH}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
