/**
 * check-agent-docs: what must be reported and what must pass.
 *
 * The citation table is one line of an instruction file per case, all in one
 * fixture repository; a case names the finding kinds expected on its line.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { checkAgentDocs } from '../check-agent-docs';
import { renderSolutionsIndex, SOLUTIONS_INDEX_PATH } from '../gen-solutions-index';
import { type Files, lines, makeRepo, removeTree, track, writeFiles } from './fixture';

const findingsIn = (root: string) => checkAgentDocs(root).findings;

const KIND = {
  missingPath: 'missing-path',
  missingScript: 'missing-script',
  unknownWorkspace: 'unknown-workspace',
  overBudget: 'over-budget',
  staleIndex: 'stale-index',
} as const;
type Kind = (typeof KIND)[keyof typeof KIND];

const ROOT_DOC = 'CLAUDE.md';
const MOBILE_DOC = 'apps/mobile/CLAUDE.md';
const NONE: readonly Kind[] = [];

const manifest = (json: object): string => `${JSON.stringify(json, null, 2)}\n`;

const TREE: Files = {
  '.gitignore': 'node_modules\n',
  'package.json': manifest({
    name: 'fixture',
    scripts: { lint: 'x', test: 'x' },
    devDependencies: { tsx: '1', '@biomejs/biome': '1' },
  }),
  // An installed binary whose package the root does not declare.
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
  /** One line of Markdown. */
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

  // What must be reported.
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

const PNPM_CASES: readonly Case[] = [
  // What must pass.
  { name: 'root script', line: '`pnpm lint`', expect: NONE },
  { name: 'pnpm run <script>', line: '`pnpm run lint`', expect: NONE },
  { name: 'binary of a declared dependency', line: '`pnpm tsx scripts/tool.ts`', expect: NONE },
  { name: 'binary of a scoped dependency', line: '`pnpm biome check .`', expect: NONE },
  { name: 'installed binary', line: '`pnpm turbo run build`', expect: NONE },
  { name: 'pnpm command with a flag', line: '`pnpm install --frozen-lockfile`', expect: NONE },
  { name: 'pnpm command that is not a script', line: '`pnpm config get registry`', expect: NONE },
  { name: 'filter by full name', line: '`pnpm --filter @fixture/mobile test:e2e`', expect: NONE },
  { name: 'filter by unscoped name', line: '`pnpm --filter mobile test:e2e`', expect: NONE },
  { name: 'filter with =', line: '`pnpm --filter=mobile start`', expect: NONE },
  { name: 'filter by directory', line: '`pnpm --filter ./apps/mobile test`', expect: NONE },
  { name: 'filter by name glob', line: '`pnpm --filter "@fixture/*" test`', expect: NONE },
  {
    name: 'two filters, script in one of them',
    line: '`pnpm --filter mobile --filter web dev`',
    expect: NONE,
  },
  { name: 'placeholder filter', line: '`pnpm --filter <pkg> test`', expect: NONE },
  { name: 'cd into a workspace first', line: '`cd apps/mobile && pnpm test:e2e`', expect: NONE },
  { name: '-C <dir>', line: '`pnpm -C apps/mobile test:e2e`', expect: NONE },
  { name: '-r, script in some workspace', line: '`pnpm -r dev`', expect: NONE },
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

  // What must be reported.
  { name: 'missing script', line: '`pnpm nope`', expect: [KIND.missingScript] },
  {
    name: 'missing script in a fence',
    line: 'pnpm nope',
    fenced: true,
    expect: [KIND.missingScript],
  },
  { name: 'missing script after -r', line: '`pnpm -r nope`', expect: [KIND.missingScript] },
  { name: 'missing script after -w', line: '`pnpm -w nope`', expect: [KIND.missingScript] },
  { name: 'workspace script after -w', line: '`pnpm -w test:e2e`', expect: [KIND.missingScript] },
  {
    name: 'missing script after a switch',
    line: '`pnpm --silent nope`',
    expect: [KIND.missingScript],
  },
  {
    name: 'missing script after -C <dir>',
    line: '`pnpm -C apps/mobile nope`',
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
    name: 'workspace script run from the root',
    line: '`pnpm test:e2e`',
    expect: [KIND.missingScript],
  },
  {
    name: "another workspace's script after cd",
    line: '`cd apps/mobile && pnpm dev`',
    expect: [KIND.missingScript],
  },
  { name: 'unknown filter', line: '`pnpm --filter nope test`', expect: [KIND.unknownWorkspace] },
  {
    name: 'unknown directory filter',
    line: '`pnpm --filter ./apps/nope test`',
    expect: [KIND.missingPath, KIND.unknownWorkspace],
  },
  {
    name: 'one unknown filter of two',
    line: '`pnpm --filter mobile --filter nope test`',
    expect: [KIND.unknownWorkspace],
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
    body.push(testCase.line);
    lineOf.set(testCase, body.length);
    if (testCase.fenced) body.push(FENCE);
    body.push('');
  }
  const docs = Object.fromEntries([...bodies].map(([doc, body]) => [doc, `${body.join('\n')}\n`]));
  return { docs, lineOf };
}

/** A repository whose solutions index is current, so only the files under test can produce findings. */
function repoWith(files: Files): string {
  const root = makeRepo({ ...TREE, ...files });
  writeFiles(root, { [SOLUTIONS_INDEX_PATH]: renderSolutionsIndex(root) });
  track(root);
  return root;
}

for (const [title, cases] of [
  ['cited paths', PATH_CASES],
  ['pnpm calls', PNPM_CASES],
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

describe('check-agent-docs: budgets', () => {
  const NESTED_DOC = 'apps/mobile/src/features/CLAUDE.md';
  const MAP_DOC = 'docs/MAP.md';
  const bytes = (count: number): string => `${'x'.repeat(count - 1)}\n`;
  /** `count` bytes in lines short enough for the root file's per-line cap. */
  const shortLines = (count: number): string => lines(count / 100, 'x'.repeat(99));

  const cases: readonly { name: string; doc: string; content: string; over: boolean }[] = [
    // Planned sizes are 5,500 bytes / 80 lines / 300 bytes a line for the root file; the caps add 10%.
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
  const staleIn = (root: string): boolean =>
    findingsIn(root).some((finding) => finding.kind === KIND.staleIndex);

  test('accepts a current index, reports one that misses a tracked document', () => {
    const root = repoWith({ [DOC]: '# A bug\n' });
    try {
      assert.equal(staleIn(root), false);
      writeFiles(root, { 'docs/solutions/ui-bugs/another.md': '# Another\n' });
      track(root);
      assert.equal(staleIn(root), true);
    } finally {
      removeTree(root);
    }
  });

  test('accepts an untracked draft beside a current index', () => {
    const root = repoWith({ [DOC]: '# A bug\n' });
    try {
      writeFiles(root, { 'docs/solutions/ui-bugs/zz-draft.md': '# Draft\n' });
      assert.equal(staleIn(root), false);
    } finally {
      removeTree(root);
    }
  });
});
