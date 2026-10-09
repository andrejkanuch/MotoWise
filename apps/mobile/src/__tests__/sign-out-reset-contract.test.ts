/**
 * Structural guard: the root layout's sign-out branch must reset the Get
 * Started checklist next to the onboarding run, or the next account on the
 * device inherits the previous rider's card. Rendering the root layout in Jest
 * is impractical (auth, RevenueCat, PostHog, notifications, deep links), so
 * this reads the source; `components/home/__tests__/onboarding-checklist.test.tsx`
 * covers what `reset()` clears.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const LAYOUT_SOURCE = readFileSync(path.join(__dirname, '..', 'app', '_layout.tsx'), 'utf8');

describe('root layout sign-out', () => {
  it('resets the checklist store in the same block as the onboarding run', () => {
    const onboarding = LAYOUT_SOURCE.indexOf('useOnboardingStore.getState().resetForSignOut();');
    const checklist = LAYOUT_SOURCE.indexOf('useChecklistStore.getState().reset();');
    expect(onboarding).toBeGreaterThan(-1);
    expect(checklist).toBeGreaterThan(onboarding);
    // Nothing but comments between the two calls: same branch, same condition.
    const between = LAYOUT_SOURCE.slice(onboarding, checklist).split('\n').slice(1);
    expect(between.every((line) => /^\s*(\/\/.*)?$/.test(line))).toBe(true);
  });
});
