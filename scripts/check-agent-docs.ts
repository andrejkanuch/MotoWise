#!/usr/bin/env tsx
/**
 * Instruction-file checker.
 *
 * Agents act on what the instruction files say, so a file that cites a path or
 * a `pnpm` script that does not exist sends every session down a dead end, and
 * a file that grows without limit is paid for by every session that loads it.
 * Three checks over the instruction surface (every tracked CLAUDE.md, the
 * `.claude` hook list, verification config and project skills, `docs/MAP.md`):
 *
 *   1. Paths: a cited repo path must exist, resolved against the citing file's
 *      directory and then the repo root. A glob must match at least one file.
 *   2. Scripts: `pnpm <script>` and `pnpm --filter <pkg> <script>` must name a
 *      script in the package.json they would run against.
 *   3. Budgets: line and byte caps per file (BUDGETS below).
 *
 * Runs via `pnpm check:agent-docs`. Exits non-zero on any finding.
 * `--report` prints the findings and exits 0.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

const REPORT_FLAG = '--report';
const PACKAGE_MANIFEST = 'package.json';

const FINDING_KIND = {
  missingPath: 'missing-path',
  missingScript: 'missing-script',
  unknownWorkspace: 'unknown-workspace',
  overBudget: 'over-budget',
} as const;
type FindingKind = (typeof FINDING_KIND)[keyof typeof FINDING_KIND];

type Finding = { file: string; line: number; kind: FindingKind; message: string };

/** Which files are scanned. Patterns are matched against repo-relative posix paths. */
const SCANNED = [
  /(^|\/)CLAUDE\.md$/,
  /^\.claude\/hooks\/protected-files\.txt$/,
  /^\.claude\/verification-config\.json$/,
  /^\.claude\/skills\/.+\.md$/,
  /^docs\/MAP\.md$/,
] as const;

/** Line and byte caps. A file that does not exist yet is not checked. */
const BUDGETS: Readonly<Record<string, { lines: number; bytes?: number; lineBytes?: number }>> = {
  'CLAUDE.md': { lines: 80, bytes: 5500, lineBytes: 300 },
  'apps/mobile/CLAUDE.md': { lines: 100, bytes: 7500 },
  'apps/api/CLAUDE.md': { lines: 60, bytes: 5000 },
  'apps/web/CLAUDE.md': { lines: 80, bytes: 6500 },
  'supabase/CLAUDE.md': { lines: 40, bytes: 3000 },
  'packages/graphql/CLAUDE.md': { lines: 25, bytes: 1600 },
  'packages/types/CLAUDE.md': { lines: 20, bytes: 1000 },
  'packages/design-system/CLAUDE.md': { lines: 15, bytes: 900 },
  'docs/MAP.md': { lines: 150 },
};

/**
 * Cited paths that are allowed not to exist in the tracked tree. Keep this
 * short: every entry is a hole in the check, and each one states why.
 */
const SKIPPED_PATHS: Readonly<Record<string, string>> = {};

/** pnpm's own commands: the word after `pnpm` is not a package.json script. */
const PNPM_BUILTINS: ReadonlySet<string> = new Set([
  'add',
  'approve-builds',
  'audit',
  'create',
  'dedupe',
  'dlx',
  'exec',
  'i',
  'import',
  'init',
  'install',
  'link',
  'list',
  'ls',
  'outdated',
  'patch',
  'prune',
  'publish',
  'rebuild',
  'remove',
  'store',
  'up',
  'update',
  'why',
]);

const toPosix = (p: string): string => p.split(path.sep).join('/');

function listFiles(): string[] {
  // Tracked files plus new files not yet staged, so a path added in the same
  // change resolves; git-ignored files never count as existing.
  const out = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    },
  );
  return out.split('\0').filter(Boolean);
}

const FILES = listFiles();
const FILE_SET: ReadonlySet<string> = new Set(FILES);
const DIR_SET: ReadonlySet<string> = (() => {
  const dirs = new Set<string>();
  for (const file of FILES) {
    let dir = path.posix.dirname(file);
    while (dir !== '.' && !dirs.has(dir)) {
      dirs.add(dir);
      dir = path.posix.dirname(dir);
    }
  }
  return dirs;
})();

const exists = (rel: string): boolean => FILE_SET.has(rel) || DIR_SET.has(rel);

