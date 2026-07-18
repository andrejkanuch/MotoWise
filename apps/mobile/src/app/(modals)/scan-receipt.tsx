import { MyMotorcyclesDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ReceiptScanFlow } from '../../features/receipt-scan/receipt-scan-flow';
import { useReceiptScanQuota } from '../../features/receipt-scan/use-receipt-scan-quota';
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

  const enterManually = () => {
    const bikeId = flow.state.bikeId ?? params.motorcycleId ?? '';
    trackEvent(AnalyticsEvent.RECEIPT_SCAN_MANUAL_FALLBACK, { phase: flow.state.phase });
    router.replace({
      pathname: '/(tabs)/(garage)/add-expense',
      params: bikeId ? { motorcycleId: bikeId } : {},
    } as Href);
  };

  return (
    <ReceiptScanFlow flow={flow} onManualEntry={enterManually} onClose={() => router.back()} />
  );
}
