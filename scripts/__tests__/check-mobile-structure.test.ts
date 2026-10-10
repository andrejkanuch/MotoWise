/**
 * check-mobile-structure: one small `apps/mobile/src` tree and baseline per
 * case, and the kinds of violation the guard must report for it.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { checkMobileStructure } from '../check-mobile-structure';
import { type Files, lines, makeTree, removeTree, writeFiles } from './fixture';

const violationsIn = (root: string) => checkMobileStructure(root)?.violations ?? null;

const KIND = {
  deepImports: 'deepImports',
  layering: 'layering',
  routes: 'routes',
  placement: 'placement',
  staleBaseline: 'staleBaseline',
} as const;
type Kind = (typeof KIND)[keyof typeof KIND];

const SRC = 'apps/mobile/src';
const BASELINE = 'scripts/mobile-structure-baseline.json';
const NONE: readonly Kind[] = [];

type Baseline = {
  deepImports?: Record<string, number>;
  layering?: Record<string, Record<string, number>>;
  routes?: Record<string, number>;
};

/** A fixture: files under `apps/mobile/src`, and the baseline beside them. */
function treeOf(src: Files, baseline: Baseline = {}): Files {
  return {
    ...Object.fromEntries(Object.entries(src).map(([file, text]) => [`${SRC}/${file}`, text])),
    [BASELINE]: `${JSON.stringify({ deepImports: {}, layering: {}, routes: {}, ...baseline })}\n`,
  };
}

const MODULE = 'export const value = 1;\n';
const importing = (...specifiers: string[]): string =>
  `${specifiers.map((specifier) => `import '${specifier}';`).join('\n')}\n${MODULE}`;
/** A route file of exactly `count` lines. */
const route = (count: number): string => `${MODULE}${lines(count - 1)}`;

const LOGGER: Files = { 'lib/logger.ts': MODULE };
const CARD: Files = { 'components/card.tsx': MODULE };

type Case = { name: string; src: Files; baseline?: Baseline; expect: readonly Kind[] };

const RATCHET_CASES: readonly Case[] = [
  {
    name: 'a tree with nothing to report',
    src: { ...LOGGER, 'app/index.tsx': importing('@/lib/logger') },
    expect: NONE,
  },
  {
    name: 'an import climbing three directories',
    src: { ...LOGGER, 'components/a/b/card.tsx': importing('../../../lib/logger') },
    expect: [KIND.deepImports],
  },
  {
    name: 'an import climbing two directories',
    src: { ...LOGGER, 'components/a/card.tsx': importing('../../lib/logger') },
    expect: NONE,
  },
  {
    name: 'utils importing lib',
    src: { ...LOGGER, 'utils/format.ts': importing('@/lib/logger') },
    expect: [KIND.layering],
  },
  {
    name: 'utils importing lib, as the baseline records',
    src: { ...LOGGER, 'utils/format.ts': importing('@/lib/logger') },
    baseline: { layering: { 'utils/format.ts': { 'lib/logger.ts': 1 } } },
    expect: NONE,
  },
  {
    name: 'a hook importing a component',
    src: { ...CARD, 'hooks/use-card.ts': importing('@/components/card') },
    expect: [KIND.layering],
  },
  {
    name: 'a component importing a route',
    src: { 'app/index.tsx': MODULE, 'components/card.tsx': importing('@/app/index') },
    expect: [KIND.layering],
  },
  {
    name: 'a test file importing across layers',
    src: { ...CARD, 'hooks/__tests__/use-card.test.ts': importing('@/components/card') },
    expect: NONE,
  },
  { name: 'a new route at the cap', src: { 'app/index.tsx': route(300) }, expect: NONE },
  { name: 'a new route over the cap', src: { 'app/index.tsx': route(301) }, expect: [KIND.routes] },
  {
    name: 'a baselined route at its recorded size',
    src: { 'app/index.tsx': route(400) },
    baseline: { routes: { 'app/index.tsx': 400 } },
    expect: NONE,
  },
  {
    name: 'a baselined route that grew',
    src: { 'app/index.tsx': route(401) },
    baseline: { routes: { 'app/index.tsx': 400 } },
    expect: [KIND.routes],
  },
];

const STALE_BASELINE_CASES: readonly Case[] = [
  {
    name: 'a baselined route that shrank',
    src: { 'app/index.tsx': route(350) },
    baseline: { routes: { 'app/index.tsx': 400 } },
    expect: [KIND.staleBaseline],
  },
  {
    name: 'a baselined route now within the cap',
    src: { 'app/index.tsx': route(200) },
    baseline: { routes: { 'app/index.tsx': 400 } },
    expect: [KIND.staleBaseline],
  },
  {
    name: 'a baselined route that was deleted',
    src: { ...LOGGER },
    baseline: { routes: { 'app/index.tsx': 400 } },
    expect: [KIND.staleBaseline],
  },
  {
    name: 'a baselined layering edge that was removed',
    src: { ...LOGGER, 'utils/format.ts': MODULE },
    baseline: { layering: { 'utils/format.ts': { 'lib/logger.ts': 1 } } },
    expect: [KIND.staleBaseline],
  },
  {
    name: 'a baselined layering edge whose importer was deleted',
    src: { ...LOGGER },
    baseline: { layering: { 'utils/format.ts': { 'lib/logger.ts': 1 } } },
    expect: [KIND.staleBaseline],
  },
  {
    name: 'fewer deep imports than the baseline allows',
    src: { ...LOGGER, 'components/a/b/card.tsx': importing('../../../lib/logger') },
    baseline: { deepImports: { 'components/a/b/card.tsx': 2 } },
    expect: [KIND.staleBaseline],
  },
  {
    name: 'a baselined route that was renamed',
    src: { 'app/renamed.tsx': route(400) },
    baseline: { routes: { 'app/index.tsx': 400 } },
    expect: [KIND.routes, KIND.staleBaseline],
  },
];

