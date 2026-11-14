import { DiagnosticQuotaDocument } from '@motovault/graphql';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { DIAGNOSIS_SERVER_WINDOW_MS } from '@/config/diagnosis-submit';
import { TAB_ROUTE } from '@/config/routes';
import { gqlFetcher } from '@/lib/graphql-client';
import { queryKeys } from '@/lib/query-keys';
import { DEADLINE_LOCK_PHASE, useDiagnosticFlowStore } from '@/stores/diagnostic-flow.store';
import { useSubscriptionStore } from '@/stores/subscription.store';

/**
 * Issue 365 T17 (FS-PO2b): after the 75 s client deadline the server may still
 * finish the diagnosis and use the free one. Submit stays locked until the
 * server's window (`DIAGNOSIS_SERVER_WINDOW_MS` from the send) has passed; then
 * the quota is refetched:
 * - not used → the lock lifts and Analyze is back;
 * - used, free rider → T08's limit panel (its Done leads to the list, where the
 *   diagnosis now is);
 * - used, Pro rider → back to the Diagnose list, where the diagnosis now is.
 * A failed refetch leaves the lock on with Retry, which reruns the refetch.
 *
 * Returns that Retry.
 */
export function useDiagnosisDeadlineLock(): () => void {
  const queryClient = useQueryClient();
  const router = useRouter();
  const phase = useDiagnosticFlowStore((s) => s.deadlineLock?.phase);
  const sentAtMs = useDiagnosticFlowStore((s) => s.deadlineLock?.sentAtMs);

  const checkQuota = useCallback(async () => {
    const lock = useDiagnosticFlowStore.getState().deadlineLock;
    if (!lock || lock.phase === DEADLINE_LOCK_PHASE.CHECKING) return;
    useDiagnosticFlowStore
      .getState()
      .setDeadlineLock({ ...lock, phase: DEADLINE_LOCK_PHASE.CHECKING });

    try {
      const data = await gqlFetcher(DiagnosticQuotaDocument);
      const { used, limit } = data.diagnosticQuota;
      // The limit state goes in before the cache: the entry gate must not read
      // a newly used quota as a reason to present its own paywall.
      const isPro = useSubscriptionStore.getState().isPro;
      const recorded = lock.usedAtSend !== null ? used > lock.usedAtSend : !isPro && used >= limit;
      const store = useDiagnosticFlowStore.getState();
      store.setDeadlineLock(null);
      if (recorded && !isPro) store.setLimitReached();
      queryClient.setQueryData(queryKeys.diagnostics.quota, data);
      if (!recorded) return;
      queryClient.invalidateQueries({
        queryKey: queryKeys.diagnostics.all,
        predicate: (query) => query.queryKey[1] !== queryKeys.diagnostics.quota[1],
      });
      if (isPro) {
        store.reset();
        router.dismissTo(TAB_ROUTE.DIAGNOSE);
      }
    } catch {
      useDiagnosticFlowStore
        .getState()
        .setDeadlineLock({ ...lock, phase: DEADLINE_LOCK_PHASE.CHECK_FAILED });
    }
  }, [queryClient, router]);

  useEffect(() => {
    if (phase !== DEADLINE_LOCK_PHASE.WAITING || sentAtMs === undefined) return;
    const timer = setTimeout(
      () => void checkQuota(),
      Math.max(0, sentAtMs + DIAGNOSIS_SERVER_WINDOW_MS - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [phase, sentAtMs, checkQuota]);

  return checkQuota;
}
