import {
  CancelReceiptScanDocument,
  ScanReceiptDocument,
  type ScanReceiptMutation,
} from '@motovault/graphql';
import * as Crypto from 'expo-crypto';
import * as Network from 'expo-network';
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { useProGate } from '../../hooks/use-pro-gate';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { pickImage, takePhoto, uploadReceiptPhoto } from '../../lib/image-upload';
import { isNetworkError } from '../../lib/network-error';
import { scheduleParkedScanReminder } from '../../lib/notifications';
import { queryClient } from '../../lib/query-client';
import { queryKeys } from '../../lib/query-keys';
import { deleteDurablePhoto, persistDurablePhoto } from './durable-receipt-photo';
import { parkScan } from './parked-scan-store';
import { enqueuePendingScan } from './receipt-scan-queue';
import {
  ANALYZE_ERROR_OUTCOME,
  type ErrorOutcome,
  LOCAL_ERROR_OUTCOME,
  type ReceiptReviewHandoff,
  resolveErrorOutcome,
  SCAN_ERROR_CODE,
  SCAN_PHASE,
  type ScanPhase,
  SKIP_AFFORDANCE_DELAY_MS,
  UPLOAD_TIMEOUT_MS,
} from './scan-flow-constants';
import { hasAcceptedScanConsent, setScanConsentAccepted } from './scan-preferences';
import { useReceiptScanQuota } from './use-receipt-scan-quota';

export interface ScanBike {
  id: string;
  name: string;
}

interface ScanFlowState {
  phase: ScanPhase;
  bikeId: string | null;
  /** Cache URI of the current captured photo (retained across salvageable errors). */
  photoUri: string | null;
  handoff: ReceiptReviewHandoff | null;
  error: ErrorOutcome | null;
  uploadAttempt: number;
  /** Analyzing: whether the "Skip — enter manually" affordance is visible. */
  skipVisible: boolean;
  /** Analyzing/skip: cancel request in flight (disables the skip button). */
  cancelling: boolean;
}

type Action =
  | { type: 'GATE_TO'; phase: ScanPhase }
  | { type: 'BIKE_SELECTED'; bikeId: string; phase: ScanPhase }
  | { type: 'GO_CAPTURE' }
  | { type: 'PHOTO_CAPTURED'; photoUri: string }
  | { type: 'UPLOAD_STARTED' }
  | { type: 'ANALYZE_STARTED' }
  | { type: 'SKIP_SHOWN' }
  | { type: 'CANCELLING' }
  | { type: 'QUEUED_OFFLINE' }
  | { type: 'SUCCEEDED'; handoff: ReceiptReviewHandoff }
  | { type: 'ALREADY_PROCESSED'; handoff: ReceiptReviewHandoff | null }
  | { type: 'PARKED' }
  | { type: 'FAILED'; error: ErrorOutcome };

const INITIAL: ScanFlowState = {
  phase: SCAN_PHASE.GATING,
  bikeId: null,
  photoUri: null,
  handoff: null,
  error: null,
  uploadAttempt: 0,
  skipVisible: false,
  cancelling: false,
};

function reducer(state: ScanFlowState, action: Action): ScanFlowState {
  switch (action.type) {
    case 'GATE_TO':
      return { ...state, phase: action.phase };
    case 'BIKE_SELECTED':
      return { ...state, bikeId: action.bikeId, phase: action.phase };
    case 'GO_CAPTURE':
      return { ...state, phase: SCAN_PHASE.CAPTURE, error: null };
    case 'PHOTO_CAPTURED':
      return { ...state, photoUri: action.photoUri };
    case 'UPLOAD_STARTED':
      return {
        ...state,
        phase: SCAN_PHASE.UPLOADING,
        error: null,
        uploadAttempt: state.uploadAttempt + 1,
      };
    case 'ANALYZE_STARTED':
      return { ...state, phase: SCAN_PHASE.ANALYZING, skipVisible: false, cancelling: false };
    case 'SKIP_SHOWN':
      return { ...state, skipVisible: true };
    case 'CANCELLING':
      return { ...state, cancelling: true };
    case 'QUEUED_OFFLINE':
      return { ...state, phase: SCAN_PHASE.OFFLINE_QUEUED };
    case 'SUCCEEDED':
      return { ...state, phase: SCAN_PHASE.REVIEW, handoff: action.handoff, error: null };
    case 'ALREADY_PROCESSED':
      return { ...state, phase: SCAN_PHASE.ALREADY_PROCESSED, handoff: action.handoff };
    case 'PARKED':
      return { ...state, phase: SCAN_PHASE.PARKED };
    case 'FAILED':
      return { ...state, phase: SCAN_PHASE.ERROR, error: action.error };
    default:
      return state;
  }
}