const PLACEMENT_CASES: readonly Case[] = [
  {
    name: 'code in an undeclared top-level directory',
    src: { 'services/sync.ts': MODULE },
    expect: [KIND.placement],
  },
  { name: 'a file directly in src', src: { 'bootstrap.ts': MODULE }, expect: [KIND.placement] },
  {
    name: 'utils reaching components through an undeclared directory',
    src: {
      ...CARD,
      'services/sync.ts': importing('@/components/card'),
      'utils/format.ts': importing('@/services/sync'),
    },
    expect: [KIND.placement],
  },
  {
    name: 'data importing a component',
    src: { ...CARD, 'data/releases.ts': importing('@/components/card') },
    expect: [KIND.layering],
  },
  {
    name: 'a widget importing a feature',
    src: {
      'features/ride/ride.ts': MODULE,
      'widgets/RideWidget.tsx': importing('@/features/ride/ride'),
    },
    expect: [KIND.layering],
  },
  {
    name: 'i18n importing lib, and utils importing i18n',
    src: {
      ...LOGGER,
      'i18n/index.ts': importing('@/lib/logger'),
      'utils/format.ts': importing('@/i18n'),
    },
    expect: NONE,
  },
  {
    name: 'the test-only directories',
    src: {
      ...CARD,
      'test/setup.ts': importing('@/components/card'),
      '__tests__/contract.test.ts': importing('@/components/card'),
    },
    expect: NONE,
  },
  {
    name: 'a declaration file directly in src',
    src: { 'globals.d.ts': 'declare const x: number;\n' },
    expect: NONE,
  },
];

for (const [title, cases] of [
  ['ratchets', RATCHET_CASES],
  ['baseline looser than the tree', STALE_BASELINE_CASES],
  ['closed list of top-level directories', PLACEMENT_CASES],
] as const) {
  describe(`check-mobile-structure: ${title}`, () => {
    for (const { name, src, baseline, expect } of cases) {
      test(`${expect.length > 0 ? 'reports' : 'accepts'}: ${name}`, () => {
        const root = makeTree(treeOf(src, baseline));
        try {
          const violations = violationsIn(root) ?? assert.fail('no baseline was read');
          const kinds = [...new Set(violations.map((violation) => violation.rule))].sort();
          assert.deepEqual(kinds, [...expect].sort(), JSON.stringify(violations, null, 2));
        } finally {
          removeTree(root);
        }
      });
    }
  });
}

describe('check-mobile-structure: messages and --update', () => {
  const ROUTE = 'app/index.tsx';

  test("a renamed baselined route is named in the new route's violation", () => {
    const root = makeTree(treeOf({ 'app/renamed.tsx': route(400) }, { routes: { [ROUTE]: 400 } }));
    try {
      const grown = (violationsIn(root) ?? []).find((violation) => violation.rule === KIND.routes);
      assert.match(grown?.detail ?? '', /app\/index\.tsx renamed, rename that key/);
    } finally {
      removeTree(root);
    }
  });

  test('a route cannot shrink and grow back to its old baseline', () => {
    const root = makeTree(treeOf({ [ROUTE]: route(400) }, { routes: { [ROUTE]: 400 } }));
    const kindsNow = () => [...new Set((violationsIn(root) ?? []).map((v) => v.rule))];
    const recorded = () =>
      (JSON.parse(readFileSync(path.join(root, BASELINE), 'utf8')) as Baseline).routes?.[ROUTE];
    try {
      assert.deepEqual(kindsNow(), []);

      // The clean-up: the guard fails until the baseline is lowered with it.
      writeFiles(root, { [`${SRC}/${ROUTE}`]: route(320) });
      assert.deepEqual(kindsNow(), [KIND.staleBaseline]);
      assert.deepEqual(checkMobileStructure(root, { update: true })?.violations, []);
      assert.equal(recorded(), 320);

      // Growing back to the old size is now a violation.
      writeFiles(root, { [`${SRC}/${ROUTE}`]: route(400) });
      assert.deepEqual(kindsNow(), [KIND.routes]);

      // --update never raises an entry.
      checkMobileStructure(root, { update: true });
      assert.equal(recorded(), 320);
    } finally {
      removeTree(root);
    }
  });

  test('--update drops the entry of a route that is back within the cap', () => {
    const root = makeTree(treeOf({ [ROUTE]: route(200) }, { routes: { [ROUTE]: 400 } }));
    try {
      assert.deepEqual(checkMobileStructure(root, { update: true })?.violations, []);
      assert.deepEqual(JSON.parse(readFileSync(path.join(root, BASELINE), 'utf8')), {
        deepImports: {},
        layering: {},
        routes: {},
      });
    } finally {
      removeTree(root);
    }
  });

  test('a tree with no baseline file has nothing to check against', () => {
    const root = makeTree({ [`${SRC}/${ROUTE}`]: MODULE });
    try {
      assert.equal(violationsIn(root), null);
    } finally {
      removeTree(root);
    }
  });
});
