import { MyMotorcyclesDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { ReceiptScanFlow } from '../../features/receipt-scan/receipt-scan-flow';
import type { ReceiptReviewPayload } from '../../features/receipt-scan/scan-flow-constants';
import { useReceiptScanQuota } from '../../features/receipt-scan/use-receipt-scan-quota';
import { useReceiptScanSave } from '../../features/receipt-scan/use-receipt-scan-save';
import { type ScanBike, useScanFlow } from '../../features/receipt-scan/use-scan-flow';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { useAuthStore } from '../../stores/auth.store';

/**
 * Receipt-scan flow modal (U6). Paywall-before-camera → [bike pick] → consent →
 * capture → upload → analyzing → review, with offline/failure/resume paths.
 *
 * The screen owns navigation escapes (manual entry, close); the phase machine and
 * all scan side effects live in `useScanFlow`.
 */
export default function ScanReceiptScreen() {
  const params = useLocalSearchParams<{ motorcycleId?: string }>();
  const userId = useAuthStore((s) => s.session?.user?.id) ?? null;

  const { data: bikesData, isLoading: bikesLoading } = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });
  const bikes: ScanBike[] = (bikesData?.myMotorcycles ?? []).map((b) => ({
    id: b.id,
    name: b.nickname?.trim() || `${b.make} ${b.model}`,
  }));

  const quota = useReceiptScanQuota();

  const flow = useScanFlow({
    userId,
    bikes,
    initialBikeId: params.motorcycleId ?? null,
    // Gate only once BOTH quota and the bike list are known, so multi-bike
    // accounts reach the picker and single-bike accounts auto-select correctly.
    quotaLoading: quota.isLoading || bikesLoading,
  });

  // Gate refused entry (paywall shown) — close the modal before any camera work.
  useEffect(() => {
    if (flow.gateRefused) router.back();
  }, [flow.gateRefused]);

  // Real save/undo wiring (U7d). The review card hands us a confirmed payload; the
  // hook runs the duplicate soft-warn, the saveReceiptScan transaction, cache
  // invalidation, the durable undo entry + snackbar, and the flow-duration event.
  // The credit is consumed at extraction, but the quota query isn't refetched until
  // save — so subtract the just-scanned one for an accurate "N left" hint. Pro (and
  // an unresolved quota) hide the hint entirely.
  const freeScansLeft =
    quota.isPro || !Number.isFinite(quota.remaining) ? null : Math.max(0, quota.remaining - 1);
  const { save } = useReceiptScanSave({
    bikeName: flow.bikeName,
    freeScansLeft,
    scanStartedAt: flow.scanStartedAt,
    onSaved: () => router.back(),
  });
  const onSave = useCallback(
    (payload: ReceiptReviewPayload) => {
      const handoff = flow.state.handoff;
      if (!handoff) return;
      void save(handoff, payload);
    },
    [save, flow.state.handoff],
  );

  // Manual fallback + partial-salvage: carry whatever extraction produced (and the
  // captured photo) into add-expense so a failed/partial scan is never a dead end.
  // No extra credit is consumed — the failed path is free and any success already
  // consumed exactly one at extraction.
  const enterManually = () => {
    const bikeId = flow.state.bikeId ?? params.motorcycleId ?? '';
    const salvage = flow.state.handoff?.result ?? null;
    const photoUri = flow.state.handoff?.imageUri ?? flow.state.photoUri ?? undefined;
    trackEvent(AnalyticsEvent.RECEIPT_SCAN_MANUAL_FALLBACK, { phase: flow.state.phase });
    router.replace({
      pathname: '/(tabs)/(garage)/add-expense',
      params: {
        ...(bikeId ? { motorcycleId: bikeId } : {}),
        ...(salvage?.amount != null ? { amount: String(salvage.amount) } : {}),
        ...(salvage?.category ? { category: salvage.category } : {}),
        ...(salvage?.date ? { date: salvage.date } : {}),
        ...(salvage?.vendor ? { description: salvage.vendor } : {}),
        ...(salvage?.itemName ? { itemName: salvage.itemName } : {}),
        ...(photoUri ? { photoUri } : {}),
      },
    } as Href);
  };

  return (
    <ReceiptScanFlow
      flow={flow}
      onManualEntry={enterManually}
      onClose={() => router.back()}
      onSave={onSave}
    />
  );
}
