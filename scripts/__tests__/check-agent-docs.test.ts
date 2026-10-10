/**
 * check-agent-docs: what must be reported and what must pass.
 *
 * The citation table is one line of an instruction file per case, all in one
 * fixture repository; a case names the finding kinds expected on its line.
 */
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { checkAgentDocs } from '../check-agent-docs';
import { renderSolutionsIndex, SOLUTIONS_INDEX_PATH } from '../gen-solutions-index';
import { commit, type Files, lines, makeRepo, removeTree, track, writeFiles } from './fixture';

const findingsIn = (root: string) => checkAgentDocs(root).findings;

const KIND = {
  missingPath: 'missing-path',
  missingScript: 'missing-script',
  overBudget: 'over-budget',
  staleIndex: 'stale-index',
} as const;
type Kind = (typeof KIND)[keyof typeof KIND];

const ROOT_DOC = 'CLAUDE.md';
const MOBILE_DOC = 'apps/mobile/CLAUDE.md';
const SKILL_DOC = '.claude/skills/zz/SKILL.md';
const NONE: readonly Kind[] = [];

const manifest = (json: object): string => `${JSON.stringify(json, null, 2)}\n`;

const TREE: Files = {
  '.gitignore': 'node_modules\n',
  'package.json': manifest({
    name: 'fixture',
    scripts: { lint: 'x', test: 'x' },
  }),
  // Installed binaries: git-ignored, read from disk.
  'node_modules/.bin/tsx': '',
  'node_modules/.bin/turbo': '',
  'apps/mobile/package.json': manifest({
    name: '@fixture/mobile',
    scripts: { test: 'x', 'test:e2e': 'x', start: 'x' },
  }),
  'apps/web/package.json': manifest({ name: '@fixture/web', scripts: { test: 'x', dev: 'x' } }),
  'apps/mobile/src/lib/logger.ts': '',
  'apps/mobile/src/app/(tabs)/index.tsx': '',
  'docs/guide.md': '# Guide\n',
  'scripts/tool.ts': '',
};

type Case = {
  name: string;
  /** One line of Markdown; with more than one, the findings of the last are compared. */
  line: string;
  expect: readonly Kind[];
  /** Put the line inside a fenced block. */
  fenced?: boolean;
  /** The instruction file the line goes in. Default: the root one. */
  doc?: string;
};

