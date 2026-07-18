import { ReceiptScanQuotaDocument } from '@motovault/graphql';
import { FREE_TIER_LIMITS } from '@motovault/types';
import { useQuery } from '@tanstack/react-query';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { useSubscriptionStore } from '../../stores/subscription.store';

/**
 * The `FREE_TIER_LIMITS` key for receipt scans — the single string fed to
 * `requireAccess`/`checkAccess` so the paywall opens with the `unlimited_scans`
 * feature (featureMap in use-pro-gate). Exported so entry points don't inline it.
 */
export const RECEIPT_SCAN_LIMIT_KEY = 'MAX_RECEIPT_SCANS_PER_MONTH' as const;

/** Client fallback limit; the server's `receiptScanQuota.limit` is authoritative. */
const SCAN_LIMIT = FREE_TIER_LIMITS[RECEIPT_SCAN_LIMIT_KEY];

export interface ReceiptScanQuotaState {
  used: number;
  limit: number;
  /** Free users: whole scans left this month. Pro: Infinity. */
  remaining: number;
  isExhausted: boolean;
  isPro: boolean;
  resetDate: string | null;
  isLoading: boolean;
}

/**
 * Receipt-scan quota for the client paywall gate (KTD-3).
 *
 * `used` is a tier-INDEPENDENT server count (client-side monthly counting would
 * drift), while `remaining`/`isExhausted` are derived here from RevenueCat `isPro`
 * — so the paywall fires at launch even though the server forces everyone to `pro`
 * while `ENTITLEMENTS_ENFORCED=false`. Feed `used` into
 * `requireAccess('MAX_RECEIPT_SCANS_PER_MONTH', used)`.
 */
export function useReceiptScanQuota(): ReceiptScanQuotaState {
  const isPro = useSubscriptionStore((s) => s.isPro);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.receiptScans.quota,
    queryFn: () => gqlFetcher(ReceiptScanQuotaDocument),
    // The count only moves when the user scans; keep it warm across screens.
    staleTime: 60_000,
  });

  const used = data?.receiptScanQuota.used ?? 0;
  const limit = data?.receiptScanQuota.limit ?? SCAN_LIMIT;
  const remaining = isPro ? Number.POSITIVE_INFINITY : Math.max(0, limit - used);

  return {
    used,
    limit,
    remaining,
    isExhausted: !isPro && remaining <= 0,
    isPro,
    resetDate: data?.receiptScanQuota.resetDate ?? null,
    isLoading,
  };
}
