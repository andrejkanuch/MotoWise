import { ScanReceiptDocument } from '@motovault/graphql';
import * as Network from 'expo-network';
import { createMMKV } from 'react-native-mmkv';
import { AnalyticsEvent, captureException, trackEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { uploadReceiptPhoto } from '../../lib/image-upload';
import { logger } from '../../lib/logger';
import { isNetworkError } from '../../lib/network-error';
import { scheduleParkedScanReminder } from '../../lib/notifications';
import { queryClient } from '../../lib/query-client';
import { queryKeys } from '../../lib/query-keys';
import { useAuthStore } from '../../stores/auth.store';
import { deleteDurablePhoto, getDurablePhotoUri } from './durable-receipt-photo';
import { parkScan } from './parked-scan-store';
import { SCAN_ERROR_CODE, SCAN_RESUME_SOURCE } from './scan-flow-constants';

/**
 * Durable offline queue for receipt scans captured without connectivity (R3).
 *
 * Mirrors `utils/ride-sync-queue.ts`: an MMKV-backed list that survives an app
 * kill. When a scan is captured offline we copy its photo into the durable
 * document directory (see `durable-receipt-photo.ts`) and enqueue a record here.
 * On reconnect/launch we drain: upload the photo, then run the single
 * `scanReceipt` extraction. On success the scan becomes an unreviewed/parked
 * scan (home card + notification). **No credit is consumed until extraction
 * succeeds** — the whole pipeline is deferred, not just the upload.
 */

interface PendingScan {
  scanId: string;
  bikeId: string;
  userId: string;
  bikeName: string;
  retries: number;
  createdAt: string;
}

const scanStorage = createMMKV({ id: 'receipt-scan-queue' });
const QUEUE_KEY = 'receipt-scan.queue';
const MAX_RETRIES = 5;

function isValidPendingScan(value: unknown): value is PendingScan {
  if (typeof value !== 'object' || value === null) return false;
  const scan = value as Record<string, unknown>;
  return typeof scan.scanId === 'string' && typeof scan.userId === 'string';
}

function getQueue(): PendingScan[] {
  const raw = scanStorage.getString(QUEUE_KEY);
  if (!raw) return [];
  // Tolerate malformed / migration-incompatible JSON rather than throwing on the
  // launch/reconnect drain path — treat unreadable data as empty and reset it.
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      scanStorage.remove(QUEUE_KEY);
      return [];
    }
    return parsed.filter(isValidPendingScan);
  } catch {
    scanStorage.remove(QUEUE_KEY);
    return [];
  }
}

function setQueue(queue: PendingScan[]): void {
  scanStorage.set(QUEUE_KEY, JSON.stringify(queue));
}

function removeFromQueue(scanId: string): void {
  setQueue(getQueue().filter((s) => s.scanId !== scanId));
}

function bumpRetry(scanId: string): void {
  setQueue(getQueue().map((s) => (s.scanId === scanId ? { ...s, retries: s.retries + 1 } : s)));
}

/** True when there is at least one deferred scan waiting to upload. */
export function getPendingScanCount(): number {
  return getQueue().length;
}

/**
 * Durably enqueue an offline-captured scan. The caller MUST have already copied
 * the photo into the durable directory (via `persistDurablePhoto`).
 */
export function enqueuePendingScan(record: {
  scanId: string;
  bikeId: string;
  userId: string;
  bikeName: string;
}): void {
  const queue = getQueue().filter((s) => s.scanId !== record.scanId);
  queue.push({ ...record, retries: 0, createdAt: new Date().toISOString() });
  setQueue(queue);
}

let isDraining = false;

/**
 * Upload + extract every pending scan. Safe to call on launch, on reconnect, and
 * when the scan modal mounts — single-flight guarded, and each scan is processed
 * independently (unlike rides, scans have no inter-op ordering constraint).
 */