// ---------------------------------------------------------------------------
// Workspaces and their scripts
// ---------------------------------------------------------------------------

type Workspace = { dir: string; name: string; scripts: ReadonlySet<string> };

function readWorkspace(manifest: string): Workspace {
  const json = JSON.parse(readFileSync(path.join(ROOT, manifest), 'utf8')) as {
    name?: string;
    scripts?: Record<string, string>;
  };
  return {
    dir: path.posix.dirname(manifest),
    name: json.name ?? '',
    scripts: new Set(Object.keys(json.scripts ?? {})),
  };
}

const WORKSPACES: readonly Workspace[] = FILES.filter((f) =>
  /^(?:(?:apps|packages)\/[^/]+\/)?package\.json$/.test(f),
).map(readWorkspace);

const ROOT_WORKSPACE = WORKSPACES.find((w) => w.dir === '.');

/** `--filter` accepts the full name, or the unscoped name when it is unambiguous. */
function resolveFilter(filter: string): Workspace | null {
  const exact = WORKSPACES.find((w) => w.name === filter);
  if (exact) return exact;
  const unscoped = WORKSPACES.filter((w) => w.name.endsWith(`/${filter}`));
  return unscoped.length === 1 ? unscoped[0] : null;
}

/** The workspace a file sits in, when it is not the root. */
function owningWorkspace(file: string): Workspace | null {
  return WORKSPACES.find((w) => w.dir !== '.' && file.startsWith(`${w.dir}/`)) ?? null;
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

type Span = { text: string; line: number; inline: boolean };

const FENCE = /^\s*(```|~~~)/;
const INLINE_CODE = /`([^`\n]+)`/g;

/** Code spans of a Markdown file: inline `code` and the lines of fenced blocks. */
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
      spans.push({ text, line, inline: false });
      return;
    }
    for (const match of text.matchAll(INLINE_CODE)) {
      spans.push({ text: match[1], line, inline: true });
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
      { text: target.trim(), line: index + 1, inline: true },
      { text: message.join('|'), line: index + 1, inline: false },
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
      inline: true,
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

const PATH_TOKEN = /^[\w.()[\]{}*?,@+-]+(?:\/[\w.()[\]{}*?,@+-]*)+$/;
const GLOB_CHARS = /[*?{]/;
const LINE_SUFFIX = /:\d+(?:-\d+)?$/;
const TRAILING_PUNCTUATION = /[.,;:]+$/;

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

function resolves(candidate: string): boolean {
  if (candidate.startsWith('..')) return false;
  if (!GLOB_CHARS.test(candidate)) return exists(candidate);
  const pattern = globToRegExp(candidate);
  return FILES.some((file) => pattern.test(file));
}

/**
 * A token is treated as a repo path when it is shaped like one and its first
 * segment is a real entry next to the citing file or at the repo root. That
 * second condition is what keeps prose such as `Get/List/Create`, branch names
 * and URL routes out of the check.
 */
function checkPath(token: string, citingDir: string): string | null {
  const cleaned = token.replace(TRAILING_PUNCTUATION, '').replace(LINE_SUFFIX, '');
  if (!PATH_TOKEN.test(cleaned)) return null;
  if (cleaned.startsWith('@') || cleaned.startsWith('/')) return null;

  const bare = cleaned.replace(/\/+$/, '');
  const explicitlyRelative = bare.startsWith('./') || bare.startsWith('../');
  const firstSegment = bare.split('/')[0];
  const bases = explicitlyRelative ? [citingDir] : [citingDir, '.'];
  const anchoredBases = bases.filter(
    (base) =>
      explicitlyRelative ||
      GLOB_CHARS.test(firstSegment) ||
      exists(path.posix.normalize(path.posix.join(base, firstSegment))),
  );
  if (anchoredBases.length === 0) return null;

  const candidates = bases.map((base) => path.posix.normalize(path.posix.join(base, bare)));
  if (candidates.some(resolves)) return null;
  if (candidates.some((candidate) => candidate in SKIPPED_PATHS)) return null;
  return cleaned;
}

function pathFindings(file: string, spans: readonly Span[]): Finding[] {
  const citingDir = path.posix.dirname(file);
  const findings: Finding[] = [];
  for (const span of spans) {
    if (!span.inline) continue;
    for (const token of span.text.split(/\s+/)) {
      const missing = checkPath(token, citingDir);
      if (missing) {
        findings.push({
          file,
          line: span.line,
          kind: FINDING_KIND.missingPath,
          message: `cites \`${missing}\`, which does not exist (looked next to this file and at the repo root)`,
        });
      }
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Check 2: pnpm scripts
// ---------------------------------------------------------------------------

const PNPM_CALL = /\bpnpm\s+(?:(?:--filter|-F)[\s=]+(\S+)\s+)?(?:run\s+)?([A-Za-z][\w:.-]*)/g;
const PLACEHOLDER = /[<>]/;

function scriptFindings(file: string, spans: readonly Span[]): Finding[] {
  const findings: Finding[] = [];
  const own = owningWorkspace(file);
  for (const span of spans) {
    for (const match of span.text.matchAll(PNPM_CALL)) {
      const [, filter, script] = match;
      if (PNPM_BUILTINS.has(script)) continue;

      if (filter) {
        if (PLACEHOLDER.test(filter)) continue;
        const target = resolveFilter(filter.replace(/^\.\.\.|\.\.\.$/g, ''));
        if (!target) {
          findings.push({
            file,
            line: span.line,
            kind: FINDING_KIND.unknownWorkspace,
            message: `\`pnpm --filter ${filter}\` names no workspace`,
          });
        } else if (!target.scripts.has(script)) {
          findings.push({
            file,
            line: span.line,
            kind: FINDING_KIND.missingScript,
            message: `\`pnpm --filter ${filter} ${script}\`: ${target.dir}/${PACKAGE_MANIFEST} has no "${script}" script`,
          });
        }
        continue;
      }

      // Unfiltered: the script runs from the repo root, or from the workspace
      // the citing file documents.
      if (ROOT_WORKSPACE?.scripts.has(script) || own?.scripts.has(script)) continue;
      findings.push({
        file,
        line: span.line,
        kind: FINDING_KIND.missingScript,
        message: `\`pnpm ${script}\`: no "${script}" script in the root ${PACKAGE_MANIFEST}${own ? ` or ${own.dir}/${PACKAGE_MANIFEST}` : ''}`,
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Check 3: budgets
// ---------------------------------------------------------------------------

function budgetFindings(file: string, content: string, lines: readonly string[]): Finding[] {
  const budget = BUDGETS[file];
  if (!budget) return [];
  const findings: Finding[] = [];
  const over = (line: number, message: string) =>
    findings.push({ file, line, kind: FINDING_KIND.overBudget, message });

  const lineCount = content.split('\n').length - 1;
  const byteCount = Buffer.byteLength(content);
  if (lineCount > budget.lines) over(1, `${lineCount} lines, budget is ${budget.lines}`);
  if (budget.bytes !== undefined && byteCount > budget.bytes) {
    over(1, `${byteCount} bytes, budget is ${budget.bytes}`);
  }
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

function check(): { scanned: number; findings: Finding[] } {
  const targets = FILES.filter((file) => SCANNED.some((pattern) => pattern.test(file)));
  const findings: Finding[] = [];
  for (const file of targets) {
    const content = readFileSync(path.join(ROOT, file), 'utf8');
    const lines = content.split('\n');
    const spans = spansOf(toPosix(file), lines);
    findings.push(
      ...pathFindings(file, spans),
      ...scriptFindings(file, spans),
      ...budgetFindings(file, content, lines),
    );
  }
  return { scanned: targets.length, findings };
}

const reportOnly = process.argv.includes(REPORT_FLAG);
const { scanned, findings } = check();

if (findings.length === 0) {
  console.log(
    `✓ instruction files OK — ${scanned} files, every cited path and pnpm script exists, all within budget`,
  );
  process.exit(0);
}

console.error(`\n✗ ${findings.length} instruction-file finding(s) in ${scanned} files:\n`);
for (const finding of findings) {
  console.error(`  ${finding.file}:${finding.line}`);
  console.error(`      ${finding.kind}: ${finding.message}\n`);
}
console.error(
  `Fix the citation, or the thing it cites. A path that is deliberately absent from the tree goes in SKIPPED_PATHS in scripts/check-agent-docs.ts with its reason; a budget is raised in BUDGETS in the same file.\n`,
);
process.exit(reportOnly ? 0 : 1);
