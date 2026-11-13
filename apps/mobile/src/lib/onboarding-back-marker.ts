// Issue 365 T04b: the on-screen Back chevron marks itself right before it pops,
// so the `beforeRemove` that follows reports `trigger: button` instead of
// `hardware`. Its own module with no imports, so screens can mark a press
// without loading the onboarding store (lib/onboarding-nav-analytics.ts reads it).

/** A press claims the back action that follows it within this window. */
const BUTTON_BACK_WINDOW_MS = 1000;

let buttonBackAt: number | null = null;

/** Call right before an on-screen Back navigates. */
export function markOnboardingButtonBack(now = Date.now()) {
  buttonBackAt = now;
}

/** True if a press was marked within the window. Clears the mark either way. */
export function consumeOnboardingButtonBack(now = Date.now()): boolean {
  const marked = buttonBackAt !== null && now - buttonBackAt <= BUTTON_BACK_WINDOW_MS;
  buttonBackAt = null;
  return marked;
}