export async function drainPendingScans(): Promise<void> {
  if (isDraining) return;
  isDraining = true;
  try {
    let networkState: Network.NetworkState;
    try {
      networkState = await Network.getNetworkStateAsync();
    } catch {
      return;
    }
    if (!networkState.isConnected || !networkState.isInternetReachable) return;

    // Scope draining to the authenticated owner. The queue can hold records from a
    // previous account on a shared device; only the current session may upload +
    // extract its own scans (the server rejects cross-owner ops anyway, but that
    // would burn retries and eventually delete another user's record). Records for
    // other users are left untouched until that user signs back in. Before auth
    // hydration there is no active user, so we skip the drain entirely.
    const activeUserId = useAuthStore.getState().session?.user?.id ?? null;
    if (!activeUserId) return;

    for (const pending of getQueue()) {
      if (pending.userId !== activeUserId) continue;
      await processPending(pending);
    }
  } finally {
    isDraining = false;
  }
}

async function processPending(pending: PendingScan): Promise<void> {
  const durableUri = getDurablePhotoUri(pending.scanId);
  if (!durableUri) {
    // The photo was purged/deleted — nothing to upload. Drop the orphan record.
    removeFromQueue(pending.scanId);
    return;
  }

  try {
    await uploadReceiptPhoto(durableUri, pending.userId, pending.scanId);
    const data = await gqlFetcher(ScanReceiptDocument, { scanId: pending.scanId });

    if (data.scanReceipt.__typename === 'ReceiptScanSuccess') {
      const { scanId, result } = data.scanReceipt;
      parkScan({
        scanId,
        bikeId: pending.bikeId,
        storagePath: `${pending.userId}/${scanId}.webp`,
        result,
        // The durable local copy backs the review-card receipt thumbnail pre-save.
        imageUri: durableUri,
      });
      await scheduleParkedScanReminder(scanId, pending.bikeName, result.vendor);
      queryClient.invalidateQueries({ queryKey: queryKeys.receiptScans.unreviewed });
      queryClient.invalidateQueries({ queryKey: queryKeys.receiptScans.quota });
      // R8: a stranded offline scan was recovered by the queue drain (launch /
      // reconnect) and is now a reviewable parked scan — the cold-launch graveyard
      // recovery arm of the resume funnel, distinct from the card/notification taps.
      trackEvent(AnalyticsEvent.RECEIPT_SCAN_RESUMED, { source: SCAN_RESUME_SOURCE.LAUNCH });
      finalize(pending.scanId);
      return;
    }

    // Server union error. QUOTA_EXCEEDED / EXTRACTION_FAILED / IMAGE_INVALID /
    // DISABLED are all terminal for a background retry (no user in the loop to
    // salvage), so drop the record and reclaim the photo. Nothing charged unless
    // extraction succeeded, which this branch is not.
    handleTerminalServerError(pending, data.scanReceipt.code);
  } catch (error) {
    if (isNetworkError(error)) {
      // Connectivity dropped mid-drain — leave the record for the next trigger.
      return;
    }
    const nextRetries = pending.retries + 1;
    if (nextRetries >= MAX_RETRIES) {
      captureException(error instanceof Error ? error : new Error('receipt-scan drain failed'), {
        source: 'receipt-scan-queue.processPending',
        scanId: pending.scanId,
        retries: String(nextRetries),
      });
      finalize(pending.scanId);
    } else {
      bumpRetry(pending.scanId);
    }
  }
}

function handleTerminalServerError(pending: PendingScan, code: string): void {
  if (code !== SCAN_ERROR_CODE.SCAN_QUOTA_EXCEEDED) {
    logger.warn(`receipt-scan: deferred scan ${pending.scanId} failed server-side (${code})`);
  }
  finalize(pending.scanId);
}

/** Remove the record and reclaim its durable photo. */
function finalize(scanId: string): void {
  removeFromQueue(scanId);
  deleteDurablePhoto(scanId);
}

let reconnectSub: ReturnType<typeof Network.addNetworkStateListener> | null = null;

/**
 * Register a reconnect listener that drains the queue when connectivity returns,
 * and drain once immediately for anything left over from a previous session.
 * Idempotent — safe to call from the root layout on launch.
 */
export function initReceiptScanQueue(): void {
  if (!reconnectSub) {
    reconnectSub = Network.addNetworkStateListener((state) => {
      if (state.isConnected && state.isInternetReachable) {
        void drainPendingScans();
      }
    });
  }
  void drainPendingScans();
}
