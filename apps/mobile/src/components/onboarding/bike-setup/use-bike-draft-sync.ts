import { useEffect } from 'react';
import { useOnboardingStore } from '@/stores/onboarding.store';
import { bikeDraftOf } from './bike-draft';

/**
 * Writes the bike-setup search to the onboarding store whenever it changes
 * (issue 365 T13b); null once the make is cleared. The step starts from the
 * stored draft, so the first write repeats it. Completing the step clears the
 * draft without changing the search, so nothing writes it back.
 */
export function useBikeDraftSync(state: Parameters<typeof bikeDraftOf>[0]): void {
  const draft = bikeDraftOf(state);
  const setBikeDraft = useOnboardingStore((s) => s.setBikeDraft);
  const present = draft !== null;
  const makeId = draft?.makeId ?? null;
  const make = draft?.make ?? null;
  const modelQuery = draft?.modelQuery ?? '';
  const year = draft?.year ?? null;

  useEffect(() => {
    setBikeDraft(present ? { makeId, make, modelQuery, year } : null);
  }, [present, makeId, make, modelQuery, year, setBikeDraft]);
}
