/** gen-solutions-index: which documents the index lists. */
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
  renderSolutionsIndex,
  SOLUTIONS_INDEX_PATH,
  solutionsIndexIsCurrent,
} from '../gen-solutions-index';
import { type Files, makeRepo, removeTree, track, writeFiles } from './fixture';

const TRACKED: Files = {
  'docs/solutions/ui-bugs/a-bug.md': '---\ntitle: A bug\nmodule: mobile\nsymptom: It breaks\n---\n',
  'docs/solutions/build-errors/a-build.md': '# A build error\n',
};

function withRepo(files: Files, run: (root: string) => void): void {
  const root = makeRepo(files);
  try {
    run(root);
  } finally {
    removeTree(root);
  }
}

const cases: readonly { name: string; add: Files; tracked: boolean; row: string | null }[] = [
  {
    name: 'a tracked document, with its front matter',
    add: {},
    tracked: true,
    row: '| [a-bug.md](ui-bugs/a-bug.md) | A bug | mobile | It breaks |',
  },
  {
    name: 'a document one directory deeper, under its category',
    add: { 'docs/solutions/ui-bugs/sheets/nested.md': '# Nested\n' },
    tracked: true,
    row: '| [sheets/nested.md](ui-bugs/sheets/nested.md) | Nested | — | — |',
  },
  {
    name: 'a document directly in docs/solutions',
    add: { 'docs/solutions/loose.md': '# Loose\n' },
    tracked: true,
    row: '| [loose.md](loose.md) | Loose | — | — |',
  },
  {
    name: 'not an untracked draft',
    add: { 'docs/solutions/ui-bugs/zz-draft.md': '# Draft\n' },
    tracked: false,
    row: null,
  },
];

for (const { name, add, tracked, row } of cases) {
  test(`the index lists ${name}`, () => {
    withRepo(TRACKED, (root) => {
      writeFiles(root, add);
      if (tracked) track(root);
      const index = renderSolutionsIndex(root);
      if (row) assert.ok(index.includes(row), index);
      for (const file of Object.keys(add)) {
        assert.equal(index.includes(file.split('/').pop() ?? file), tracked, index);
      }
    });
  });
}

test('the index is the same with and without an untracked draft', () => {
  withRepo(TRACKED, (root) => {
    writeFiles(root, { [SOLUTIONS_INDEX_PATH]: renderSolutionsIndex(root) });
    track(root);
    assert.equal(solutionsIndexIsCurrent(root), true);
    writeFiles(root, { 'docs/solutions/ui-bugs/zz-draft.md': '# Draft\n' });
    assert.equal(solutionsIndexIsCurrent(root), true);
    track(root);
    assert.equal(solutionsIndexIsCurrent(root), false);
  });
});

test('the index is built from the staged state, not the working tree', () => {
  withRepo(TRACKED, (root) => {
    const staged = renderSolutionsIndex(root);
    rmSync(path.join(root, 'docs/solutions/build-errors/a-build.md'));
    writeFiles(root, { 'docs/solutions/ui-bugs/a-bug.md': '# Retitled, not staged\n' });
    assert.equal(renderSolutionsIndex(root), staged);
    track(root);
    const restaged = renderSolutionsIndex(root);
    assert.equal(restaged.includes('a-build.md'), false, restaged);
    assert.ok(restaged.includes('Retitled, not staged'), restaged);
  });
});

test('a regenerated index is current once it is staged', () => {
  withRepo(TRACKED, (root) => {
    writeFiles(root, { [SOLUTIONS_INDEX_PATH]: renderSolutionsIndex(root) });
    assert.equal(solutionsIndexIsCurrent(root), false);
    track(root);
    assert.equal(solutionsIndexIsCurrent(root), true);
    writeFiles(root, { [SOLUTIONS_INDEX_PATH]: 'edited, not staged\n' });
    assert.equal(solutionsIndexIsCurrent(root), true);
  });
});

test('the index does not list itself, and a missing index is not current', () => {
  withRepo(TRACKED, (root) => {
    assert.equal(solutionsIndexIsCurrent(root), false);
    writeFiles(root, { [SOLUTIONS_INDEX_PATH]: renderSolutionsIndex(root) });
    track(root);
    assert.equal(renderSolutionsIndex(root).includes('README.md'), false);
    assert.equal(solutionsIndexIsCurrent(root), true);
  });
});
