import {
  type DiagnosticQuotaQuery,
  type MotorcycleType,
  SubmitDiagnosticDocument,
  type Urgency,
} from '@motovault/graphql';
import { useQueryClient } from '@tanstack/react-query';
import { File } from 'expo-file-system';
import * as Network from 'expo-network';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useProGate } from '@/hooks/use-pro-gate';
import { AnalyticsEvent, captureException, trackEvent } from '@/lib/analytics';
import { gqlFetcher } from '@/lib/graphql-client';
import { GRAPHQL_ERROR_CODE } from '@/lib/graphql-error-classification';
import { hasGraphQLCode } from '@/lib/graphql-errors';
import { queryKeys } from '@/lib/query-keys';
import {
  DEADLINE_LOCK_PHASE,
  SUBMIT_FAILURE,
  type SubmitFailure,
  useDiagnosticFlowStore,
} from '@/stores/diagnostic-flow.store';
import { useSubscriptionStore } from '@/stores/subscription.store';
import {
  classifyDiagnosticFailure,
  DIAGNOSTIC_FAILURE_REASON,
  type DiagnosticFailureReason,
  trackDiagnosticFailed,
  trackDiagnosticOfflinePrecheck,
} from '../diagnosis/diagnostic-analytics';
import { recordDiagnosisSubmitted } from '../diagnosis/use-diagnostic-quota';

/**
 * Issue 365 T17: the failure class → the copy the review step shows. A timeout
 * has no entry: it locks submit (`deadlineLock`) instead of offering Try Again.
 */
const FAILURE_COPY: Record<
  Exclude<DiagnosticFailureReason, typeof DIAGNOSTIC_FAILURE_REASON.TIMEOUT>,
  SubmitFailure
> = {
  [DIAGNOSTIC_FAILURE_REASON.OFFLINE]: SUBMIT_FAILURE.OFFLINE,
  [DIAGNOSTIC_FAILURE_REASON.THROTTLED]: SUBMIT_FAILURE.THROTTLED,
  [DIAGNOSTIC_FAILURE_REASON.LIMIT]: SUBMIT_FAILURE.SERVER,
  [DIAGNOSTIC_FAILURE_REASON.SERVER]: SUBMIT_FAILURE.SERVER,
};

/**
 * Only a definite "no connection" blocks the send: `isInternetReachable` can be
 * null/undefined while the OS is still deciding, and a failed read of the
 * state sends anyway (the request then fails as it would have).
 */
async function isDefinitelyOffline(): Promise<boolean> {
  try {
    const net = await Network.getNetworkStateAsync();
    return net.isConnected === false || net.isInternetReachable === false;
  } catch {
    return false;
  }
}

/**
 * Submits the diagnose form. No client-side Pro gate here: the free tier
 * includes one diagnosis a month (FREE_TIER_LIMITS.MAX_AI_DIAGNOSTICS_PER_MONTH,
 * and the store listings say so). The server counts and answers FORBIDDEN once
 * it is used.
 *
 * Issue 365 T08 (FS-PO2a): FORBIDDEN sets the typed `limitReached` state, never
 * `submitFailure`, and presents the automatic paywall on that one transition. Any
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
    if (state.isSubmitting || !state.hasProblemInput() || state.deadlineLock) return;
    if (state.limitReached && !isPro) return;
    state.setIsSubmitting(true);
    state.setSubmitFailure(null);

    // Issue 365 T17: offline → send nothing (7 of 14 failures were offline).
    // The answers stay in the store for the next try.
    if (await isDefinitelyOffline()) {
      trackDiagnosticOfflinePrecheck();
      state.setSubmitFailure(SUBMIT_FAILURE.OFFLINE);
      state.setIsSubmitting(false);
      return;
    }

    const submittedAtMs = Date.now();
    const usedAtSend =
      queryClient.getQueryData<DiagnosticQuotaQuery>(queryKeys.diagnostics.quota)?.diagnosticQuota
        .used ?? null;
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
        trackDiagnosticFailed(error, submittedAtMs);
        const reason = classifyDiagnosticFailure(error);
        if (reason === DIAGNOSTIC_FAILURE_REASON.TIMEOUT) {
          // The server may still finish (and use the free diagnosis): lock
          // submit until its window has passed, then ask the quota.
          state.setDeadlineLock({
            phase: DEADLINE_LOCK_PHASE.WAITING,
            sentAtMs: submittedAtMs,
            usedAtSend,
          });
        } else {
          state.setSubmitFailure(FAILURE_COPY[reason]);
        }
        captureException(error, { source: 'diagnose.submitDiagnostic', reason });
      }
    } finally {
      state.setIsSubmitting(false);
    }
  }, [queryClient, requirePro, router]);
}
