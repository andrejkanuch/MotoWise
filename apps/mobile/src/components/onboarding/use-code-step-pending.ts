import { useEffect } from 'react';
import { useOnboardingStore } from '../../stores/onboarding.store';

/**
 * Records on the onboarding run whether an email code step is open, so
 * `onboarding_resumed` can report a code step lost to a kill as
 * `pending_code_step` (issue 365 T04b). The next step's focus clears it.
 */
export function useCodeStepPending(open: boolean) {
  useEffect(() => {
    useOnboardingStore.getState().setCodeStepPending(open);
  }, [open]);
}