const PATH_CASES: readonly Case[] = [
  // What must pass.
  { name: 'existing path in inline code', line: '`apps/mobile/src/lib/logger.ts`', expect: NONE },
  {
    name: 'route group keeps its parentheses',
    line: '`apps/mobile/src/app/(tabs)/index.tsx`',
    expect: NONE,
  },
  { name: 'line number suffix', line: '`apps/mobile/src/lib/logger.ts:12`', expect: NONE },
  { name: 'glob with a match', line: '`apps/*/package.json`', expect: NONE },
  { name: 'prose that is shaped like a path', line: '`Get/List/Create`', expect: NONE },
  {
    name: 'existing path in a fence',
    line: 'cat apps/mobile/src/lib/logger.ts',
    fenced: true,
    expect: NONE,
  },
  {
    name: 'import specifier in a fenced example',
    line: "import { x } from '../fuel-logs.service';",
    fenced: true,
    expect: NONE,
  },
  {
    name: './x import specifier in a fenced example',
    line: "import { a } from './helpers';",
    fenced: true,
    expect: NONE,
  },
  {
    name: './gradlew in a fenced command',
    line: 'cd android && ./gradlew assembleRelease',
    fenced: true,
    expect: NONE,
  },
  {
    name: 'git-ignored ./file in a fenced command',
    line: 'source ./.env.local',
    fenced: true,
    expect: NONE,
  },
  {
    name: 'existing ./path in a fence of a nested file',
    line: './src/lib/logger.ts',
    fenced: true,
    doc: MOBILE_DOC,
    expect: NONE,
  },
  { name: 'the current directory as a copy target', line: '`cp -r scripts ./`', expect: NONE },
  { name: 'the parent directory', line: '`cd ../`', expect: NONE },
  { name: 'two directories up', line: '`cd ../..`', expect: NONE },
  { name: 'link to an existing file', line: '[guide](docs/guide.md)', expect: NONE },
  { name: 'link with an anchor', line: '[guide](docs/guide.md#section)', expect: NONE },
  { name: 'link to a URL', line: '[site](https://example.com/apps/nope.md)', expect: NONE },
  { name: 'in-page anchor link', line: '[top](#guards)', expect: NONE },
  { name: 'existing path in quotes', line: "`'apps/mobile/src/lib/logger.ts'`", expect: NONE },
  {
    name: 'existing path after --flag=',
    line: '`--config=apps/mobile/package.json`',
    expect: NONE,
  },
  {
    name: 'existing path in sentence parentheses',
    line: '`(apps/mobile/src/lib/logger.ts)`',
    expect: NONE,
  },
  {
    name: 'path relative to a nested instruction file',
    line: '`src/lib/logger.ts`',
    doc: MOBILE_DOC,
    expect: NONE,
  },
  {
    name: './path from the repo root, cited in a nested file',
    line: '`./scripts/tool.ts`',
    doc: MOBILE_DOC,
    expect: NONE,
  },
  {
    name: './path from the repo root, cited in a skill',
    line: '`bash ./scripts/tool.ts https://x`',
    doc: SKILL_DOC,
    expect: NONE,
  },
  {
    name: './path next to a nested file',
    line: '`./src/lib/logger.ts`',
    doc: MOBILE_DOC,
    expect: NONE,
  },
  {
    name: '../path from a nested file',
    line: '`../../docs/guide.md`',
    doc: MOBILE_DOC,
    expect: NONE,
  },

  // What must be reported.
  {
    name: 'missing ./path in a nested file',
    line: '`./scripts/nope.sh`',
    doc: MOBILE_DOC,
    expect: [KIND.missingPath],
  },
  {
    name: 'missing ../path in a nested file',
    line: '`../nope/guide.md`',
    doc: MOBILE_DOC,
    expect: [KIND.missingPath],
  },
  {
    name: 'missing path in inline code',
    line: '`apps/mobile/src/lib/nope.ts`',
    expect: [KIND.missingPath],
  },
  { name: 'wrong case', line: '`apps/mobile/src/lib/Logger.ts`', expect: [KIND.missingPath] },
  { name: 'glob with no match', line: '`apps/*/src/**/*.nope`', expect: [KIND.missingPath] },
  {
    name: 'missing path in a fence',
    line: 'cat apps/mobile/src/lib/nope.ts',
    fenced: true,
    expect: [KIND.missingPath],
  },
  {
    name: 'missing ./path in a fence',
    line: './apps/mobile/nope.sh',
    fenced: true,
    expect: [KIND.missingPath],
  },
  {
    name: 'missing ./path in a fence of a nested file',
    line: './src/lib/nope.ts',
    fenced: true,
    doc: MOBILE_DOC,
    expect: [KIND.missingPath],
  },
  {
    name: 'link to a missing file',
    line: '[link](apps/mobile/src/lib/nope.ts)',
    expect: [KIND.missingPath],
  },
  {
    name: 'link to a missing single-segment file',
    line: '[link](NOPE.md)',
    expect: [KIND.missingPath],
  },
  {
    name: 'missing path with an anchor',
    line: '`apps/mobile/src/lib/nope.ts#L10`',
    expect: [KIND.missingPath],
  },
  {
    name: 'missing path after --flag=',
    line: '`--config=apps/mobile/nope.json`',
    expect: [KIND.missingPath],
  },
  {
    name: 'missing path in single quotes',
    line: "`'apps/mobile/src/lib/nope.ts'`",
    expect: [KIND.missingPath],
  },
  {
    name: 'missing path in double quotes',
    line: '`"apps/mobile/src/lib/nope.ts"`',
    expect: [KIND.missingPath],
  },
  {
    name: 'missing path wrapped in parentheses',
    line: '`(apps/mobile/nope.ts)`',
    expect: [KIND.missingPath],
  },
  {
    name: 'missing path closing a parenthesis',
    line: '`(see apps/mobile/nope.ts)`',
    expect: [KIND.missingPath],
  },
  {
    name: 'missing path relative to a nested instruction file',
    line: '`src/lib/nope.ts`',
    doc: MOBILE_DOC,
    expect: [KIND.missingPath],
  },
];

