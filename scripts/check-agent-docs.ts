#!/usr/bin/env tsx
/**
 * Instruction-file checker.
 *
 * Agents act on what the instruction files say, so a file that cites a path or
 * a `pnpm` script that does not exist sends every session down a dead end, and
 * a file that grows without limit is paid for by every session that loads it.
 * Four checks over the instruction surface (every tracked CLAUDE.md, the
 * `.claude` hook list, verification config and project skills, `docs/MAP.md`):
 *
 *   1. Paths: a cited repo path must exist, resolved against the citing file's
 *      directory and then the repo root (`./x` too: commands are run from the
 *      root; `../x` only against the citing file's directory). A glob must
 *      match at least one file. Read from inline code, fenced blocks and
 *      Markdown link targets. In a fenced block `../x` is taken as an
 *      example's import and skipped. Not
 *      read: a bare filename, a path in plain prose, and a path whose first
 *      directory does not exist (that is how prose such as `Get/List/Create`
 *      is told apart from a path).
 *   2. Scripts: the first word of a `pnpm` call that is not a flag must be a
 *      script in some package.json of the repository, a binary in a
 *      `node_modules/.bin`, or a pnpm command (PNPM_COMMANDS). That is all:
 *      the check does not work out which workspace `cd`, `-C` or `--filter`
 *      selects, because every attempt to follow pnpm's and the shell's grammar
 *      rejected true commands. The price is precision: `pnpm start` at the
 *      root passes although only apps/web has a `start` script. Read it as
 *      "this word exists somewhere", not "this command works here". Not
 *      judged at all: a call in a checkout with no dependencies installed
 *      (a binary cannot be told from a typo), `pnpm` in a fenced `#` comment,
 *      and `pnpm` inside a JSON string that is not itself a command.
 *   3. Budgets: line and byte caps per file (PLANNED_SIZES below, plus headroom),
 *      with a default cap for any CLAUDE.md the table does not list.
 *   4. Solutions index: `docs/solutions/README.md` must equal what
 *      `scripts/gen-solutions-index.ts` generates. Both sides are read from
 *      the git index (the staged state), never the working tree.
 *
 * Runs via `pnpm check:agent-docs`. Exits non-zero on any finding.
 * `--report` prints the findings and exits 0.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { rootFromArgs } from './cli-root';
import {
  SOLUTIONS_DIR,
  SOLUTIONS_INDEX_COMMAND,
  SOLUTIONS_INDEX_PATH,
  SOLUTIONS_INDEX_STATE_READ,
  solutionsIndexIsCurrent,
} from './gen-solutions-index';

const ROOT = path.resolve(import.meta.dirname, '..');

const REPORT_FLAG = '--report';
const PACKAGE_MANIFEST = 'package.json';

const FINDING_KIND = {
  missingPath: 'missing-path',
  missingScript: 'missing-script',
  overBudget: 'over-budget',
  staleIndex: 'stale-index',
} as const;
type FindingKind = (typeof FINDING_KIND)[keyof typeof FINDING_KIND];

type Finding = { file: string; line: number; kind: FindingKind; message: string };

const CLAUDE_MD = /(^|\/)CLAUDE\.md$/;

/** Which files are scanned. Patterns are matched against repo-relative posix paths. */
const SCANNED = [
  CLAUDE_MD,
  /^\.claude\/hooks\/protected-files\.txt$/,
  /^\.claude\/verification-config\.json$/,
  /^\.claude\/skills\/.+\.md$/,
  /^docs\/MAP\.md$/,
] as const;

type Budget = { lines: number; bytes: number; lineBytes?: number };

/**
 * The sizes the files were planned at (KTD11 of
 * docs/plans/2026-10-10-1356-refactor-mobile-structure-and-agent-instructions-plan.md).
 * The plan set no byte size for `docs/MAP.md`; 10,000 is its size, rounded up,
 * when the cap was added. The enforced cap is this plus BUDGET_HEADROOM_PERCENT, so a
 * correction to a file that sits at its planned size does not block its own push.
 */
