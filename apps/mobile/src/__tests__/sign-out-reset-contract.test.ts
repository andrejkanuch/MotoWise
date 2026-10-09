/**
 * Structural guard for the root layout's auth listener and the Get Started
 * checklist (#4). The card is owner-keyed: the sign-out branch (manual or
 * forced, `shouldClearLocalData`) must NOT reset it, or a rider who signs out
 * and back in loses it for good (a server-onboarded account never re-runs
 * `initialize`). Instead the session branch calls `claimForUser`, which resets
 * it only when a different account signs in. Rendering the root layout in Jest
 * is impractical (auth, RevenueCat, PostHog, notifications, deep links), so this
 * reads the source; `stores/__tests__/checklist.store.test.ts` drives the store
 * through the same sign-out / sign-in sequences.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const LAYOUT_SOURCE = readFileSync(path.join(__dirname, '..', 'app', '_layout.tsx'), 'utf8');

/** The listener body, from the session branch to the ref update. */
function listenerSource(): { sessionBranch: string; signOutBranch: string } {
  const start = LAYOUT_SOURCE.indexOf('if (sessionUserId) {');
  const elseIdx = LAYOUT_SOURCE.indexOf('} else {', start);
  const end = LAYOUT_SOURCE.indexOf('prevUserIdRef.current = sessionUserId;', elseIdx);
  expect(start).toBeGreaterThan(-1);
  expect(elseIdx).toBeGreaterThan(start);
  expect(end).toBeGreaterThan(elseIdx);
  return {
    sessionBranch: LAYOUT_SOURCE.slice(start, elseIdx),
    signOutBranch: LAYOUT_SOURCE.slice(elseIdx, end),
  };
}

describe('root layout auth listener and the Get Started checklist', () => {
  it('claims the checklist for every observed session user', () => {
    const { sessionBranch } = listenerSource();
    expect(sessionBranch).toContain('useChecklistStore.getState().claimForUser(sessionUserId);');
  });

  it('keeps the checklist on sign-out, including a forced one', () => {
    const { signOutBranch } = listenerSource();
    // The forced path is the same branch: it clears the onboarding run...
    expect(signOutBranch).toContain('useOnboardingStore.getState().resetForSignOut();');
    // ...but never the owner-keyed checklist.
    expect(signOutBranch).not.toMatch(/useChecklistStore\.getState\(\)\.reset\(\)/);
    expect(LAYOUT_SOURCE).not.toMatch(/useChecklistStore\.getState\(\)\.reset\(\)/);
  });
});