/** One fixture file per table: together they would be over the root file's line budget. */
const PNPM_ACCEPTED: readonly Case[] = [
  { name: 'root script', line: '`pnpm lint`', expect: NONE },
  { name: 'pnpm run <script>', line: '`pnpm run lint`', expect: NONE },
  { name: 'installed binary', line: '`pnpm tsx scripts/tool.ts`', expect: NONE },
  { name: 'installed binary with its own run word', line: '`pnpm turbo run build`', expect: NONE },
  { name: 'pnpm command with a flag', line: '`pnpm install --frozen-lockfile`', expect: NONE },
  { name: 'pnpm command that is not a script', line: '`pnpm config get registry`', expect: NONE },
  { name: 'pnpm upgrade', line: '`pnpm upgrade --latest`', expect: NONE },
  { name: 'pnpm version', line: '`pnpm version patch`', expect: NONE },
  { name: 'pnpm sbom', line: '`pnpm sbom --sbom-format cyclonedx`', expect: NONE },
  { name: 'pnpm cat-file', line: '`pnpm cat-file abc`', expect: NONE },
  { name: 'filter by full name', line: '`pnpm --filter @fixture/mobile test:e2e`', expect: NONE },
  { name: 'filter with =', line: '`pnpm --filter=mobile start`', expect: NONE },
  { name: 'filter by directory', line: '`pnpm --filter ./apps/mobile test`', expect: NONE },
  {
    name: 'filter by directory, cited from a nested file',
    line: '`pnpm --filter ./apps/mobile test`',
    doc: MOBILE_DOC,
    expect: NONE,
  },
  { name: 'filter by name glob', line: '`pnpm --filter "@fixture/*" test`', expect: NONE },
  { name: 'two filters', line: '`pnpm --filter mobile --filter web dev`', expect: NONE },
  { name: 'placeholder filter', line: '`pnpm --filter <pkg> test`', expect: NONE },
  { name: 'placeholder script', line: '`pnpm <script>`', expect: NONE },
  { name: 'a flag that takes a value', line: '`pnpm --reporter append-only lint`', expect: NONE },
  { name: 'cd into a workspace first', line: '`cd apps/mobile && pnpm test:e2e`', expect: NONE },
  { name: 'cd with a trailing slash', line: '`cd apps/mobile/ && pnpm test:e2e`', expect: NONE },
  { name: '-C with a trailing slash', line: '`pnpm -C apps/mobile/ test:e2e`', expect: NONE },
  {
    name: 'cd in a subshell, with an env prefix',
    line: '`pnpm --filter web test && (cd apps/mobile && PORT=3100 pnpm start)`',
    expect: NONE,
  },
  { name: 'cd; pnpm', line: '`cd apps/mobile; pnpm test:e2e`', expect: NONE },
  { name: '(cd; pnpm)', line: '`(cd apps/mobile; pnpm test:e2e)`', expect: NONE },
  {
    name: 'cd, another command, then pnpm',
    line: '`cd apps/mobile && npx expo install --fix && pnpm test:e2e`',
    expect: NONE,
  },
  {
    name: 'cd on one fenced line, pnpm on the next',
    line: 'cd apps/mobile\npnpm test:e2e',
    fenced: true,
    expect: NONE,
  },
  { name: 'cd into a variable', line: '`cd "$ROOT" && pnpm lint`', expect: NONE },
  { name: 'cd to a home-relative directory', line: '`cd ~/elsewhere && pnpm lint`', expect: NONE },
  { name: '-C <dir>', line: '`pnpm -C apps/mobile test:e2e`', expect: NONE },
  { name: '-r', line: '`pnpm -r dev`', expect: NONE },
  { name: '-w', line: '`pnpm -w lint`', expect: NONE },
  { name: 'a switch before the script', line: '`pnpm --silent lint`', expect: NONE },
  { name: '--if-present', line: '`pnpm --if-present nope`', expect: NONE },
  {
    name: 'script of the workspace the file documents',
    line: '`pnpm test:e2e`',
    doc: MOBILE_DOC,
    expect: NONE,
  },
  { name: 'pnpm-lock.yaml is not a call', line: '`pnpm-lock.yaml nope`', expect: NONE },
  {
    name: 'pnpm in a fenced shell comment',
    line: '# pnpm is run from the repo root',
    fenced: true,
    expect: NONE,
  },
  {
    name: 'pnpm in a comment after a fenced command',
    line: 'pnpm lint # pnpm is what runs it',
    fenced: true,
    expect: NONE,
  },

  // Precision the check gives up: which workspace a command runs in is not
  // resolved, so a script that exists in any package.json passes.
  { name: 'workspace script run from the root', line: '`pnpm test:e2e`', expect: NONE },
  { name: '`pnpm start` at the root, which has no start', line: '`pnpm start`', expect: NONE },
  { name: 'workspace script after -w', line: '`pnpm -w test:e2e`', expect: NONE },
  {
    name: "another workspace's script after cd",
    line: '`cd apps/mobile && pnpm dev`',
    expect: NONE,
  },
  { name: 'a filter that names no workspace', line: '`pnpm --filter nope test`', expect: NONE },
];

