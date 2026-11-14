import { type MotorcycleType, SubmitDiagnosticDocument, type Urgency } from '@motovault/graphql';
import { useQueryClient } from '@tanstack/react-query';
import { File } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useProGate } from '@/hooks/use-pro-gate';
import { AnalyticsEvent, captureException, trackEvent } from '@/lib/analytics';
import { gqlFetcher } from '@/lib/graphql-client';
import { GRAPHQL_ERROR_CODE } from '@/lib/graphql-error-classification';
import { hasGraphQLCode } from '@/lib/graphql-errors';
import { queryKeys } from '@/lib/query-keys';
import { useDiagnosticFlowStore } from '@/stores/diagnostic-flow.store';
import { useSubscriptionStore } from '@/stores/subscription.store';
import { trackDiagnosticFailed } from '../diagnosis/diagnostic-analytics';
import { recordDiagnosisSubmitted } from '../diagnosis/use-diagnostic-quota';

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    // graphql-request ClientError has response.errors[]
    const gqlErrors = (error as { response?: { errors?: { message: string }[] } }).response?.errors;
    if (gqlErrors?.length) return gqlErrors.map((e) => e.message).join('; ');
    if (error instanceof Error) return error.message;
  }
  return 'Failed to analyze';
}

/**
 * Submits the diagnose form. No client-side Pro gate here: the free tier
 * includes one diagnosis a month (FREE_TIER_LIMITS.MAX_AI_DIAGNOSTICS_PER_MONTH,
 * and the store listings say so). The server counts and answers FORBIDDEN once
 * it is used.
 *
 * Issue 365 T08 (FS-PO2a): FORBIDDEN sets the typed `limitReached` state, never
 * `submitError`, and presents the automatic paywall on that one transition. Any
 * later submit of the same form is a no-op until the rider goes Pro, so the
 * "Try Again" → paywall → "Try Again" loop cannot start.
 */
export function useDiagnosticSubmit(): () => Promise<void> {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { requirePro } = useProGate();

  return useCallback(async () => {
    const state = useDiagnosticFlowStore.getState();
    const isPro = useSubscriptionStore.getState().isPro;
    if (state.isSubmitting || !state.hasProblemInput()) return;
    if (state.limitReached && !isPro) return;
    state.setIsSubmitting(true);
    state.setSubmitError(null);
    const submittedAtMs = Date.now();
    trackEvent(AnalyticsEvent.DIAGNOSTIC_SUBMITTED, { has_photo: !!state.photoUri });

    try {
      // Read base64 from photoUri at submission time
      let photoBase64: string | undefined;
      if (state.photoUri) {
        // New expo-file-system File API — readAsStringAsync is documented to throw
        // in a future SDK. Matches the byte-read pattern in lib/image-upload.ts.
        photoBase64 = await new File(state.photoUri).base64();
      }

      // Build wizard answers only if any options were selected
      const symptoms = state.wizardAnswers.symptoms.join(',');
      const location = state.wizardAnswers.location.join(',');
      const timing = state.wizardAnswers.timing.join(',');
      const hasWizardAnswers = symptoms || location || timing;

      const result = await gqlFetcher(SubmitDiagnosticDocument, {
        input: {
          motorcycleId: state.selectedMotorcycleId || undefined,
          photoBase64: photoBase64 || undefined,
          manualBikeInfo: state.manualBikeInfo
            ? { ...state.manualBikeInfo, type: state.manualBikeInfo.type as MotorcycleType }
            : undefined,
          freeTextDescription: state.freeTextDescription?.trim() || undefined,
          additionalNotes: state.additionalNotes?.trim() || undefined,
          urgency: (state.urgency as Urgency) || undefined,
          wizardAnswers: hasWizardAnswers
            ? {
                symptoms: symptoms || undefined,
                location: location || undefined,
                timing: timing || undefined,
              }
            : undefined,
          dataSharingOptedIn: state.dataSharingOptedIn,
          includeMaintenanceHistory: state.includeMaintenanceHistory,
          includeBikeHistory: state.includeMaintenanceHistory,
        },
      });

      trackEvent(AnalyticsEvent.DIAGNOSTIC_COMPLETED, {
        has_photo: !!state.photoUri,
        has_wizard_answers: !!hasWizardAnswers,
      });
      recordDiagnosisSubmitted(queryClient);
      router.replace(`/(diagnose)/${result.submitDiagnostic.id}` as `/${string}`);
    } catch (error: unknown) {
      if (!isPro && hasGraphQLCode(error, GRAPHQL_ERROR_CODE.FORBIDDEN)) {
        // Free monthly diagnosis used: an expected outcome, and the upgrade moment.
        trackEvent(AnalyticsEvent.DIAGNOSTIC_LIMIT_REACHED);
        state.setLimitReached();
        requirePro('full_ai_diagnostics');
        // The quota may never have loaded (the form was reached offline): fetch
        // it now so the limit panel can say when the free diagnosis comes back.
        queryClient.invalidateQueries({ queryKey: queryKeys.diagnostics.quota });
      } else {
        const message = errorMessage(error);
        trackDiagnosticFailed(error, submittedAtMs);
        captureException(error, { source: 'diagnose.submitDiagnostic', message });
        state.setSubmitError(message);
      }
    } finally {
      state.setIsSubmitting(false);
    }
  }, [queryClient, requirePro, router]);
}
