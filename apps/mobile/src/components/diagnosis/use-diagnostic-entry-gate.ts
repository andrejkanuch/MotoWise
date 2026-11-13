import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { DIAGNOSTIC_ENTRY, DIAGNOSTIC_ENTRY_PARAM } from '@/config/diagnostic-entry';
import { presentPaywall } from '@/lib/subscription';
import { useSubscriptionStore } from '@/stores/subscription.store';
import { parseDiagnosticEntry, trackDiagnosticStarted } from './diagnostic-analytics';
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
 *
 * It also counts `diagnostic_started` for those paths: once per mount, as soon
 * as the rider may use the form (optimistic while the quota is unknown, like
 * `requireDiagnosticAccess`; after an unlock when it is used up). A form opened
 * by `useStartDiagnosis` carries its `entry` param and was counted there.
 */
export function useDiagnosticEntryGate(onBlocked: () => void): void {
  const quota = useDiagnosticQuota();
  const checkedRef = useRef(false);
  const inAppEntry = parseDiagnosticEntry(useLocalSearchParams()[DIAGNOSTIC_ENTRY_PARAM]);
  const startCountedRef = useRef(
    inAppEntry !== undefined && inAppEntry !== DIAGNOSTIC_ENTRY.QUICK_ACTION,
  );
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
    if (startCountedRef.current || quota.isExhausted) return;
    startCountedRef.current = true;
    trackDiagnosticStarted(DIAGNOSTIC_ENTRY.QUICK_ACTION);
  });
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