const PLANNED_SIZES: Readonly<Record<string, Budget>> = {
  'CLAUDE.md': { lines: 80, bytes: 5500, lineBytes: 300 },
  'apps/mobile/CLAUDE.md': { lines: 100, bytes: 7500 },
  'apps/api/CLAUDE.md': { lines: 60, bytes: 5000 },
  'apps/web/CLAUDE.md': { lines: 80, bytes: 6500 },
  'supabase/CLAUDE.md': { lines: 40, bytes: 3000 },
  'packages/graphql/CLAUDE.md': { lines: 25, bytes: 1600 },
  'packages/types/CLAUDE.md': { lines: 20, bytes: 1000 },
  'packages/design-system/CLAUDE.md': { lines: 15, bytes: 900 },
  'docs/MAP.md': { lines: 150, bytes: 10000 },
};

/** Any other `CLAUDE.md`: a new one is capped from its first commit. Sized like `supabase/CLAUDE.md`. */
const PLANNED_SIZE_OF_UNLISTED_CLAUDE_MD: Budget = { lines: 40, bytes: 3000 };

const BUDGET_HEADROOM_PERCENT = 10;

/** In integers: `5500 * 1.1` is 6050.000000000001 in floating point, and rounds up to 6051. */
const plusHeadroom = (planned: number): number =>
  Math.ceil((planned * (100 + BUDGET_HEADROOM_PERCENT)) / 100);

const withHeadroom = (planned: Budget): Budget => ({
  lines: plusHeadroom(planned.lines),
  bytes: plusHeadroom(planned.bytes),
  ...(planned.lineBytes === undefined ? {} : { lineBytes: plusHeadroom(planned.lineBytes) }),
});

/** The enforced caps of a file, or null when it has none. A file that does not exist yet is not checked. */
function budgetOf(file: string): Budget | null {
  const planned =
    PLANNED_SIZES[file] ?? (CLAUDE_MD.test(file) ? PLANNED_SIZE_OF_UNLISTED_CLAUDE_MD : null);
  return planned && withHeadroom(planned);
}

/**
 * Cited paths that are allowed not to exist in the tracked tree. Keep this
 * short: every entry is a hole in the check, and each one states why.
 */
const SKIPPED_PATHS: Readonly<Record<string, string>> = {};

/**
 * pnpm's own commands and their aliases: the word after `pnpm` is not a
 * package.json script. Taken from pnpm 11.9.0 (the `packageManager` version):
 * every command `pnpm help -a` lists, plus each word `pnpm help <word>`
 * prints a usage for. `run` is skipped by the parser. `test` and `start` are
 * left out on purpose: they run the script of that name, so one must exist.
 */
const PNPM_COMMANDS = [
  'add',
  'adduser',
  'approve-builds',
  'audit',
  'bin',
  'bugs',
  'c',
  'cache',
  'cat-file',
  'cat-index',
  'ci',
  'clean',
  'completion',
  'config',
  'create',
  'dedupe',
  'deploy',
  'deprecate',
  'dist-tag',
  'dlx',
  'docs',
  'env',
  'exec',
  'fetch',
  'find-hash',
  'get',
  'help',
  'home',
  'i',
  'ignored-builds',
  'import',
  'info',
  'init',
  'install',
  'install-test',
  'it',
  'la',
  'licenses',
  'link',
  'list',
  'll',
  'ln',
  'login',
  'logout',
  'ls',
  'm',
  'multi',
  'outdated',
  'owner',
  'pack',
  'patch',
  'patch-commit',
  'patch-remove',
  'peers',
  'ping',
  'pkg',
  'prune',
  'publish',
  'rb',
  'rebuild',
  'recursive',
  'remove',
  'repo',
  'restart',
  'rm',
  'root',
  'rt',
  'run-script',
  'runtime',
  'sbom',
  'search',
  'self-update',
  'set',
  'setup',
  'show',
  'stage',
  'star',
  'stars',
  'store',
  't',
  'un',
  'uninstall',
  'unlink',
  'unpublish',
  'unstar',
  'up',
  'update',
  'upgrade',
  'v',
  'version',
  'view',
  'whoami',
  'why',
  'with',
] as const;

