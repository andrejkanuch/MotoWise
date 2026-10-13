import type { CompleteOnboardingInput } from '@motovault/graphql';
import { FEEDBACK_CONTACT_WORDING_VERSION } from '@motovault/types';
import i18n from '@/i18n';
import { useOnboardingStore } from '@/stores/onboarding.store';

/**
 * The `completeOnboarding` field for the notifications step's contact line:
 * present only when the rider ticked it, with the wording version and locale
 * of the text they saw. Defaults read the onboarding store and the app locale.
 */
export function onboardingFeedbackContactInput(
  optedIn: boolean = useOnboardingStore.getState().feedbackContactOptIn,
  locale: string = i18n.resolvedLanguage ?? i18n.language,
): Pick<CompleteOnboardingInput, 'feedbackContactOptIn'> {
  return optedIn
    ? { feedbackContactOptIn: { wordingVersion: FEEDBACK_CONTACT_WORDING_VERSION, locale } }
    : {};
}
