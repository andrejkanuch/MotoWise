/**
 * The guards as pre-push and CI run them: a process and its exit status.
 * The other suites call the exported functions, which never reach `main()`,
 * so a guard that printed its findings and exited 0 would pass all of them.
 */
import assert from 'node:assert/strict';
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import {
  renderSolutionsIndex,
  SOLUTIONS_INDEX_COMMAND,
  SOLUTIONS_INDEX_PATH,
  SOLUTIONS_INDEX_REMEDY,
} from '../gen-solutions-index';
import { commit, type Files, makeRepo, makeTree, removeTree, track, writeFiles } from './fixture';

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

/** Runs a guard with exactly `args` and returns how the process ended. */
function runWith(script: Script, ...args: string[]) {
  const { status, stdout, stderr } = spawnSync(TSX, [path.join(REPO, script), ...args], {
    encoding: 'utf8',
  });
  return { status, stdout, stderr };
}

/** Runs a guard on the tree at `root`. */
const run = (script: Script, root: string, ...flags: string[]) =>
  runWith(script, `--root=${root}`, ...flags);

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
    commit(root);
    return root;
  };
  const CLEAN = '`scripts/tool.ts` and `pnpm lint`\n';
  const VIOLATING = '`scripts/nope.ts` and `pnpm nope`\n';

  test('exits 0 on a clean tree', () => {
    withTree(repoWith(CLEAN), (root) => {
      const { status, stdout, stderr } = run(SCRIPT.agentDocs, root);
      assert.equal(status, OK, stderr);
      // One file: the fixture's. The real checkout has more, so this fails if --root is ignored.
      assert.match(stdout, /instruction files OK — 1 files/);
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

describe('--root', () => {
  const STACK_FRAME = /\n\s+at /;
  const BAD: readonly { name: string; args: readonly string[] }[] = [
    { name: 'an empty --root=', args: ['--root='] },
    { name: 'a bare --root', args: ['--root'] },
    { name: 'the space form', args: ['--root', REPO] },
    { name: 'a directory that does not exist', args: [`--root=${path.join(REPO, 'no-such-dir')}`] },
    { name: 'a file', args: [`--root=${path.join(REPO, 'package.json')}`] },
  ];
  for (const script of Object.values(SCRIPT)) {
    for (const { name, args } of BAD) {
      test(`${script} exits 1 with one line for ${name}`, () => {
        const { status, stdout, stderr } = runWith(script, ...args);
        assert.equal(status, FAILED, stdout);
        assert.match(stderr, /^✗ --root.*\n$/);
        assert.doesNotMatch(stderr, STACK_FRAME);
        assert.equal(stdout, '');
      });
    }
  }
});

describe('gen-solutions-index as a CLI', () => {
  const DOCS: Files = { 'docs/solutions/ui-bugs/a-bug.md': '# A bug\n' };
  const NEW_DOC = 'docs/solutions/ui-bugs/b.md';
  const DRAFT = 'docs/solutions/ui-bugs/zz-draft.md';
  const check = (root: string) => run(SCRIPT.solutionsIndex, root, '--check');
  const sh = (root: string, command: string): string =>
    execSync(command, { cwd: root, encoding: 'utf8' });
  /** A repository whose last commit holds `files` and a current index. */
  const committed = (files: Files): string => {
    const root = makeRepo(files);
    writeFiles(root, { [SOLUTIONS_INDEX_PATH]: renderSolutionsIndex(root) });
    track(root);
    commit(root);
    return root;
  };
  /** The same, then a commit that adds a document without regenerating the index. */
  const committedStale = (): string => {
    const root = committed(DOCS);
    writeFiles(root, { [NEW_DOC]: '# B\n' });
    track(root);
    commit(root);
    return root;
  };

  test('--check exits 0 when the committed index is current', () => {
    withTree(committed(DOCS), (root) => {
      const { status, stdout, stderr } = check(root);
      assert.equal(status, OK, stderr);
      assert.match(stdout, /up to date/);
    });
  });

  test('--check exits 1 when it is stale, and says which state it read', () => {
    withTree(committedStale(), (root) => {
      const { status, stderr } = check(root);
      assert.equal(status, FAILED, stderr);
      assert.match(stderr, /is stale/);
      assert.match(stderr, /last commit \(HEAD\)/);
    });
  });

  test('--check exits 0 in a repository with no commit', () => {
    withTree(makeRepo(DOCS), (root) => {
      const { status, stdout, stderr } = check(root);
      assert.equal(status, OK, stderr);
      assert.match(stdout, /no commit/);
    });
  });

  test('--check judges the commit a push sends, not what is staged', () => {
    withTree(committed(DOCS), (root) => {
      // A staged document that is not committed does not block a push of clean commits.
      writeFiles(root, { [NEW_DOC]: '# B\n' });
      track(root);
      assert.equal(check(root).status, OK);
      commit(root);
      // A regenerated index that is staged but not committed does not make the commit current.
      assert.equal(run(SCRIPT.solutionsIndex, root).status, OK);
      sh(root, `git add ${SOLUTIONS_INDEX_PATH}`);
      const { status, stderr } = check(root);
      assert.equal(status, FAILED, stderr);
      assert.match(stderr, /staged index is current.*git commit/);
      commit(root);
      assert.equal(check(root).status, OK);
    });
  });

  test('the printed steps work on the first run and leave an untracked draft alone', () => {
    withTree(committedStale(), (root) => {
      writeFiles(root, { [DRAFT]: '# Draft\n', 'docs/solutions/ui-bugs/a-bug.md': '# Retitled\n' });
      const { status, stderr } = check(root);
      assert.equal(status, FAILED, stderr);
      assert.ok(stderr.includes(SOLUTIONS_INDEX_REMEDY.join(' && ')), stderr);
      for (const step of SOLUTIONS_INDEX_REMEDY) {
        if (step === SOLUTIONS_INDEX_COMMAND)
          assert.equal(run(SCRIPT.solutionsIndex, root).status, OK);
        else sh(root, step === 'git commit' ? `${step} --quiet --message=index` : step);
      }
      assert.equal(check(root).status, OK);
      assert.equal(sh(root, 'git status --porcelain'), `?? ${DRAFT}\n`);
      const index = sh(root, `git show HEAD:${SOLUTIONS_INDEX_PATH}`);
      assert.ok(index.includes('Retitled') && index.includes('b.md'), index);
      assert.equal(index.includes('zz-draft'), false, index);
    });
  });

  test('without --check it names what it did not read', () => {
    withTree(committed(DOCS), (root) => {
      writeFiles(root, { [DRAFT]: '# Draft\n', 'docs/solutions/ui-bugs/a-bug.md': '# Retitled\n' });
      const { status, stdout } = run(SCRIPT.solutionsIndex, root);
      assert.equal(status, OK);
      assert.match(stdout, /Not read, because not staged/);
      assert.ok(stdout.includes(DRAFT) && stdout.includes('a-bug.md'), stdout);
    });
  });
});
