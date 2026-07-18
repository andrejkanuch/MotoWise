import { createMMKV, useMMKVObject } from 'react-native-mmkv';
import { SAVE_UNDO_TTL_MS } from './scan-flow-constants';

/**
 * Durable "save undo" store (U7d — undo that outlives the toast).
 *
 * `saveReceiptScan` is a compound server-side transaction (task/expense/photo/
 * odometer). After it succeeds we dismiss the scan modal, so the post-save
 * "Saved — Undo" snackbar can no longer live in the flow. This MMKV store is the
 * durable record of the just-saved scan: the global snackbar host reads it to
 * pop the toast, and the entry SURVIVES the toast's timeout so the rider can
 * still undo afterwards (the home priority card in U8 consumes the same store).
 *
 * The server owns the actual rollback (`undoReceiptScanSave`); this store only
 * remembers WHAT to offer undo for and the metadata needed to invalidate caches.
 * Keyed by scanId so re-saving the same scan is idempotent. Entries older than
 * `SAVE_UNDO_TTL_MS` are pruned on read.
 */

const undoStorage = createMMKV({ id: 'receipt-save-undo' });

/** MMKV key holding the undo-entry array. Exported so the hook shares it. */
export const RECEIPT_SAVE_UNDO_KEY = 'receipt.save.undo' as const;

export interface ReceiptSaveUndoEntry {
  scanId: string;
  motorcycleId: string;
  bikeName: string;
  /** RECEIPT_REVIEW_TYPE value — drives which caches undo invalidates + telemetry route. */
  recordType: string;
  savedAt: string;
  /** Free-tier scans left this month (snapshot); null for Pro / hidden. */
  freeScansLeft: number | null;
}

function isFresh(entry: ReceiptSaveUndoEntry): boolean {
  return Date.now() - new Date(entry.savedAt).getTime() < SAVE_UNDO_TTL_MS;
}

function readEntries(): ReceiptSaveUndoEntry[] {
  const raw = undoStorage.getString(RECEIPT_SAVE_UNDO_KEY);
  if (!raw) return [];
  return (JSON.parse(raw) as ReceiptSaveUndoEntry[]).filter(isFresh);
}

function writeEntries(entries: ReceiptSaveUndoEntry[]): void {
  undoStorage.set(RECEIPT_SAVE_UNDO_KEY, JSON.stringify(entries));
}

/** Record a just-saved scan as undoable (idempotent on scanId, most-recent last). */
export function pushReceiptSaveUndo(entry: ReceiptSaveUndoEntry): void {
  const existing = readEntries().filter((e) => e.scanId !== entry.scanId);
  existing.push(entry);
  writeEntries(existing);
}

/** Drop an entry once its save has been undone (or the offer dismissed). */
export function clearReceiptSaveUndo(scanId: string): void {
  writeEntries(readEntries().filter((e) => e.scanId !== scanId));
}

/** Most recent still-fresh undo entry, or null. */
export function getLatestReceiptSaveUndo(): ReceiptSaveUndoEntry | null {
  const entries = readEntries();
  return entries.length > 0 ? entries[entries.length - 1] : null;
}

/**
 * Reactive latest undo entry for the global snackbar host (and U8's home card).
 * Re-renders whenever the store changes from this or any other screen.
 */
export function useLatestReceiptSaveUndo(): ReceiptSaveUndoEntry | null {
  const [entries] = useMMKVObject<ReceiptSaveUndoEntry[]>(RECEIPT_SAVE_UNDO_KEY, undoStorage);
  if (!entries || entries.length === 0) return null;
  const fresh = entries.filter(isFresh);
  return fresh.length > 0 ? fresh[fresh.length - 1] : null;
}
