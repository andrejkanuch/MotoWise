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
 *      directory and then the repo root. A glob must match at least one file.
 *      Read from inline code, fenced blocks and Markdown link targets. In a
 *      fenced block `../x` is taken as an example's import and skipped. Not
 *      read: a bare filename, a path in plain prose, and a path whose first
 *      directory does not exist (that is how prose such as `Get/List/Create`
 *      is told apart from a path).
 *   2. Scripts: a `pnpm` call must name a script in the package.json it would
 *      run against, or a binary pnpm would fall back to (`pnpm tsx …`). The
 *      target follows `--filter`, `-r`, `-w`, `-C <dir>` and a leading
 *      `cd <dir> &&`.
 *   3. Budgets: line and byte caps per file (PLANNED_SIZES below, plus headroom),
 *      with a default cap for any CLAUDE.md the table does not list.
 *   4. Solutions index: `docs/solutions/README.md` must equal what
 *      `scripts/gen-solutions-index.ts` generates from the tracked documents.
 *
 * Runs via `pnpm check:agent-docs`. Exits non-zero on any finding.
 * `--report` prints the findings and exits 0.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  SOLUTIONS_INDEX_COMMAND,
  SOLUTIONS_INDEX_PATH,
  solutionsIndexIsCurrent,
} from './gen-solutions-index';

const ROOT = path.resolve(import.meta.dirname, '..');

const REPORT_FLAG = '--report';
const PACKAGE_MANIFEST = 'package.json';

