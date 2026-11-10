/**
 * Structural guard: the What's New auto-show decision lives in one hook,
 * `features/whats-new/use-whats-new-gate.ts`, which decides through
 * `lib/whats-new` (the semver rule onboarding's `markWhatsNewSeenForNewRider`
 * is written against). The root layout only mounts that hook. Rendering the
 * root layout in Jest is impractical (auth, RevenueCat, PostHog, notifications,
 * deep links, CarPlay), so this reads the sources instead. If the gate moves
 * again, move these assertions with it; do not inline the decision in the
 * layout again.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = path.join(__dirname, '..');
const LAYOUT_SOURCE = readFileSync(path.join(SRC, 'app', '_layout.tsx'), 'utf8');
const GATE_SOURCE = readFileSync(
  path.join(SRC, 'features', 'whats-new', 'use-whats-new-gate.ts'),
  'utf8',
);

const INLINE_VERSION_COMPARISON = /(currentVersion|installedVersion)\s*===\s*lastSeenVersion/;

describe('root layout What’s New gate', () => {
  it('mounts the gate hook', () => {
    expect(LAYOUT_SOURCE).toMatch(
      /import\s*\{\s*useWhatsNewGate\s*\}\s*from\s*'\.\.\/features\/whats-new\/use-whats-new-gate'/,
    );
    expect(LAYOUT_SOURCE).toMatch(/^\s*useWhatsNewGate\(\);\s*$/m);
  });

  it('does not decide anything about What’s New itself', () => {
    expect(LAYOUT_SOURCE).not.toMatch(/\bisWhatsNewOwed\b/);
    expect(LAYOUT_SOURCE).not.toMatch(/\bowedRelease\b/);
    expect(LAYOUT_SOURCE).not.toMatch(/lib\/whats-new'/);
    expect(LAYOUT_SOURCE).not.toMatch(/useWhatsNewStore/);
    expect(LAYOUT_SOURCE).not.toMatch(INLINE_VERSION_COMPARISON);
  });
});

describe('What’s New gate hook', () => {
  it('decides through owedRelease from lib/whats-new', () => {
    expect(GATE_SOURCE).toMatch(
      /import\s*\{[^}]*\bowedRelease\b[^}]*\}\s*from\s*'\.\.\/\.\.\/lib\/whats-new'/,
    );
    expect(GATE_SOURCE).toMatch(/\bowedRelease\(/);
  });

  it('does not compare versions inline', () => {
    expect(GATE_SOURCE).not.toMatch(INLINE_VERSION_COMPARISON);
  });
});
