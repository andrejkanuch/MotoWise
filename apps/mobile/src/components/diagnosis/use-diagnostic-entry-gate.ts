import { useEffect, useRef } from 'react';
import { presentPaywall } from '@/lib/subscription';
import { useSubscriptionStore } from '@/stores/subscription.store';
import { useDiagnosticQuota } from './use-diagnostic-quota';

const DIAGNOSTIC_PAYWALL = {
  source: 'feature_gate',
  feature: 'full_ai_diagnostics',
  placement: 'feature_gate',
  surface: 'diagnose_entry_gate',
} as const;

/**
 * Entry gate inside the flow, for paths that skip useStartDiagnosis (the iOS
 * quick action). Evaluated once, on the first KNOWN quota: the post-submit
 * count change must not pop the paywall over a diagnosis that just succeeded.
 *
 * The flow is a fullScreenModal, and on iOS dismissing a modal also dismisses
 * what it presented — so the paywall goes up OVER the form, and the form only
 * closes once the paywall does (and stays if the rider just went Pro).
 */
export function useDiagnosticEntryGate(onBlocked: () => void): void {
  const quota = useDiagnosticQuota();
  const checkedRef = useRef(false);
  // The rider can close the form while offerings load: then neither present
  // the paywall nor navigate back — "back" from the list would leave the tab.
  const unmountedRef = useRef(false);
  useEffect(
    () => () => {
      unmountedRef.current = true;
    },
    [],
  );
  useEffect(() => {
    if (checkedRef.current || !quota.isKnown) return;
    checkedRef.current = true;
    if (!quota.isExhausted) return;
    presentPaywall({ ...DIAGNOSTIC_PAYWALL, shouldAbort: () => unmountedRef.current }).then(
      (result) => {
        if (unmountedRef.current) return;
        const unlocked =
          result === 'purchased' || result === 'restored' || useSubscriptionStore.getState().isPro;
        if (!unlocked) onBlocked();
      },
    );
  });
}
