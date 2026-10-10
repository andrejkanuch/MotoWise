/**
 * The guards as pre-push and CI run them: a process and its exit status.
 * The other suites call the exported functions, which never reach `main()`,
 * so a guard that printed its findings and exited 0 would pass all of them.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { renderSolutionsIndex, SOLUTIONS_INDEX_PATH } from '../gen-solutions-index';
import { type Files, makeRepo, makeTree, removeTree, track, writeFiles } from './fixture';

const REPO = path.resolve(import.meta.dirname, '../..');
const TSX = path.join(REPO, 'node_modules/.bin/tsx');

const SCRIPT = {
  agentDocs: 'scripts/check-agent-docs.ts',
  mobileStructure: 'scripts/check-mobile-structure.ts',
  solutionsIndex: 'scripts/gen-solutions-index.ts',
} as const;
type Script = (typeof SCRIPT)[keyof typeof SCRIPT];

const OK = 0;
const FAILED = 1;

/** Runs a guard on the tree at `root` and returns how the process ended. */
function run(script: Script, root: string, ...flags: string[]) {
  const { status, stdout, stderr } = spawnSync(
    TSX,
    [path.join(REPO, script), `--root=${root}`, ...flags],
    { encoding: 'utf8' },
  );
  return { status, stdout, stderr };
}

function withTree(root: string, body: (root: string) => void): void {
  try {
    body(root);
  } finally {
    removeTree(root);
  }
}

describe('check-agent-docs as a CLI', () => {
  const BASE: Files = {
    '.gitignore': 'node_modules\n',
    'package.json': '{"scripts":{"lint":"x"}}\n',
    'node_modules/.bin/tsx': '',
    'scripts/tool.ts': '',
  };
  /** A repository whose solutions index is current and staged. */
  const repoWith = (doc: string): string => {
    const root = makeRepo({ ...BASE, 'CLAUDE.md': doc });
    writeFiles(root, { [SOLUTIONS_INDEX_PATH]: renderSolutionsIndex(root) });
    track(root);
    return root;
  };
  const CLEAN = '`scripts/tool.ts` and `pnpm lint`\n';
  const VIOLATING = '`scripts/nope.ts` and `pnpm nope`\n';

  test('exits 0 on a clean tree', () => {
    withTree(repoWith(CLEAN), (root) => {
      const { status, stdout, stderr } = run(SCRIPT.agentDocs, root);
      assert.equal(status, OK, stderr);
      assert.match(stdout, /instruction files OK/);
    });
  });

  test('exits 1 on a tree with findings, and prints them', () => {
    withTree(repoWith(VIOLATING), (root) => {
      const { status, stderr } = run(SCRIPT.agentDocs, root);
      assert.equal(status, FAILED, stderr);
      assert.match(stderr, /missing-path/);
      assert.match(stderr, /missing-script/);
    });
  });

  test('--report prints the findings and exits 0', () => {
    withTree(repoWith(VIOLATING), (root) => {
      const { status, stderr } = run(SCRIPT.agentDocs, root, '--report');
      assert.equal(status, OK, stderr);
      assert.match(stderr, /missing-path/);
    });
  });
});

describe('check-mobile-structure as a CLI', () => {
  const SRC = 'apps/mobile/src';
  const BASELINE = 'scripts/mobile-structure-baseline.json';
  const EMPTY_BASELINE = '{"deepImports":{},"layering":{},"routes":{}}\n';
  const MODULE = 'export const value = 1;\n';
  const CLEAN: Files = { [`${SRC}/lib/logger.ts`]: MODULE };
  const VIOLATING: Files = {
    ...CLEAN,
    [`${SRC}/utils/format.ts`]: `import '@/lib/logger';\n${MODULE}`,
  };

  test('exits 0 on a clean tree', () => {
    withTree(makeTree({ ...CLEAN, [BASELINE]: EMPTY_BASELINE }), (root) => {
      const { status, stdout, stderr } = run(SCRIPT.mobileStructure, root);
      assert.equal(status, OK, stderr);
      assert.match(stdout, /mobile structure OK/);
    });
  });

  test('exits 1 on a tree with a violation, and prints it', () => {
    withTree(makeTree({ ...VIOLATING, [BASELINE]: EMPTY_BASELINE }), (root) => {
      const { status, stderr } = run(SCRIPT.mobileStructure, root);
      assert.equal(status, FAILED, stderr);
      assert.match(stderr, /rule: layering/);
    });
  });

  test('exits 1 when the baseline file is missing', () => {
    withTree(makeTree(CLEAN), (root) => {
      const { status, stderr } = run(SCRIPT.mobileStructure, root);
      assert.equal(status, FAILED, stderr);
      assert.match(stderr, /is missing/);
    });
  });

  const MALFORMED: readonly { name: string; baseline: string }[] = [
    { name: 'is not JSON', baseline: '{"deepImports": {' },
    { name: 'is null', baseline: 'null\n' },
    {
      name: 'holds a count that is not a number',
      baseline: '{"routes":{"app/index.tsx":"400"}}\n',
    },
    { name: 'holds a rule that is not an object', baseline: '{"layering":[]}\n' },
  ];
  for (const { name, baseline } of MALFORMED) {
    for (const flags of [[], ['--update']]) {
      test(`exits 1 with a message, not a stack, when the baseline ${name} (${flags.join(' ') || 'check'})`, () => {
        withTree(makeTree({ ...VIOLATING, [BASELINE]: baseline }), (root) => {
          const { status, stderr } = run(SCRIPT.mobileStructure, root, ...flags);
          assert.equal(status, FAILED, stderr);
          assert.match(stderr, /mobile-structure-baseline\.json is not a valid baseline/);
          assert.doesNotMatch(stderr, /\n\s+at /);
          // --update must not replace a file it could not read with today's violations.
          assert.equal(readFileSync(path.join(root, BASELINE), 'utf8'), baseline);
        });
      });
    }
  }
});

describe('gen-solutions-index --check as a CLI', () => {
  const DOCS: Files = { 'docs/solutions/ui-bugs/a-bug.md': '# A bug\n' };

  test('exits 0 when the staged index is current', () => {
    const root = makeRepo(DOCS);
    writeFiles(root, { [SOLUTIONS_INDEX_PATH]: renderSolutionsIndex(root) });
    track(root);
    withTree(root, () => {
      const { status, stdout, stderr } = run(SCRIPT.solutionsIndex, root, '--check');
      assert.equal(status, OK, stderr);
      assert.match(stdout, /up to date/);
    });
  });

  test('exits 1 when it is stale, and says which state it read', () => {
    withTree(makeRepo({ ...DOCS, [SOLUTIONS_INDEX_PATH]: '# Solved problems\n' }), (root) => {
      const { status, stderr } = run(SCRIPT.solutionsIndex, root, '--check');
      assert.equal(status, FAILED, stderr);
      assert.match(stderr, /is stale/);
      assert.match(stderr, /git index/);
    });
  });

  test('without --check it writes the index, which is current once staged', () => {
    withTree(makeRepo(DOCS), (root) => {
      assert.equal(run(SCRIPT.solutionsIndex, root).status, OK);
      assert.equal(run(SCRIPT.solutionsIndex, root, '--check').status, FAILED);
      track(root);
      assert.equal(run(SCRIPT.solutionsIndex, root, '--check').status, OK);
    });
  });
});
