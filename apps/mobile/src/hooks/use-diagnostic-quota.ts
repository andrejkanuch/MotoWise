import { DiagnosticQuotaDocument } from '@motovault/graphql';
import { FREE_TIER_LIMITS } from '@motovault/types';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { gqlFetcher } from '../lib/graphql-client';
import { queryKeys } from '../lib/query-keys';
import { useProGate } from './use-pro-gate';

/** The `FREE_TIER_LIMITS` key for AI diagnoses, fed to `requireAccess`. */
export const DIAGNOSTIC_LIMIT_KEY = 'MAX_AI_DIAGNOSTICS_PER_MONTH' as const;

/** Client fallback limit; the server's `diagnosticQuota.limit` is authoritative. */
const DIAGNOSTIC_LIMIT = FREE_TIER_LIMITS[DIAGNOSTIC_LIMIT_KEY];

export interface DiagnosticQuotaState {
  /** Free users: diagnoses left this month. Pro: Infinity. */
  remaining: number;
  limit: number;
  isExhausted: boolean;
  isPro: boolean;
  /** ISO 8601 — when the free diagnosis comes back. Null until loaded. */
  resetDate: string | null;
  isLoading: boolean;
  /**
   * Gate for every entry into the diagnose flow. Opens the paywall and returns
   * false once the free diagnosis is used, so a rider is told BEFORE filling in
   * the form, not after submitting it. Optimistic while loading or offline —
   * the server limit on submitDiagnostic stays the backstop.
   */
  requireDiagnosticAccess: () => boolean;
}

/**
 * AI-diagnosis quota (receipt-scan precedent, KTD-3): `used` is a tier-
 * independent server count; `remaining`/`isExhausted` derive from RevenueCat
 * `isPro`. The query key lives under `diagnostics`, so the post-submit
 * invalidation of `queryKeys.diagnostics.all` refreshes it too.
 */
export function useDiagnosticQuota(): DiagnosticQuotaState {
  const { isPro, requireAccess } = useProGate();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.diagnostics.quota,
    queryFn: () => gqlFetcher(DiagnosticQuotaDocument),
    staleTime: 60_000,
  });

  const used = data?.diagnosticQuota.used ?? 0;
  const limit = data?.diagnosticQuota.limit ?? DIAGNOSTIC_LIMIT;
  const remaining = isPro ? Number.POSITIVE_INFINITY : Math.max(0, limit - used);

  const requireDiagnosticAccess = useCallback(
    () => requireAccess(DIAGNOSTIC_LIMIT_KEY, used),
    [requireAccess, used],
  );

  return {
    remaining,
    limit,
    isExhausted: !isPro && remaining <= 0,
    isPro,
    resetDate: data?.diagnosticQuota.resetDate ?? null,
    isLoading,
    requireDiagnosticAccess,
  };
}

/** Opens the diagnose flow — or the paywall, once the free diagnosis is used. */
export function useStartDiagnosis(): () => void {
  const router = useRouter();
  const { requireDiagnosticAccess } = useDiagnosticQuota();
  return useCallback(() => {
    if (!requireDiagnosticAccess()) return;
    router.push('/(diagnose)/new');
  }, [requireDiagnosticAccess, router]);
}

/**
 * Entry gate inside the flow, for paths that skip useStartDiagnosis (the iOS
 * quick action). Evaluated once, on the first loaded quota value: the
 * post-submit refetch must not pop the paywall over a diagnosis that just
 * succeeded.
 */
export function useDiagnosticEntryGate(onBlocked: () => void): void {
  const quota = useDiagnosticQuota();
  const checkedRef = useRef(false);
  useEffect(() => {
    if (checkedRef.current || quota.isLoading) return;
    checkedRef.current = true;
    if (!quota.requireDiagnosticAccess()) onBlocked();
  });
}
