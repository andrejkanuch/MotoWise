import { DiagnosticQuotaDocument, type DiagnosticQuotaQuery } from '@motovault/graphql';
import { FREE_TIER_LIMITS } from '@motovault/types';
import { type QueryClient, useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useProGate } from '@/hooks/use-pro-gate';
import { gqlFetcher } from '@/lib/graphql-client';
import { queryKeys } from '@/lib/query-keys';
import { QUERY_META } from '@/lib/query-meta';
import { useSubscriptionStore } from '@/stores/subscription.store';

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
  /**
   * Both the server count and RevenueCat's entitlement have loaded. Until then
   * `isPro` reads false for every rider, so nothing may be blocked or shown.
   */
  isKnown: boolean;
  /** ISO 8601 — when the free diagnosis comes back. Null until loaded. */
  resetDate: string | null;
  isLoading: boolean;
  /**
   * Gate for every entry into the diagnose flow. Opens the paywall and returns
   * false once the free diagnosis is used, so a rider is told BEFORE filling in
   * the form, not after submitting it. Optimistic until the quota is known
   * (loading, offline, RevenueCat not hydrated) — the server limit on
   * submitDiagnostic stays the backstop.
   */
  requireDiagnosticAccess: () => boolean;
}

/**
 * AI-diagnosis quota (receipt-scan precedent, KTD-3): `used` is a tier-
 * independent server count; `remaining`/`isExhausted` derive from RevenueCat
 * `isPro`.
 */
export function useDiagnosticQuota(): DiagnosticQuotaState {
  const { isPro, requireAccess } = useProGate();
  const isVerified = useSubscriptionStore((s) => s.isVerified);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.diagnostics.quota,
    queryFn: () => gqlFetcher(DiagnosticQuotaDocument),
    staleTime: 60_000,
    // A failed count hides the note and leaves the gate open (the server limit
    // still holds), so a modal "Error" would only interrupt the rider. Not
    // DECORATION: that tier excludes quota decisions and drops Sentry reporting.
    meta: QUERY_META.OWN_ERROR_UI,
    // Don't hold the in-flow gate through the default retry backoff.
    retry: 1,
  });

  const used = data?.diagnosticQuota.used ?? 0;
  const limit = data?.diagnosticQuota.limit ?? DIAGNOSTIC_LIMIT;
  const remaining = isPro ? Number.POSITIVE_INFINITY : Math.max(0, limit - used);
  const isKnown = isVerified && data !== undefined;

  const requireDiagnosticAccess = useCallback(
    () => !isKnown || requireAccess(DIAGNOSTIC_LIMIT_KEY, used),
    [isKnown, requireAccess, used],
  );

  return {
    remaining,
    limit,
    isExhausted: isKnown && !isPro && remaining <= 0,
    isPro,
    isKnown,
    resetDate: data?.diagnosticQuota.resetDate ?? null,
    isLoading,
    requireDiagnosticAccess,
  };
}

/**
 * After a successful submit. The server logs the generation fire-and-forget,
 * so refetching the count right away can still read the old number and cache
 * it — exactly the stale "1 left" this gate exists to prevent. Count it
 * locally instead; the next refetch (staleTime) reconciles with the server.
 */
export function recordDiagnosisSubmitted(queryClient: QueryClient): void {
  queryClient.setQueryData<DiagnosticQuotaQuery>(queryKeys.diagnostics.quota, (old) =>
    old ? { diagnosticQuota: { ...old.diagnosticQuota, used: old.diagnosticQuota.used + 1 } } : old,
  );
  queryClient.invalidateQueries({
    queryKey: queryKeys.diagnostics.all,
    predicate: (query) => query.queryKey[1] !== queryKeys.diagnostics.quota[1],
  });
}