const FINDING_KIND = {
  missingPath: 'missing-path',
  missingScript: 'missing-script',
  unknownWorkspace: 'unknown-workspace',
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
 * when the cap was added. The enforced cap is this plus BUDGET_HEADROOM, so a
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

const BUDGET_HEADROOM = 1.1;

const withHeadroom = (planned: Budget): Budget => ({
  lines: Math.ceil(planned.lines * BUDGET_HEADROOM),
  bytes: Math.ceil(planned.bytes * BUDGET_HEADROOM),
  ...(planned.lineBytes === undefined
    ? {}
    : { lineBytes: Math.ceil(planned.lineBytes * BUDGET_HEADROOM) }),
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
 * pnpm's own commands: the word after `pnpm` is not a package.json script.
 * `test` and `start` are left out on purpose: they run the script of that name.
 */
const PNPM_BUILTINS: ReadonlySet<string> = new Set([
  'add',
  'approve-builds',
  'audit',
  'bin',
  'cache',
  'config',
  'create',
  'dedupe',
  'deploy',
  'dlx',
  'doctor',
  'env',
  'exec',
  'fetch',
  'help',
  'i',
  'ignored-builds',
  'import',
  'info',
  'init',
  'install',
  'licenses',
  'link',
  'list',
  'ls',
  'outdated',
  'pack',
  'patch',
  'patch-commit',
  'patch-remove',
  'prune',
  'publish',
  'rebuild',
  'remove',
  'rm',
  'root',
  'self-update',
  'setup',
  'store',
  'uninstall',
  'unlink',
  'up',
  'update',
  'view',
  'why',
]);

const toPosix = (p: string): string => p.split(path.sep).join('/');

// ---------------------------------------------------------------------------
// The repository: files, workspaces and their scripts
// ---------------------------------------------------------------------------

type Workspace = {
  dir: string;
  name: string;
  scripts: ReadonlySet<string>;
  /** What `pnpm <word>` can run here when no script is called <word>. */
  bins: ReadonlySet<string>;
};

type Repo = {
  root: string;
  files: readonly string[];
  exists: (rel: string) => boolean;
  /** The pnpm workspaces: the root, and each package under apps/ and packages/. */
  workspaces: readonly Workspace[];
  rootWorkspace: Workspace | null;
  /** The package.json a command run in `dir` would use: that directory's, or the nearest one above it. */
  manifestFor: (dir: string) => Workspace | null;
};

const WORKSPACE_MANIFEST = /^(?:(?:apps|packages)\/[^/]+\/)?package\.json$/;
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

  const rootBins = installedBins(root, '.');
  const readManifest = (manifest: string): Workspace => {
    const json = JSON.parse(readFileSync(path.join(root, manifest), 'utf8')) as {
      name?: string;
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const dir = path.posix.dirname(manifest);
    // Without an install there is no .bin directory; a dependency's own name
    // (`tsx`, `@biomejs/biome` → `biome`) stands in for its binary.
    const declared = Object.keys({ ...json.dependencies, ...json.devDependencies }).map(
      (dependency) => dependency.split('/').pop() ?? dependency,
    );
    return {
      dir,
      name: json.name ?? '',
      scripts: new Set(Object.keys(json.scripts ?? {})),
      bins: new Set([...declared, ...installedBins(root, dir), ...rootBins]),
    };
  };

  const manifests = new Map<string, Workspace>();
  const manifestAt = (dir: string): Workspace | null => {
    const manifest = dir === '.' ? PACKAGE_MANIFEST : `${dir}/${PACKAGE_MANIFEST}`;
    if (!fileSet.has(manifest)) return null;
    const cached = manifests.get(dir) ?? readManifest(manifest);
    manifests.set(dir, cached);
    return cached;
  };

  const workspaces = files
    .filter((file) => WORKSPACE_MANIFEST.test(file))
    .map((file) => manifestAt(path.posix.dirname(file)))
    .filter((workspace): workspace is Workspace => workspace !== null);

  return {
    root,
    files,
    exists: (rel) => fileSet.has(rel) || dirSet.has(rel),
    workspaces,
    rootWorkspace: workspaces.find((w) => w.dir === '.') ?? null,
    manifestFor: (dir) => {
      for (let at = path.posix.normalize(dir); ; at = path.posix.dirname(at)) {
        if (at.startsWith('..')) return null;
        const found = manifestAt(at);
        if (found || at === '.') return found;
      }
    },
  };
}

/** The workspace a file sits in, when it is not the root. */
function owningWorkspace(repo: Repo, file: string): Workspace | null {
  return repo.workspaces.find((w) => w.dir !== '.' && file.startsWith(`${w.dir}/`)) ?? null;
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

const SPAN_KIND = {
  /** Inline code or a JSON string: paths and pnpm calls are read from it. */
  code: 'code',
  /** A line of a fenced block: the same, except that `./x` and `../x` are not relative to this file. */
  fence: 'fence',
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
      kind: SPAN_KIND.code,
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

/** The cited path when it resolves nowhere, null when it resolves or is deliberately absent. */
function missingFrom(repo: Repo, cited: string, bases: readonly string[]): string | null {
  const bare = cited.replace(/\/+$/, '');
  const candidates = bases.map((base) => path.posix.normalize(path.posix.join(base, bare)));
  if (candidates.some((candidate) => resolves(repo, candidate))) return null;
  if (candidates.some((candidate) => candidate in SKIPPED_PATHS)) return null;
  return cited;
}

/**
 * A token is treated as a repo path when it is shaped like one and its first
 * segment is a real entry next to the citing file or at the repo root. That
 * second condition is what keeps prose such as `Get/List/Create`, branch names
 * and URL routes out of the check.
 */
function checkPath(repo: Repo, token: string, citingDir: string, fenced: boolean): string | null {
  const cleaned = pathInToken(token);
  if (!PATH_TOKEN.test(cleaned)) return null;
  if (cleaned.startsWith('@') || cleaned.startsWith('/')) return null;

  // In a fenced block `../x` is an import specifier of the example's own
  // file, and `./x` is run from wherever the reader is: the repo root, mostly.
  if (fenced && cleaned.startsWith('../')) return null;
  const bare = (fenced ? cleaned.replace(/^\.\//, '') : cleaned).replace(/\/+$/, '');
  const explicitlyRelative = bare.startsWith('./') || bare.startsWith('../');
  const firstSegment = bare.split('/')[0];
  const bases = explicitlyRelative ? [citingDir] : [citingDir, '.'];
  const anchored = bases.some(
    (base) =>
      explicitlyRelative ||
      GLOB_CHARS.test(firstSegment) ||
      repo.exists(path.posix.normalize(path.posix.join(base, firstSegment))),
  );
  return anchored && missingFrom(repo, bare, bases) ? cleaned : null;
}

/** A link target is a path unless it is a URL, an in-page anchor or a site-absolute route. */
function checkLink(repo: Repo, target: string, citingDir: string): string | null {
  if (URL_SCHEME.test(target) || target.startsWith('#') || target.startsWith('/')) return null;
  const cited = target.replace(FRAGMENT, '');
  if (!LINK_PATH.test(cited) || cited.startsWith('@')) return null;
  return missingFrom(repo, cited, [citingDir, '.']);
}

function pathFindings(repo: Repo, file: string, spans: readonly Span[]): Finding[] {
  const citingDir = path.posix.dirname(file);
  const findings: Finding[] = [];
  const report = (line: number, missing: string | null) => {
    if (!missing) return;
    findings.push({
      file,
      line,
      kind: FINDING_KIND.missingPath,
      message: `cites \`${missing}\`, which does not exist (looked next to this file and at the repo root)`,
    });
  };
  for (const span of spans) {
    if (span.kind === SPAN_KIND.link) report(span.line, checkLink(repo, span.text, citingDir));
    if (span.kind !== SPAN_KIND.code && span.kind !== SPAN_KIND.fence) continue;
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
/** The command just before `pnpm` is `cd <dir> &&`. */
const CD_BEFORE = /(?:^|[\s;&|(])cd\s+(\S+)\s*&&\s*$/;
const COMMAND_END = /&&|\|\||[;|]/;
const PLACEHOLDER = /[<>]/;
const SCRIPT_WORD = /^[A-Za-z][\w:.-]*$/;
const WORD_EDGES = /^['"]+|['".,;:!?)\]]+$/g;
const RUN = 'run';

const FLAG = {
  filter: ['--filter', '-F'],
  dir: ['--dir', '-C'],
  recursive: ['--recursive', '-r'],
  workspaceRoot: ['--workspace-root', '-w'],
  ifPresent: ['--if-present'],
  /** Other flags that take their value as the next word. Any other flag is a switch. */
  takesValue: ['--reporter', '--loglevel', '--workspace-concurrency', '--config', '--color'],
} as const;
const isFlag = (group: readonly string[], name: string): boolean => group.includes(name);

type PnpmCall = {
  filters: string[];
  dir: string | null;
  recursive: boolean;
  workspaceRoot: boolean;
  ifPresent: boolean;
  /** The first word that is not a flag: a script, a binary or a pnpm command. */
  word: string | null;
};

/** Reads the flags and the command word that follow `pnpm`. */
function parsePnpmCall(rest: string): PnpmCall {
  const words = rest.split(COMMAND_END)[0].trim().split(/\s+/).filter(Boolean);
  const call: PnpmCall = {
    filters: [],
    dir: null,
    recursive: false,
    workspaceRoot: false,
    ifPresent: false,
    word: null,
  };
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (word === RUN) continue;
    if (!word.startsWith('-')) {
      call.word = word.replace(WORD_EDGES, '');
      break;
    }
    const equals = word.indexOf('=');
    const name = equals === -1 ? word : word.slice(0, equals);
    const takeValue = (): string =>
      (equals === -1 ? (words[++i] ?? '') : word.slice(equals + 1)).replace(QUOTES, '');

    if (isFlag(FLAG.filter, name)) call.filters.push(takeValue());
    else if (isFlag(FLAG.dir, name)) call.dir = takeValue();
    else if (isFlag(FLAG.takesValue, name)) takeValue();
    else if (isFlag(FLAG.recursive, name)) call.recursive = true;
    else if (isFlag(FLAG.workspaceRoot, name)) call.workspaceRoot = true;
    else if (isFlag(FLAG.ifPresent, name)) call.ifPresent = true;
  }
  return call;
}

const wildcard = (pattern: string): RegExp =>
  new RegExp(`^${pattern.replace(/[.+^$()|[\]\\{}?]/g, '\\$&').replace(/\*/g, '.*')}$`);

/**
 * The workspaces a `--filter` selects. It accepts a name, an unscoped name
 * when that is unambiguous, a name glob (`@motovault/*`), or a directory
 * (`./apps/mobile`, `{apps/mobile}`); `...` and `^` only widen the selection
 * to dependencies, so they are dropped.
 */
function resolveFilter(repo: Repo, filter: string): Workspace[] {
  const selector = filter.replace(/^\.\.\.\^?|\^?\.\.\.$/g, '');
  const members = repo.workspaces.filter((w) => w.dir !== '.');

  const braced = /^\{(.+)\}$/.exec(selector)?.[1];
  if (braced !== undefined || selector.startsWith('.')) {
    const dir = wildcard(path.posix.normalize(braced ?? selector));
    return members.filter((w) => dir.test(w.dir));
  }
  if (selector.includes('*')) {
    const byName = members.filter((w) => wildcard(selector).test(w.name));
    return byName.length > 0 || selector.startsWith('@')
      ? byName
      : members.filter((w) => wildcard(`@*/${selector}`).test(w.name));
  }
  const exact = repo.workspaces.filter((w) => w.name === selector);
  if (exact.length > 0) return exact;
  const unscoped = members.filter((w) => w.name.endsWith(`/${selector}`));
  return unscoped.length === 1 ? unscoped : [];
}

function scriptFindings(repo: Repo, file: string, spans: readonly Span[]): Finding[] {
  const findings: Finding[] = [];
  const citingDir = path.posix.dirname(file);
  const own = owningWorkspace(repo, file);
  const describe = (targets: readonly Workspace[]): string =>
    targets
      .map((w) => (w.dir === '.' ? `the root ${PACKAGE_MANIFEST}` : `${w.dir}/${PACKAGE_MANIFEST}`))
      .join(' or ');

  for (const span of spans) {
    if (span.kind === SPAN_KIND.link) continue;
    for (const match of span.text.matchAll(PNPM_WORD)) {
      const start = match.index ?? 0;
      const call = parsePnpmCall(span.text.slice(start + match[0].length));
      const report = (kind: FindingKind, message: string) =>
        findings.push({ file, line: span.line, kind, message });

      // Where the command runs.
      let targets: Workspace[];
      const filters = call.filters.filter((filter) => !filter.startsWith('!'));
      const cdDir = CD_BEFORE.exec(span.text.slice(0, start))?.[1].replace(QUOTES, '');
      const inDir = call.dir ?? cdDir;
      if (filters.length > 0) {
        if (filters.some((filter) => PLACEHOLDER.test(filter))) continue;
        targets = [];
        for (const filter of filters) {
          const selected = resolveFilter(repo, filter);
          if (selected.length === 0) {
            report(FINDING_KIND.unknownWorkspace, `\`pnpm --filter ${filter}\` names no workspace`);
          }
          targets.push(...selected);
        }
        if (targets.length === 0) continue;
      } else if (call.recursive) {
        targets = [...repo.workspaces];
      } else if (call.workspaceRoot) {
        targets = repo.rootWorkspace ? [repo.rootWorkspace] : [];
      } else if (inDir !== undefined && !PLACEHOLDER.test(inDir)) {
        // A directory is read from the repo root first (where commands are
        // run from), then from the citing file's directory.
        const manifest = [inDir, path.posix.join(citingDir, inDir)]
          .filter(
            (dir) => repo.exists(path.posix.normalize(dir)) || path.posix.normalize(dir) === '.',
          )
          .map((dir) => repo.manifestFor(dir))
          .find((workspace) => workspace !== null);
        if (!manifest) {
          report(
            FINDING_KIND.unknownWorkspace,
            `\`pnpm\` is run in \`${inDir}\`, which is not a directory with a ${PACKAGE_MANIFEST} above it`,
          );
          continue;
        }
        targets = [manifest];
      } else {
        // Unfiltered: the command runs from the repo root, or from the
        // workspace the citing file documents.
        targets = [repo.rootWorkspace, own].filter((w): w is Workspace => w !== null);
      }

      const { word } = call;
      if (!word || PLACEHOLDER.test(word) || !SCRIPT_WORD.test(word)) continue;
      if (PNPM_BUILTINS.has(word) || call.ifPresent) continue;
      if (targets.some((w) => w.scripts.has(word) || w.bins.has(word))) continue;
      report(
        FINDING_KIND.missingScript,
        `\`pnpm ${word}\`: no "${word}" script in ${describe(targets)}, and no binary of that name`,
      );
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
      message: `does not match the tracked solution documents. Run: ${SOLUTIONS_INDEX_COMMAND}`,
    },
  ];
}

// ---------------------------------------------------------------------------

/** Every finding in the instruction files of the repository at `root`. */
export function checkAgentDocs(root: string = ROOT): { scanned: number; findings: Finding[] } {
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
  return { scanned: targets.length, findings };
}

function main(): void {
  const reportOnly = process.argv.includes(REPORT_FLAG);
  const { scanned, findings } = checkAgentDocs();

  if (findings.length === 0) {
    console.log(
      `✓ instruction files OK — ${scanned} files: paths cited in code spans, fenced blocks and link targets resolve, pnpm calls name a script or binary, sizes are within budget, the solutions index is current. Not checked: a bare filename, a path in plain prose, a path whose first directory does not exist`,
    );
    return;
  }

  console.error(`\n✗ ${findings.length} instruction-file finding(s) in ${scanned} files:\n`);
  for (const finding of findings) {
    console.error(`  ${finding.file}:${finding.line}`);
    console.error(`      ${finding.kind}: ${finding.message}\n`);
  }
  console.error(
    `Fix the citation, or the thing it cites. A path that is deliberately absent from the tree goes in SKIPPED_PATHS in scripts/check-agent-docs.ts with its reason; a budget is raised in PLANNED_SIZES in the same file.\n`,
  );
  process.exit(reportOnly ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