type ScanResolved =
  | { kind: 'result'; data: ScanReceiptMutation }
  | { kind: 'thrown'; error: unknown };

interface UseScanFlowParams {
  userId: string | null;
  bikes: ScanBike[];
  /** Provided bike from an entry point (skips the picker). */
  initialBikeId?: string | null;
  /** Whether the quota query is still loading (gate waits for it). */
  quotaLoading: boolean;
}

export interface ScanFlow {
  state: ScanFlowState;
  bikes: ScanBike[];
  bikeName: string;
  selectBike: (bikeId: string) => void;
  acceptConsent: () => void;
  captureFromCamera: () => Promise<void>;
  captureFromLibrary: () => Promise<void>;
  retryUpload: () => Promise<void>;
  retryAnalyze: () => Promise<void>;
  requestSkip: () => Promise<void>;
  parkForLater: () => Promise<void>;
  /** From ALREADY_PROCESSED with a result in hand — open the review card now. */
  reviewNow: () => void;
  /** True when the gate refused entry (paywall shown) — the screen should close. */
  gateRefused: boolean;
}

/**
 * Receipt-scan flow controller (U6). A single reducer drives the finite phase
 * machine; async intents perform side effects and dispatch transitions. The
 * scanReceipt/cancelReceiptScan race (KTD-4) is resolved here deterministically:
 * once the rider taps skip, the CANCEL response is authoritative for routing.
 */
