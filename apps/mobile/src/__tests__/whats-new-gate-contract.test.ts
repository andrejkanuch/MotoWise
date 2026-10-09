/**
 * Structural guard: the root layout's What's New trigger must decide through
 * `isWhatsNewOwed`, the rule onboarding's `markWhatsNewSeenForNewRider` is
 * written against (`lib/__tests__/whats-new.test.ts`). Rendering the root
 * layout in Jest is impractical (auth, RevenueCat, PostHog, notifications,
 * deep links, CarPlay), so this reads the source instead — the same approach as
 * the web app's 404 contract test. If it fails because the gate moved, move the
 * assertion with it; do not inline the version comparison again.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const LAYOUT_SOURCE = readFileSync(path.join(__dirname, '..', 'app', '_layout.tsx'), 'utf8');

describe('root layout What’s New gate', () => {
  it('imports isWhatsNewOwed from lib/whats-new', () => {
    expect(LAYOUT_SOURCE).toMatch(
      /import\s*\{[^}]*\bisWhatsNewOwed\b[^}]*\}\s*from\s*'\.\.\/lib\/whats-new'/,
    );
  });

  it('returns early unless isWhatsNewOwed says the stored version is owed', () => {
    expect(LAYOUT_SOURCE).toMatch(
      /!isWhatsNewOwed\(currentVersion,\s*lastSeenVersion\)\)\s*return;/,
    );
  });

  it('does not compare versions inline', () => {
    expect(LAYOUT_SOURCE).not.toMatch(/currentVersion\s*===\s*lastSeenVersion/);
    expect(LAYOUT_SOURCE).not.toMatch(/getWhatsNewRelease\(/);
  });
});