const PNPM_REPORTED: readonly Case[] = [
  { name: 'missing script', line: '`pnpm nope`', expect: [KIND.missingScript] },
  {
    name: 'missing script in a fence',
    line: 'pnpm nope',
    fenced: true,
    expect: [KIND.missingScript],
  },
  {
    name: 'missing script before a fenced comment',
    line: 'pnpm nope # pnpm lint',
    fenced: true,
    expect: [KIND.missingScript],
  },
  { name: 'missing script after run', line: '`pnpm run nope`', expect: [KIND.missingScript] },
  { name: 'missing script after -r', line: '`pnpm -r nope`', expect: [KIND.missingScript] },
  { name: 'missing script after -w', line: '`pnpm -w nope`', expect: [KIND.missingScript] },
  {
    name: 'missing script after a switch',
    line: '`pnpm --silent nope`',
    expect: [KIND.missingScript],
  },
  {
    name: 'missing script after a flag that takes a value',
    line: '`pnpm --loglevel warn nope`',
    expect: [KIND.missingScript],
  },
  {
    name: 'missing script after -C <dir>',
    line: '`pnpm -C apps/mobile nope`',
    expect: [KIND.missingScript],
  },
  {
    name: 'missing script after cd',
    line: '`cd apps/mobile && pnpm nope`',
    expect: [KIND.missingScript],
  },
  {
    name: 'missing script after two filters',
    line: '`pnpm --filter mobile --filter web nope`',
    expect: [KIND.missingScript],
  },
  {
    name: 'missing script after --filter=',
    line: '`pnpm --filter=mobile nope`',
    expect: [KIND.missingScript],
  },
  {
    name: 'missing script after filter and run',
    line: '`pnpm --filter mobile run nope`',
    expect: [KIND.missingScript],
  },
  {
    name: 'second call of a chain',
    line: '`pnpm lint && pnpm nope`',
    expect: [KIND.missingScript],
  },
  // The directory itself is still a cited path.
  {
    name: '-C into a directory that does not exist',
    line: '`pnpm -C apps/nope test`',
    expect: [KIND.missingPath],
  },
  {
    name: 'directory filter that does not exist',
    line: '`pnpm --filter ./apps/nope test`',
    expect: [KIND.missingPath],
  },
];

