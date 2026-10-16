import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useDiagnosticQuota } from './use-diagnostic-quota';

/** Opens the diagnose flow — or the paywall, once the free diagnosis is used. */
export function useStartDiagnosis(): () => void {
  const router = useRouter();
  const { requireDiagnosticAccess } = useDiagnosticQuota();
  return useCallback(() => {
    if (!requireDiagnosticAccess()) return;
    router.push('/(diagnose)/new');
  }, [requireDiagnosticAccess, router]);
}
