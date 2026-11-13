import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { DIAGNOSTIC_ENTRY_PARAM, type DiagnosticEntry } from '@/config/diagnostic-entry';
import { trackDiagnosticStarted } from './diagnostic-analytics';
import { useDiagnosticQuota } from './use-diagnostic-quota';

/**
 * Opens the diagnose flow — or the paywall, once the free diagnosis is used.
 * Counts `diagnostic_started` here, once per tap that opens the form, and hands
 * the entry to the form so its entry gate does not count it again.
 */
export function useStartDiagnosis(entry: DiagnosticEntry): () => void {
  const router = useRouter();
  const { requireDiagnosticAccess } = useDiagnosticQuota();
  return useCallback(() => {
    if (!requireDiagnosticAccess()) return;
    trackDiagnosticStarted(entry);
    router.push({ pathname: '/(diagnose)/new', params: { [DIAGNOSTIC_ENTRY_PARAM]: entry } });
  }, [entry, requireDiagnosticAccess, router]);
}
