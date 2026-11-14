import { useEffect } from 'react';
import { ACCOUNT_DRAFT_MODE, useOnboardingStore } from '../../stores/onboarding.store';
import { useCodeStepPending } from './use-code-step-pending';

/** Whether the account step was last left on the email form or the code step. */
export function hasAccountDraft(): boolean {
  return useOnboardingStore.getState().accountDraft !== null;
}

/**
 * Records which part of the account step is open (issue 365 T13a), so a
 * relaunch reopens the email form instead of the sign-in options, and whether
 * a code step is open (`onboarding_resumed.pending_code_step`, T04b). The
 * address itself is kept by `useEmailCodeStep({ persistDraft })` in SecureStore.
 */
export function useAccountDraft(emailMode: boolean, codeStepOpen: boolean) {
  useCodeStepPending(codeStepOpen);
  useEffect(() => {
    const mode = codeStepOpen
      ? ACCOUNT_DRAFT_MODE.CODE
      : emailMode
        ? ACCOUNT_DRAFT_MODE.EMAIL
        : null;
    useOnboardingStore.getState().setAccountDraft(mode ? { mode } : null);
  }, [emailMode, codeStepOpen]);
}
