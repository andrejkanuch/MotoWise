/** Route groups the consent screen may open over — never a ride or other modal. */
const CONSENT_PROMPT_GROUPS: ReadonlySet<string> = new Set(['(tabs)', '(onboarding)', '(auth)']);

/**
 * True on a route the analytics consent screen may open over: a screen in
 * tabs, onboarding or sign-in, except the onboarding welcome screen (the
 * prompt comes right after it). Never over a ride or another modal.
 */
export function canShowConsentPrompt(segments: readonly string[]): boolean {
  const [group, screen] = segments;
  if (!group || !CONSENT_PROMPT_GROUPS.has(group)) return false;
  return !(group === '(onboarding)' && (!screen || screen === 'index'));
}
