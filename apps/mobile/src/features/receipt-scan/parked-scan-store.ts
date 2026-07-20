import { createMMKV, useMMKVObject } from 'react-native-mmkv';
import type { ReceiptReviewHandoff } from './scan-flow-constants';

/**
 * Durable "parked scans" store (R3 review-later + resume).
 *
 * When a rider parks a successfully-extracted scan for later, we persist it here
 * so the home priority card has a GUARANTEED recovery surface even if the
 * next-day notification is denied or missed. The card reads this store; the
 * server-side `unreviewedReceiptScans` query is the cross-device source of truth,
 * but this local store makes the count available instantly and offline.
 *
 * Keyed by scanId so re-parking the same scan is idempotent.
 */

const parkedStorage = createMMKV({ id: 'receipt-parked-scans' });

/** MMKV key holding the parked-scan array. Exported so the hook shares it. */
export const PARKED_SCANS_KEY = 'parked.scans';

export interface ParkedScan {
  scanId: string;
  bikeId: string;
  storagePath: string;
  /** Vendor/amount snapshot so the card can render without re-fetching. */
  vendor: string | null;
  amount: number | null;
  parkedAt: string;
}

function isValidParkedScan(value: unknown): value is ParkedScan {
  if (typeof value !== 'object' || value === null) return false;
  const scan = value as Record<string, unknown>;
  return typeof scan.scanId === 'string' && typeof scan.storagePath === 'string';
}

function readParked(): ParkedScan[] {
  const raw = parkedStorage.getString(PARKED_SCANS_KEY);
  if (!raw) return [];
  // Tolerate malformed / migration-incompatible JSON: a corrupt value must not
  // crash the home recovery UI. Treat unreadable data as empty and reset it.
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      parkedStorage.remove(PARKED_SCANS_KEY);
      return [];
    }
    return parsed.filter(isValidParkedScan);
  } catch {
    parkedStorage.remove(PARKED_SCANS_KEY);
    return [];
  }
}

function writeParked(scans: ParkedScan[]): void {
  parkedStorage.set(PARKED_SCANS_KEY, JSON.stringify(scans));
}

/** Park a scan for later review (idempotent on scanId). */
export function parkScan(handoff: ReceiptReviewHandoff): void {
  const existing = readParked().filter((s) => s.scanId !== handoff.scanId);
  existing.push({
    scanId: handoff.scanId,
    bikeId: handoff.bikeId,
    storagePath: handoff.storagePath,
    vendor: handoff.result.vendor ?? null,
    amount: handoff.result.amount ?? null,
    parkedAt: new Date().toISOString(),
  });
  writeParked(existing);
}

/** Remove a parked scan once it has been reviewed/saved or dismissed. */
export function unparkScan(scanId: string): void {
  writeParked(readParked().filter((s) => s.scanId !== scanId));
}

export function getParkedScans(): ParkedScan[] {
  return readParked();
}

/**
 * Wipe all parked scans. Called from the auth logout / account-switch cleanup so
 * one account never surfaces another's parked scans on a shared device. Safe to
 * clear: the server `unreviewedReceiptScans` query is the cross-device source of
 * truth and repopulates the home card for the next signed-in account.
 */
export function clearParkedScans(): void {
  parkedStorage.remove(PARKED_SCANS_KEY);
}

/**
 * Reactive parked-scan count for the home priority card (U8). Re-renders when the
 * store changes on this or another screen.
 */
export function useParkedScanCount(): number {
  const [scans] = useMMKVObject<ParkedScan[]>(PARKED_SCANS_KEY, parkedStorage);
  return scans?.length ?? 0;
}