/** Lays the cases out as instruction files and records which line each one landed on. */
function layOut(cases: readonly Case[]): { docs: Files; lineOf: Map<Case, number> } {
  const FENCE = '```';
  const bodies = new Map<string, string[]>();
  const lineOf = new Map<Case, number>();
  for (const testCase of cases) {
    const body = bodies.get(testCase.doc ?? ROOT_DOC) ?? [];
    bodies.set(testCase.doc ?? ROOT_DOC, body);
    if (testCase.fenced) body.push(`${FENCE}sh`);
    body.push(...testCase.line.split('\n'));
    lineOf.set(testCase, body.length);
    if (testCase.fenced) body.push(FENCE);
  }
  const docs = Object.fromEntries([...bodies].map(([doc, body]) => [doc, `${body.join('\n')}\n`]));
  return { docs, lineOf };
}

/** A repository whose committed solutions index is current, so only the files under test can produce findings. */
function repoWith(files: Files): string {
  const root = makeRepo({ ...TREE, ...files });
  writeFiles(root, { [SOLUTIONS_INDEX_PATH]: renderSolutionsIndex(root) });
  track(root);
  commit(root);
  return root;
}

for (const [title, cases] of [
  ['cited paths', PATH_CASES],
  ['pnpm calls that pass', PNPM_ACCEPTED],
  ['pnpm calls that are reported', PNPM_REPORTED],
] as const) {
  describe(`check-agent-docs: ${title}`, () => {
    const { docs, lineOf } = layOut(cases);
    let root = '';
    let found: ReturnType<typeof findingsIn> = [];
    before(() => {
      root = repoWith(docs);
      found = findingsIn(root);
    });
    after(() => removeTree(root));

    for (const testCase of cases) {
      test(`${testCase.expect.length > 0 ? 'reports' : 'accepts'}: ${testCase.name}`, () => {
        const doc = testCase.doc ?? ROOT_DOC;
        const kinds = found
          .filter((finding) => finding.file === doc && finding.line === lineOf.get(testCase))
          .map((finding) => finding.kind)
          .sort();
        assert.deepEqual(kinds, [...testCase.expect].sort(), testCase.line);
      });
    }
  });
}

describe('check-agent-docs: which files count as existing', () => {
  // Pins `git ls-files --cached --others --exclude-standard`: without `--others` a
  // file added in the same change is "missing"; without `--exclude-standard` a
  // build output or a local .env makes a dead citation pass on one machine only.
  const cited = (file: string): string => `\`${file}\`\n`;
  const missingPaths = (root: string) =>
    findingsIn(root).filter((finding) => finding.kind === KIND.missingPath);

  test('accepts a path that exists only as an untracked file', () => {
    const root = repoWith({ [ROOT_DOC]: cited('scripts/new-tool.ts') });
    try {
      assert.equal(missingPaths(root).length, 1);
      writeFiles(root, { 'scripts/new-tool.ts': '' });
      assert.deepEqual(missingPaths(root), []);
    } finally {
      removeTree(root);
    }
  });

  test('reports a path that exists only as a git-ignored file', () => {
    const root = repoWith({
      '.gitignore': 'node_modules\ndist\n',
      [ROOT_DOC]: cited('apps/web/dist/main.js'),
    });
    try {
      writeFiles(root, { 'apps/web/dist/main.js': '' });
      assert.equal(missingPaths(root).length, 1);
    } finally {
      removeTree(root);
    }
  });
});

describe('check-agent-docs: where a missing path was looked for', () => {
  const cases: readonly { name: string; doc: string; line: string; looked: string }[] = [
    { name: 'a root file', doc: ROOT_DOC, line: '`apps/mobile/nope.ts`', looked: 'the repo root' },
    {
      name: 'a nested file',
      doc: MOBILE_DOC,
      line: '`./scripts/nope.sh`',
      looked: '`apps/mobile/` and the repo root',
    },
    { name: 'a ../ path', doc: MOBILE_DOC, line: '`../nope/guide.md`', looked: '`apps/mobile/`' },
  ];
  for (const { name, doc, line, looked } of cases) {
    test(`the message names the directories tried: ${name}`, () => {
      const root = repoWith({ [doc]: `${line}\n` });
      try {
        const [finding] = findingsIn(root).filter((found) => found.kind === KIND.missingPath);
        assert.ok(finding.message.endsWith(`(looked in ${looked})`), finding.message);
      } finally {
        removeTree(root);
      }
    });
  }
});