/**
 * pnpm flags whose value is the next word (`pnpm help -a`, `pnpm help run`,
 * `pnpm help recursive`). Any other flag is taken as a switch.
 */
const PNPM_FLAGS_WITH_VALUE = [
  '--filter',
  '-F',
  '--filter-prod',
  '--dir',
  '-C',
  '--loglevel',
  '--reporter',
  '--workspace-concurrency',
  '--resume-from',
  '--test-pattern',
  '--changed-files-ignore-pattern',
] as const;

const toPosix = (p: string): string => p.split(path.sep).join('/');

// ---------------------------------------------------------------------------
// The repository: files, workspaces and their scripts
// ---------------------------------------------------------------------------

type Repo = {
  root: string;
  files: readonly string[];
  exists: (rel: string) => boolean;
  /** Every word `pnpm <word>` can run somewhere in the repository: scripts, installed binaries, pnpm commands. */
  pnpmWords: ReadonlySet<string>;
  /** False in a checkout with no `node_modules/.bin`: an unknown word may be a binary, so none is judged. */
  binsInstalled: boolean;
};

const MANIFEST_FILE = /(^|\/)package\.json$/;
const BIN_DIR = 'node_modules/.bin';

function listFiles(root: string): string[] {
  // Tracked files plus new files not yet staged, so a path added in the same
  // change resolves; git-ignored files never count as existing.
  const out = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    },
  );
  return out.split('\0').filter(Boolean);
}

function installedBins(root: string, dir: string): string[] {
  try {
    return readdirSync(path.join(root, dir, BIN_DIR));
  } catch {
    return [];
  }
}

