import { palette } from '@motovault/design-system';
import { MyMotorcyclesDocument, UnreviewedReceiptScansDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ReceiptScanFlow } from '../../features/receipt-scan/receipt-scan-flow';
import {
  type ReceiptReviewHandoff,
  type ReceiptReviewPayload,
  SCAN_ENTRY_SURFACE,
  type ScanEntrySurface,
} from '../../features/receipt-scan/scan-flow-constants';
import { useReceiptScanQuota } from '../../features/receipt-scan/use-receipt-scan-quota';
import { useReceiptScanSave } from '../../features/receipt-scan/use-receipt-scan-save';
import { type ScanBike, useScanFlow } from '../../features/receipt-scan/use-scan-flow';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { useAuthStore } from '../../stores/auth.store';

/**
 * Receipt-scan flow modal (U6 + U8 entry wiring). Paywall-before-camera →
 * [bike pick] → consent → capture → upload → analyzing → review, with
 * offline/failure/resume paths.
 *
 * Route params (all optional):
 *  - `motorcycleId`   pre-picks the bike (home / bike-hub / empty-state entries).
 *  - `is_onboarding`  quota-exempt onboarding first scan (KTD-10).
 *  - `resumeScanId`   resume a completed-but-unreviewed scan straight into review
 *                     (U8 home recovery card / U6 parked-scan notification).
 *  - `surface`        entry-point attribution (SCAN_ENTRY_SURFACE).
 */
export default function ScanReceiptScreen() {
  const params = useLocalSearchParams<{
    motorcycleId?: string;
    is_onboarding?: string;
    resumeScanId?: string;
    surface?: string;
  }>();

  const isOnboarding = params.is_onboarding === 'true';
  const surface = toEntrySurface(params.surface);
  const resumeScanId = params.resumeScanId ?? null;

  // Resume: load the completed-but-unreviewed scan and hand it straight to the
  // review card. Only fetched when resuming; the server list is the source of truth.
  const { data: unreviewedData, isLoading: resumeLoading } = useQuery({
    queryKey: queryKeys.receiptScans.unreviewed,
    queryFn: () => gqlFetcher(UnreviewedReceiptScansDocument),
    enabled: !!resumeScanId,
  });

  const resumeHandoff = useMemo<ReceiptReviewHandoff | null>(() => {
    if (!resumeScanId || !unreviewedData) return null;
    const scan = unreviewedData.unreviewedReceiptScans.find((s) => s.scanId === resumeScanId);
    if (!scan?.result) return null;
    return {
      scanId: scan.scanId,
      bikeId: params.motorcycleId ?? '',
      storagePath: scan.storagePath ?? '',
      result: scan.result,
      // The durable local copy is gone on resume — the card degrades to no thumbnail.
      imageUri: null,
    };
  }, [resumeScanId, unreviewedData, params.motorcycleId]);

  // Nothing left to resume (reviewed elsewhere / expired) — close quietly.
  const resumeMissing = !!resumeScanId && !resumeLoading && !resumeHandoff;
  useEffect(() => {
    if (resumeMissing) router.back();
  }, [resumeMissing]);

  if (resumeScanId && !resumeHandoff) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {!resumeMissing && <ActivityIndicator color={palette.signature500} />}
      </View>
    );
  }

  // A stable initialResume is required for the flow's reducer init, so the host
  // that owns useScanFlow is mounted only once the resume (if any) is resolved.
  return (
    <ScanFlowHost
      initialBikeId={params.motorcycleId ?? null}
      isOnboarding={isOnboarding}
      initialResume={resumeHandoff}
      surface={surface}
    />
  );
}

interface ScanFlowHostProps {
  initialBikeId: string | null;
  isOnboarding: boolean;
  initialResume: ReceiptReviewHandoff | null;
  surface: ScanEntrySurface | undefined;
}

function ScanFlowHost({ initialBikeId, isOnboarding, initialResume, surface }: ScanFlowHostProps) {
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
    initialBikeId,
    isOnboarding,
    initialResume,
    entrySurface: surface,
    // Gate only once BOTH quota and the bike list are known, so multi-bike
    // accounts reach the picker and single-bike accounts auto-select correctly.
    quotaLoading: quota.isLoading || bikesLoading,
  });

  // Gate refused entry (paywall shown) — close the modal before any camera work.
  useEffect(() => {
    if (flow.gateRefused) router.back();
  }, [flow.gateRefused]);

  // Real save/undo wiring (U7d). The credit is consumed at extraction, but the
  // quota query isn't refetched until save — so subtract the just-scanned one for
  // an accurate "N left" hint. Pro (and an unresolved quota) hide the hint. The
  // onboarding scan is quota-exempt, so it never shows a "left" hint either.
  const freeScansLeft =
    quota.isPro || isOnboarding || !Number.isFinite(quota.remaining)
      ? null
      : Math.max(0, quota.remaining - 1);
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
  const enterManually = () => {
    const bikeId = flow.state.bikeId ?? initialBikeId ?? '';
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

/** Validate a route-supplied surface against the known set (no magic strings leak in). */
function toEntrySurface(value: string | undefined): ScanEntrySurface | undefined {
  const known = Object.values(SCAN_ENTRY_SURFACE) as string[];
  return value && known.includes(value) ? (value as ScanEntrySurface) : undefined;
}