describe('check-agent-docs: pnpm calls outside Markdown code', () => {
  const CONFIG = '.claude/verification-config.json';
  const scriptFindingsOf = (files: Files) => {
    const root = repoWith(files);
    try {
      return findingsIn(root).filter((finding) => finding.kind === KIND.missingScript);
    } finally {
      removeTree(root);
    }
  };

  test('accepts: the word pnpm in a JSON sentence', () => {
    const config = manifest({ note: 'Always use pnpm for installs', command: 'pnpm lint' });
    assert.deepEqual(scriptFindingsOf({ [CONFIG]: config }), []);
  });

  test('reports: a JSON command string that names a missing script', () => {
    const config = manifest({ note: 'Always use pnpm for installs', command: 'pnpm nope' });
    const found = scriptFindingsOf({ [CONFIG]: config });
    assert.deepEqual(
      found.map((finding) => [finding.file, finding.line]),
      [[CONFIG, 3]],
    );
    assert.match(found[0].message, /PNPM_COMMANDS/);
  });

  test('does not judge a word when no dependencies are installed', () => {
    const root = makeRepo({
      'package.json': manifest({ scripts: {} }),
      [ROOT_DOC]: '`pnpm nope`\n',
    });
    try {
      writeFiles(root, { [SOLUTIONS_INDEX_PATH]: renderSolutionsIndex(root) });
      track(root);
      commit(root);
      const result = checkAgentDocs(root);
      assert.deepEqual(result.findings, []);
      assert.equal(result.pnpmCallsChecked, false);
    } finally {
      removeTree(root);
    }
  });
});

describe('check-agent-docs: budgets', () => {
  const NESTED_DOC = 'apps/mobile/src/features/CLAUDE.md';
  const MAP_DOC = 'docs/MAP.md';
  const bytes = (count: number): string => `${'x'.repeat(count - 1)}\n`;
  /** `count` bytes in lines short enough for the root file's per-line cap. */
  const shortLines = (count: number): string => lines(count / 100, 'x'.repeat(99));
  /** Exactly `count` bytes, in lines of at most 100. */
  const bytesInLines = (count: number): string =>
    `${shortLines(count - (count % 100))}${count % 100 ? bytes(count % 100) : ''}`;

  const cases: readonly { name: string; doc: string; content: string; over: boolean }[] = [
    // Planned sizes are 5,500 bytes / 80 lines / 300 bytes a line for the root file; the caps add 10%.
    { name: 'root file at exactly 110%', doc: ROOT_DOC, content: bytesInLines(6050), over: false },
    {
      name: 'root file one byte over 110%',
      doc: ROOT_DOC,
      content: bytesInLines(6051),
      over: true,
    },
    {
      name: 'unlisted CLAUDE.md at exactly 110%',
      doc: NESTED_DOC,
      content: bytes(3300),
      over: false,
    },
    {
      name: 'unlisted CLAUDE.md one byte over 110%',
      doc: NESTED_DOC,
      content: bytes(3301),
      over: true,
    },
    { name: 'mobile file at 110 lines', doc: MOBILE_DOC, content: lines(110, 'x'), over: false },
    { name: 'mobile file at 111 lines', doc: MOBILE_DOC, content: lines(111, 'x'), over: true },
    {
      name: 'root file a little over its planned size',
      doc: ROOT_DOC,
      content: shortLines(5600),
      over: false,
    },
    {
      name: 'root file over planned size plus headroom',
      doc: ROOT_DOC,
      content: shortLines(6100),
      over: true,
    },
    { name: 'root file with too many lines', doc: ROOT_DOC, content: lines(89, 'x'), over: true },
    { name: 'root file with one long line', doc: ROOT_DOC, content: bytes(340), over: true },
    {
      name: 'a CLAUDE.md the table does not list, small',
      doc: NESTED_DOC,
      content: bytes(3200),
      over: false,
    },
    {
      name: 'a CLAUDE.md the table does not list, too many bytes',
      doc: NESTED_DOC,
      content: bytes(3400),
      over: true,
    },
    {
      name: 'a CLAUDE.md the table does not list, too many lines',
      doc: NESTED_DOC,
      content: lines(50, 'x'),
      over: true,
    },
    {
      name: 'docs/MAP.md within its byte cap',
      doc: MAP_DOC,
      content: shortLines(10500),
      over: false,
    },
    { name: 'docs/MAP.md over its byte cap', doc: MAP_DOC, content: shortLines(11100), over: true },
    { name: 'docs/MAP.md with too many lines', doc: MAP_DOC, content: lines(166, 'x'), over: true },
  ];

  for (const { name, doc, content, over } of cases) {
    test(`${over ? 'reports' : 'accepts'}: ${name}`, () => {
      const root = repoWith({ [doc]: content });
      try {
        const overBudget = findingsIn(root).filter((finding) => finding.kind === KIND.overBudget);
        assert.equal(overBudget.length > 0, over, JSON.stringify(overBudget));
        assert.ok(overBudget.every((finding) => finding.file === doc));
      } finally {
        removeTree(root);
      }
    });
  }
});