function scriptsOf(root: string, manifest: string): string[] {
  try {
    const json = JSON.parse(readFileSync(path.join(root, manifest), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    return Object.keys(json.scripts ?? {});
  } catch {
    // Deleted but not staged, or not JSON: it defines no script the check can read.
    return [];
  }
}

function loadRepo(root: string): Repo {
  const files = listFiles(root);
  const fileSet = new Set(files);
  const dirSet = new Set<string>();
  for (const file of files) {
    let dir = path.posix.dirname(file);
    while (dir !== '.' && !dirSet.has(dir)) {
      dirSet.add(dir);
      dir = path.posix.dirname(dir);
    }
  }

  const manifests = files.filter((file) => MANIFEST_FILE.test(file));
  const bins = manifests.flatMap((manifest) => installedBins(root, path.posix.dirname(manifest)));
  return {
    root,
    files,
    exists: (rel) => fileSet.has(rel) || dirSet.has(rel),
    pnpmWords: new Set([
      ...PNPM_COMMANDS,
      ...manifests.flatMap((manifest) => scriptsOf(root, manifest)),
      ...bins,
    ]),
    binsInstalled: bins.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

const SPAN_KIND = {
  /** Inline code: paths and pnpm calls are read from it. */
  code: 'code',
  /** A line of a fenced block: the same, except that `./x` and `../x` are not relative to this file, and a `#` comment holds no pnpm call. */
  fence: 'fence',
  /** A JSON string: paths are read from it; pnpm calls only when the string is a command, that is, begins with `pnpm`. */
  json: 'json',
  /** The target of a Markdown link: it is a path, whatever it looks like. */
  link: 'link',
  /** Free text: only pnpm calls are read from it. */
  text: 'text',
} as const;
type SpanKind = (typeof SPAN_KIND)[keyof typeof SPAN_KIND];

type Span = { text: string; line: number; kind: SpanKind };

const FENCE = /^\s*(```|~~~)/;
const INLINE_CODE = /`([^`\n]+)`/g;
/** `](target)` and `](target "title")`; one level of parentheses is allowed inside the target. */
const LINK_TARGET = /\]\(\s*<?((?:[^()\s<>]|\([^()\s]*\))+)>?(?:\s+"[^"]*")?\s*\)/g;

/** Code spans and link targets of a Markdown file. */
function markdownSpans(lines: readonly string[]): Span[] {
  const spans: Span[] = [];
  let fenced = false;
  lines.forEach((text, index) => {
    const line = index + 1;
    if (FENCE.test(text)) {
      fenced = !fenced;
      return;
    }
    if (fenced) {
      spans.push({ text, line, kind: SPAN_KIND.fence });
      return;
    }
    for (const match of text.matchAll(INLINE_CODE)) {
      spans.push({ text: match[1], line, kind: SPAN_KIND.code });
    }
    for (const match of text.replace(INLINE_CODE, '').matchAll(LINK_TARGET)) {
      spans.push({ text: match[1], line, kind: SPAN_KIND.link });
    }
  });
  return spans;
}

/** `.claude/hooks/protected-files.txt`: `<path>|<message>` per line. */
function protectedFileSpans(lines: readonly string[]): Span[] {
  return lines.flatMap((text, index) => {
    const [target, ...message] = text.split('|');
    if (!target.trim() || target.startsWith('#')) return [];
    return [
      { text: target.trim(), line: index + 1, kind: SPAN_KIND.code },
      { text: message.join('|'), line: index + 1, kind: SPAN_KIND.text },
    ];
  });
}

const JSON_STRING = /"((?:[^"\\]|\\.)*)"/g;

/** Every string in a JSON file, keys included; keys never look like paths or commands. */
function jsonSpans(lines: readonly string[]): Span[] {
  return lines.flatMap((text, index) =>
    [...text.matchAll(JSON_STRING)].map((match) => ({
      text: match[1],
      line: index + 1,
      kind: SPAN_KIND.json,
    })),
  );
}

function spansOf(file: string, lines: readonly string[]): Span[] {
  if (file.endsWith('.md')) return markdownSpans(lines);
  if (file.endsWith('.json')) return jsonSpans(lines);
  return protectedFileSpans(lines);
}

// ---------------------------------------------------------------------------
// Check 1: paths
// ---------------------------------------------------------------------------

const PATH_CHARS = '[\\w.()[\\]{}*?,@+-]';
/** Shaped like a path: at least one `/`. */
const PATH_TOKEN = new RegExp(`^${PATH_CHARS}+(?:/${PATH_CHARS}*)+$`);
/** A link target may also be a single segment (`README.md`). */
const LINK_PATH = new RegExp(`^${PATH_CHARS}+(?:/${PATH_CHARS}*)*$`);
const GLOB_CHARS = /[*?{]/;
const LINE_SUFFIX = /:\d+(?:-\d+)?$/;
const TRAILING_PUNCTUATION = /[.,;:]+$/;
/** `--config=path` and `VAR=path`: the path is what follows the `=`. */
const ASSIGNMENT_PREFIX = /^(?:--?[\w-]+|[A-Z_][A-Z0-9_]*)=/;
const QUOTES = /^['"]+|['"]+$/g;
const FRAGMENT = /[#?].*$/;
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

const count = (text: string, char: string): number => text.split(char).length - 1;

/** True when the `(` that opens the token is closed by its last character. */
function isWrappedInParens(token: string): boolean {
  if (!token.startsWith('(') || !token.endsWith(')')) return false;
  let depth = 0;
  for (let i = 0; i < token.length; i++) {
    if (token[i] === '(') depth += 1;
    else if (token[i] === ')') depth -= 1;
    if (depth === 0) return i === token.length - 1;
  }
  return false;
}

/**
 * Removes parentheses that belong to the sentence, not the path. A route
 * group such as `app/(tabs)/index.tsx` or `(auth)/login.tsx` keeps its own.
 */
function stripSentenceParens(token: string): string {
  if (isWrappedInParens(token)) return token.slice(1, -1);
  if (token.endsWith(')') && count(token, ')') > count(token, '(')) return token.slice(0, -1);
  if (token.startsWith('(') && count(token, '(') > count(token, ')')) return token.slice(1);
  return token;
}

/** The path inside a whitespace-separated token: without quotes, a flag prefix, an anchor or a line number. */
function pathInToken(token: string): string {
  let cleaned = token;
  for (let previous = ''; previous !== cleaned; ) {
    previous = cleaned;
    cleaned = stripSentenceParens(
      cleaned.replace(ASSIGNMENT_PREFIX, '').replace(QUOTES, '').replace(TRAILING_PUNCTUATION, ''),
    );
  }
  return cleaned.replace(/#.*$/, '').replace(LINE_SUFFIX, '');
}

function globToRegExp(glob: string): RegExp {
  let source = '';
  let braceDepth = 0;
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i];
    if (char === '*' && glob[i + 1] === '*') {
      // `**/` spans zero or more directories; a bare `**` spans anything.
      if (glob[i + 2] === '/') {
        source += '(?:.*/)?';
        i += 2;
      } else {
        source += '.*';
        i += 1;
      }
    } else if (char === '*') source += '[^/]*';
    else if (char === '?') source += '[^/]';
    else if (char === '{') {
      source += '(?:';
      braceDepth += 1;
    } else if (char === '}' && braceDepth > 0) {
      source += ')';
      braceDepth -= 1;
    } else if (char === ',' && braceDepth > 0) source += '|';
    else source += char.replace(/[.+^$()|[\]\\{}]/g, '\\$&');
  }
  return new RegExp(`^${source}(?:/.*)?$`);
}

function resolves(repo: Repo, candidate: string): boolean {
  if (candidate.startsWith('..')) return false;
  if (!GLOB_CHARS.test(candidate)) return repo.exists(candidate);
  const pattern = globToRegExp(candidate);
  return repo.files.some((file) => pattern.test(file));
}

type Missing = { cited: string; bases: readonly string[] };

/** The cited path when it resolves in none of `bases`, null when it resolves or is deliberately absent. */
function missingFrom(repo: Repo, cited: string, bases: readonly string[]): Missing | null {
  const bare = cited.replace(/\/+$/, '');
  const candidates = bases.map((base) => path.posix.normalize(path.posix.join(base, bare)));
  if (candidates.some((candidate) => resolves(repo, candidate))) return null;
  if (candidates.some((candidate) => candidate in SKIPPED_PATHS)) return null;
  return { cited, bases };
}

/**
 * A token is treated as a repo path when it is shaped like one and its first
 * segment is a real entry next to the citing file or at the repo root. That
 * second condition is what keeps prose such as `Get/List/Create`, branch names
 * and URL routes out of the check. A token that starts with `./` or `../`
 * says it is a path itself.
 */
function checkPath(repo: Repo, token: string, citingDir: string, fenced: boolean): Missing | null {
  const cleaned = pathInToken(token);
  if (!PATH_TOKEN.test(cleaned)) return null;
  if (cleaned.startsWith('@') || cleaned.startsWith('/')) return null;

  // `../x` is relative to the citing file, except in a fenced block, where it
  // is an import specifier of the example's own file. `./x` is run from
  // wherever the reader is, the repo root mostly, so both places are tried.
  const climbs = cleaned.startsWith('../');
  if (fenced && climbs) return null;
  const bases = climbs ? [citingDir] : [citingDir, '.'];
  const explicitlyRelative = climbs || cleaned.startsWith('./');
  const firstSegment = cleaned.split('/')[0];
  const anchored =
    explicitlyRelative ||
    GLOB_CHARS.test(firstSegment) ||
    bases.some((base) => repo.exists(path.posix.normalize(path.posix.join(base, firstSegment))));
  return anchored ? missingFrom(repo, cleaned, bases) : null;
}

/** A link target is a path unless it is a URL, an in-page anchor or a site-absolute route. */
function checkLink(repo: Repo, target: string, citingDir: string): Missing | null {
  if (URL_SCHEME.test(target) || target.startsWith('#') || target.startsWith('/')) return null;
  const cited = target.replace(FRAGMENT, '');
  if (!LINK_PATH.test(cited) || cited.startsWith('@')) return null;
  return missingFrom(repo, cited, [citingDir, '.']);
}

function pathFindings(repo: Repo, file: string, spans: readonly Span[]): Finding[] {
  const citingDir = path.posix.dirname(file);
  const findings: Finding[] = [];
  const report = (line: number, missing: Missing | null) => {
    if (!missing) return;
    const looked = [...new Set(missing.bases.map((base) => path.posix.normalize(base)))]
      .map((base) => (base === '.' ? 'the repo root' : `\`${base}/\``))
      .join(' and ');
    findings.push({
      file,
      line,
      kind: FINDING_KIND.missingPath,
      message: `cites \`${missing.cited}\`, which does not exist (looked in ${looked})`,
    });
  };
  for (const span of spans) {
    if (span.kind === SPAN_KIND.link) report(span.line, checkLink(repo, span.text, citingDir));
    if (span.kind === SPAN_KIND.link || span.kind === SPAN_KIND.text) continue;
    const fenced = span.kind === SPAN_KIND.fence;
    for (const token of span.text.split(/\s+/)) {
      report(span.line, checkPath(repo, token, citingDir, fenced));
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Check 2: pnpm calls
// ---------------------------------------------------------------------------

/** `pnpm` as a command word: not `pnpm-lock.yaml`, not the end of a longer word. */
const PNPM_WORD = /(?<![\w./@-])pnpm(?=\s)/g;
const COMMAND_END = /&&|\|\||[;|]/;
/** A shell comment: `#` at the start of the line or after a space. */
const SHELL_COMMENT = /(?:^|\s)#.*$/;
const JSON_COMMAND = /^pnpm\s/;
const PLACEHOLDER = /[<>]/;
const SCRIPT_WORD = /^[A-Za-z][\w:.-]*$/;
const WORD_EDGES = /^['"]+|['".,;:!?)\]]+$/g;
const RUN = 'run';
const IF_PRESENT = '--if-present';

/**
 * The first word after `pnpm` that is not a flag, a flag's value or `run`.
 * Null when there is none, or when `--if-present` says the script may be absent.
 */
function commandWord(rest: string): string | null {
  const words = rest.split(COMMAND_END)[0].trim().split(/\s+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (word === RUN) continue;
    if (!word.startsWith('-')) return word.replace(WORD_EDGES, '');
    if (word === IF_PRESENT) return null;
    if ((PNPM_FLAGS_WITH_VALUE as readonly string[]).includes(word)) i += 1;
  }
  return null;
}

/** The part of a span a pnpm call can be read from. */
function commandText(span: Span): string {
  if (span.kind === SPAN_KIND.link) return '';
  if (span.kind === SPAN_KIND.fence) return span.text.replace(SHELL_COMMENT, '');
  if (span.kind === SPAN_KIND.json) return JSON_COMMAND.test(span.text) ? span.text : '';
  return span.text;
}

function scriptFindings(repo: Repo, file: string, spans: readonly Span[]): Finding[] {
  if (!repo.binsInstalled) return [];
  const findings: Finding[] = [];
  for (const span of spans) {
    const text = commandText(span);
    for (const match of text.matchAll(PNPM_WORD)) {
      const word = commandWord(text.slice((match.index ?? 0) + match[0].length));
      if (!word || PLACEHOLDER.test(word) || !SCRIPT_WORD.test(word)) continue;
      if (repo.pnpmWords.has(word)) continue;
      findings.push({
        file,
        line: span.line,
        kind: FINDING_KIND.missingScript,
        message: `\`pnpm ${word}\`: no ${PACKAGE_MANIFEST} in the repository has a "${word}" script, no ${BIN_DIR} has that binary, and it is not in PNPM_COMMANDS in scripts/check-agent-docs.ts`,
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Check 3: budgets
// ---------------------------------------------------------------------------

function budgetFindings(file: string, content: string, lines: readonly string[]): Finding[] {
  const budget = budgetOf(file);
  if (!budget) return [];
  const findings: Finding[] = [];
  const over = (line: number, message: string) =>
    findings.push({ file, line, kind: FINDING_KIND.overBudget, message });

  const lineCount = content.split('\n').length - 1;
  const byteCount = Buffer.byteLength(content);
  if (lineCount > budget.lines) over(1, `${lineCount} lines, budget is ${budget.lines}`);
  if (byteCount > budget.bytes) over(1, `${byteCount} bytes, budget is ${budget.bytes}`);
  const { lineBytes } = budget;
  if (lineBytes !== undefined) {
    lines.forEach((text, index) => {
      const bytes = Buffer.byteLength(text);
      if (bytes > lineBytes) over(index + 1, `line is ${bytes} bytes, budget is ${lineBytes}`);
    });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Check 4: solutions index
// ---------------------------------------------------------------------------

function indexFindings(root: string): Finding[] {
  if (solutionsIndexIsCurrent(root)) return [];
  return [
    {
      file: SOLUTIONS_INDEX_PATH,
      line: 1,
      kind: FINDING_KIND.staleIndex,
      message: `does not match the solution documents. ${SOLUTIONS_INDEX_STATE_READ} Run: ${SOLUTIONS_INDEX_COMMAND} && git add ${SOLUTIONS_DIR}`,
    },
  ];
}

// ---------------------------------------------------------------------------

/** Every finding in the instruction files of the repository at `root`. */
export function checkAgentDocs(root: string = ROOT): {
  scanned: number;
  findings: Finding[];
  /** False when no dependencies are installed, so no pnpm call was judged. */
  pnpmCallsChecked: boolean;
} {
  const repo = loadRepo(root);
  const targets = repo.files.filter((file) => SCANNED.some((pattern) => pattern.test(file)));
  const findings: Finding[] = [];
  for (const file of targets) {
    const content = readFileSync(path.join(root, file), 'utf8');
    const lines = content.split('\n');
    const spans = spansOf(toPosix(file), lines);
    findings.push(
      ...pathFindings(repo, file, spans),
      ...scriptFindings(repo, file, spans),
      ...budgetFindings(file, content, lines),
    );
  }
  findings.push(...indexFindings(root));
  return { scanned: targets.length, findings, pnpmCallsChecked: repo.binsInstalled };
}

const PNPM_CAVEAT =
  'not necessarily in the workspace the command runs in: cd, -C and --filter are not resolved';

function main(): void {
  const reportOnly = process.argv.includes(REPORT_FLAG);
  const { scanned, findings, pnpmCallsChecked } = checkAgentDocs(rootFromArgs(ROOT));

  if (findings.length === 0) {
    const pnpmCalls = pnpmCallsChecked
      ? `pnpm calls name a script, binary or pnpm command that exists somewhere in the repository (${PNPM_CAVEAT})`
      : `pnpm calls were NOT checked (no ${BIN_DIR}: run pnpm install)`;
    console.log(
      `✓ instruction files OK — ${scanned} files: paths cited in code spans, fenced blocks and link targets resolve, ${pnpmCalls}, sizes are within budget, the solutions index is current. Not checked: a bare filename, a path in plain prose, a path whose first directory does not exist`,
    );
    return;
  }

  console.error(`\n✗ ${findings.length} instruction-file finding(s) in ${scanned} files:\n`);
  for (const finding of findings) {
    console.error(`  ${finding.file}:${finding.line}`);
    console.error(`      ${finding.kind}: ${finding.message}\n`);
  }
  console.error(
    `Fix the citation, or the thing it cites. A path that is deliberately absent from the tree goes in SKIPPED_PATHS in scripts/check-agent-docs.ts with its reason; a budget is raised in PLANNED_SIZES in the same file; a real pnpm command the check does not know goes in PNPM_COMMANDS. A pnpm call that passes names a word that exists somewhere in the repository (${PNPM_CAVEAT}).\n`,
  );
  process.exit(reportOnly ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