export function useScanFlow(params: UseScanFlowParams): ScanFlow {
  const { userId, bikes, initialBikeId, quotaLoading } = params;
  const { requireAccess } = useProGate();
  const quota = useReceiptScanQuota();
  const [state, dispatch] = useReducer(reducer, {
    ...INITIAL,
    bikeId: initialBikeId ?? (bikes.length === 1 ? bikes[0].id : null),
  });

  // The client-generated UUID identifying this scan across upload + extraction.
  const scanIdRef = useRef<string>(Crypto.randomUUID());
  // Records the scanReceipt outcome so the cancel handler can route on it.
  const scanResolvedRef = useRef<ScanResolved | null>(null);
  const cancelRequestedRef = useRef(false);
  const gateRefusedRef = useRef(false);
  // Latest bikeId/userId reachable from long-lived async closures.
  const bikeIdRef = useRef(state.bikeId);
  const userIdRef = useRef(userId);
  // The captured photo uri, reachable from the long-lived scan closures so the
  // review-card handoff can show the local image before the bucket is signed.
  const photoUriRef = useRef(state.photoUri);
  useEffect(() => {
    photoUriRef.current = state.photoUri;
  }, [state.photoUri]);
  useEffect(() => {
    bikeIdRef.current = state.bikeId;
  }, [state.bikeId]);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const bikeName = useMemo(
    () => bikes.find((b) => b.id === state.bikeId)?.name ?? '',
    [bikes, state.bikeId],
  );
  const bikeNameRef = useRef(bikeName);
  useEffect(() => {
    bikeNameRef.current = bikeName;
  }, [bikeName]);

  // --- Route a resolved scanReceipt outcome (shared by analyze + cancel arms). ---
  const routeResolved = useCallback(
    (resolved: ScanResolved, bikeId: string | null) => {
      if (resolved.kind === 'thrown') {
        dispatch({ type: 'FAILED', error: ANALYZE_ERROR_OUTCOME });
        return;
      }
      const union = resolved.data.scanReceipt;
      if (union.__typename === 'ReceiptScanSuccess') {
        dispatch({
          type: 'SUCCEEDED',
          handoff: {
            scanId: union.scanId,
            bikeId: bikeId ?? '',
            storagePath: storagePathFor(userIdRef.current, union.scanId),
            result: union.result,
            imageUri: photoUriRef.current,
          },
        });
        trackEvent(AnalyticsEvent.RECEIPT_SCAN_COMPLETED, { outcome: 'success' });
        return;
      }
      const outcome = resolveErrorOutcome(union.code);
      if (outcome.recovery === 'paywall') {
        // Post-upload quota rejection (stale cache / second device). Photo retained.
        requireAccess('MAX_RECEIPT_SCANS_PER_MONTH', quota.used);
      }
      dispatch({ type: 'FAILED', error: outcome });
      trackEvent(AnalyticsEvent.RECEIPT_SCAN_COMPLETED, { outcome: union.code });
    },
    [requireAccess, quota.used],
  );

  const beginAnalyze = useCallback(async () => {
    cancelRequestedRef.current = false;
    scanResolvedRef.current = null;
    dispatch({ type: 'ANALYZE_STARTED' });

    const skipTimer = setTimeout(() => dispatch({ type: 'SKIP_SHOWN' }), SKIP_AFFORDANCE_DELAY_MS);
    try {
      const data = await gqlFetcher(ScanReceiptDocument, { scanId: scanIdRef.current });
      scanResolvedRef.current = { kind: 'result', data };
      if (cancelRequestedRef.current) return; // cancel handler is authoritative
      routeResolved(scanResolvedRef.current, bikeIdRef.current);
    } catch (error) {
      scanResolvedRef.current = { kind: 'thrown', error };
      if (cancelRequestedRef.current) return;
      routeResolved(scanResolvedRef.current, bikeIdRef.current);
    } finally {
      clearTimeout(skipTimer);
    }
  }, [routeResolved]);

  const beginUpload = useCallback(
    async (photoUri: string) => {
      const uid = userIdRef.current;
      if (!uid) return;
      dispatch({ type: 'UPLOAD_STARTED' });

      const enqueueOffline = () => {
        // Copy the cache photo somewhere durable BEFORE persisting the record, then
        // defer the whole pipeline. No credit until extraction succeeds on reconnect.
        persistDurablePhoto(photoUri, scanIdRef.current);
        enqueuePendingScan({
          scanId: scanIdRef.current,
          bikeId: bikeIdRef.current ?? '',
          userId: uid,
          bikeName: bikeNameRef.current,
        });
        dispatch({ type: 'QUEUED_OFFLINE' });
      };

      let net: Network.NetworkState | null = null;
      try {
        net = await Network.getNetworkStateAsync();
      } catch {
        net = null;
      }
      if (net && (!net.isConnected || !net.isInternetReachable)) {
        enqueueOffline();
        return;
      }

      try {
        await withTimeout(uploadReceiptPhoto(photoUri, uid, scanIdRef.current), UPLOAD_TIMEOUT_MS);
        void beginAnalyze();
      } catch (error) {
        if (isNetworkError(error)) {
          enqueueOffline();
          return;
        }
        // Timeout or other upload error — no scanReceipt yet, so no reservation.
        dispatch({ type: 'FAILED', error: LOCAL_ERROR_OUTCOME });
      }
    },
    [beginAnalyze],
  );

  const capture = useCallback(
    async (source: 'camera' | 'library') => {
      const uri = source === 'camera' ? await takePhoto() : await pickImage();
      if (!uri) return; // permission denied / cancelled — screen offers fallbacks
      dispatch({ type: 'PHOTO_CAPTURED', photoUri: uri });
      await beginUpload(uri);
    },
    [beginUpload],
  );

  const captureFromCamera = useCallback(() => capture('camera'), [capture]);
  const captureFromLibrary = useCallback(() => capture('library'), [capture]);

  const retryUpload = useCallback(async () => {
    if (!state.photoUri) return;
    await beginUpload(state.photoUri);
  }, [state.photoUri, beginUpload]);

  const retryAnalyze = useCallback(async () => {
    await beginAnalyze();
  }, [beginAnalyze]);

  const selectBike = useCallback((bikeId: string) => {
    dispatch({
      type: 'BIKE_SELECTED',
      bikeId,
      phase: hasAcceptedScanConsent() ? SCAN_PHASE.CAPTURE : SCAN_PHASE.CONSENT,
    });
  }, []);

  const acceptConsent = useCallback(() => {
    setScanConsentAccepted();
    dispatch({ type: 'GO_CAPTURE' });
  }, []);

  // --- Skip / cancel race (KTD-4) — BOTH arms handled ---
  const requestSkip = useCallback(async () => {
    cancelRequestedRef.current = true;
    dispatch({ type: 'CANCELLING' });
    const bikeId = bikeIdRef.current;

    const fallbackToScan = () => {
      const resolved = scanResolvedRef.current;
      if (resolved) {
        routeResolved(resolved, bikeId);
        return;
      }
      // Scan hasn't resolved yet — re-arm so its pending promise routes on arrival.
      cancelRequestedRef.current = false;
    };

    try {
      const res = await gqlFetcher(CancelReceiptScanDocument, { scanId: scanIdRef.current });
      const union = res.cancelReceiptScan;

      if (union.__typename === 'CancelReceiptScanSuccess') {
        // Cancel WON the CAS: nothing reserved/consumed. No parsed fields exist
        // client-side, so manual entry starts blank with bike context.
        trackEvent(AnalyticsEvent.RECEIPT_SCAN_COMPLETED, { outcome: 'cancelled' });
        dispatch({ type: 'FAILED', error: { ...LOCAL_ERROR_OUTCOME, recovery: 'manual' } });
        return;
      }

      if (union.code === SCAN_ERROR_CODE.ALREADY_COMPLETED) {
        // Finalizer WON: the credit was consumed and the scan is now an unreviewed
        // scan. If the success result already arrived we can offer review; either
        // way it also surfaces via unreviewedReceiptScans + the home card.
        queryClient.invalidateQueries({ queryKey: queryKeys.receiptScans.unreviewed });
        queryClient.invalidateQueries({ queryKey: queryKeys.receiptScans.quota });
        const resolved = scanResolvedRef.current;
        const handoff =
          resolved?.kind === 'result' &&
          resolved.data.scanReceipt.__typename === 'ReceiptScanSuccess'
            ? {
                scanId: resolved.data.scanReceipt.scanId,
                bikeId: bikeId ?? '',
                storagePath: storagePathFor(userIdRef.current, resolved.data.scanReceipt.scanId),
                result: resolved.data.scanReceipt.result,
                imageUri: photoUriRef.current,
              }
            : null;
        trackEvent(AnalyticsEvent.RECEIPT_SCAN_COMPLETED, { outcome: 'already_completed' });
        dispatch({ type: 'ALREADY_PROCESSED', handoff });
        return;
      }

      // Any other cancel error → fall back to whatever the scan itself decided.
      fallbackToScan();
    } catch {
      // Cancel couldn't be delivered (network or otherwise) — defer to the scan
      // result, which is idempotent server-side.
      cancelRequestedRef.current = false;
      fallbackToScan();
    }
  }, [routeResolved]);

  const reviewNow = useCallback(() => {
    if (state.handoff) dispatch({ type: 'SUCCEEDED', handoff: state.handoff });
  }, [state.handoff]);

  // --- Review-later parking ---
  const parkForLater = useCallback(async () => {
    if (!state.handoff) return;
    parkScan(state.handoff);
    await scheduleParkedScanReminder(state.handoff.scanId, bikeName, state.handoff.result.vendor);
    queryClient.invalidateQueries({ queryKey: queryKeys.receiptScans.unreviewed });
    trackEvent(AnalyticsEvent.RECEIPT_SCAN_PARKED, {});
    dispatch({ type: 'PARKED' });
  }, [state.handoff, bikeName]);

  // --- Gate-before-camera (KTD-3). Runs once quota is known. ---
  // biome-ignore lint/correctness/useExhaustiveDependencies: one-shot gate keyed on quota load, not a reactive effect
  useEffect(() => {
    if (gateRefusedRef.current || quotaLoading || state.phase !== SCAN_PHASE.GATING) return;

    // requireAccess presents the paywall as a side effect and returns false when
    // the free monthly scan count is exhausted — we STOP before the camera.
    if (!requireAccess('MAX_RECEIPT_SCANS_PER_MONTH', quota.used)) {
      gateRefusedRef.current = true;
      trackEvent(AnalyticsEvent.PAYWALL_PRESENT_REQUESTED, { surface: 'receipt_scan_gate' });
      return;
    }

    trackEvent(AnalyticsEvent.RECEIPT_SCAN_STARTED, { bike_count: bikes.length });

    const afterPick = hasAcceptedScanConsent() ? SCAN_PHASE.CAPTURE : SCAN_PHASE.CONSENT;
    // Auto-select the only bike so capture/upload always carries bike context;
    // multi-bike accounts with no pre-picked bike go to the picker first.
    if (!state.bikeId && bikes.length === 1) {
      dispatch({ type: 'BIKE_SELECTED', bikeId: bikes[0].id, phase: afterPick });
      return;
    }
    dispatch({ type: 'GATE_TO', phase: nextPhaseAfterGate(bikes, state.bikeId) });
  }, [quotaLoading]);

  // Reclaim the durable photo once a terminal success surface unmounts — deferred/
  // offline scans keep theirs (they still need to upload); interactive ones are
  // already uploaded server-side.
  // biome-ignore lint/correctness/useExhaustiveDependencies: cleanup reads the final phase via closure at unmount only
  useEffect(() => {
    return () => {
      if (
        state.phase === SCAN_PHASE.REVIEW ||
        state.phase === SCAN_PHASE.PARKED ||
        state.phase === SCAN_PHASE.ALREADY_PROCESSED
      ) {
        deleteDurablePhoto(scanIdRef.current);
      }
    };
  }, []);

  return {
    state,
    bikes,
    bikeName,
    selectBike,
    acceptConsent,
    captureFromCamera,
    captureFromLibrary,
    retryUpload,
    retryAnalyze,
    requestSkip,
    parkForLater,
    reviewNow,
    gateRefused: gateRefusedRef.current,
  };
}

// --- pure helpers ---

function nextPhaseAfterGate(bikes: ScanBike[], selectedBikeId: string | null): ScanPhase {
  if (!selectedBikeId && bikes.length > 1) return SCAN_PHASE.BIKE_PICK;
  return hasAcceptedScanConsent() ? SCAN_PHASE.CAPTURE : SCAN_PHASE.CONSENT;
}

/** The server derives the same `{uid}/{scanId}.webp` path; storagePath mirrors it. */
function storagePathFor(userId: string | null, scanId: string): string {
  return `${userId ?? ''}/${scanId}.webp`;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}