describe('check-agent-docs: solutions index', () => {
  const DOC = 'docs/solutions/ui-bugs/a-bug.md';
  const ANOTHER = 'docs/solutions/ui-bugs/another.md';
  const staleFindings = (root: string) =>
    findingsIn(root).filter((finding) => finding.kind === KIND.staleIndex);
  const staleIn = (root: string): boolean => staleFindings(root).length > 0;
  const withRepo = (files: Files, body: (root: string) => void): void => {
    const root = repoWith(files);
    try {
      body(root);
    } finally {
      removeTree(root);
    }
  };

  test('accepts a current index, reports one that misses a committed document', () => {
    withRepo({ [DOC]: '# A bug\n' }, (root) => {
      assert.equal(staleIn(root), false);
      writeFiles(root, { [ANOTHER]: '# Another\n' });
      track(root);
      commit(root);
      assert.equal(staleIn(root), true);
    });
  });

  test('reads the last commit: a staged or unstaged change of a document changes nothing', () => {
    withRepo({ [DOC]: '# A bug\n', 'docs/solutions/ui-bugs/b.md': '# B\n' }, (root) => {
      rmSync(path.join(root, DOC));
      writeFiles(root, { 'docs/solutions/ui-bugs/b.md': '# Retitled\n', [ANOTHER]: '# Another\n' });
      assert.equal(staleIn(root), false);
      track(root);
      assert.equal(staleIn(root), false);
      commit(root);
      assert.equal(staleIn(root), true);
    });
  });

  test('a regenerated index that is staged but not committed is still stale, and the message says to commit', () => {
    withRepo({ [DOC]: '# A bug\n' }, (root) => {
      writeFiles(root, { [ANOTHER]: '# Another\n' });
      track(root);
      commit(root);
      writeFiles(root, { [SOLUTIONS_INDEX_PATH]: renderSolutionsIndex(root) });
      track(root);
      const [finding] = staleFindings(root);
      assert.match(finding.message, /last commit \(HEAD\)/);
      assert.match(finding.message, /staged index is current.*git commit/);
      commit(root);
      assert.equal(staleIn(root), false);
    });
  });

  test('the stale message gives the steps in an order that works, ending in a commit', () => {
    withRepo({ [DOC]: '# A bug\n' }, (root) => {
      writeFiles(root, { [ANOTHER]: '# Another\n' });
      track(root);
      commit(root);
      const [finding] = staleFindings(root);
      assert.match(finding.message, /last commit \(HEAD\)/);
      assert.match(
        finding.message,
        /git add -u docs\/solutions && pnpm exec tsx scripts\/gen-solutions-index\.ts && git add docs\/solutions\/README\.md && git commit/,
      );
    });
  });

  test('accepts an untracked draft beside a current index', () => {
    withRepo({ [DOC]: '# A bug\n' }, (root) => {
      writeFiles(root, { 'docs/solutions/ui-bugs/zz-draft.md': '# Draft\n' });
      assert.equal(staleIn(root), false);
    });
  });
});
