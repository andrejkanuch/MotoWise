import {
  CreateServiceReminderDocument,
  ExpensesByMotorcycleDocument,
  type ExpensesByMotorcycleQuery,
  type MaintenanceServiceType,
  SaveReceiptScanDocument,
  type SaveReceiptScanInput,
  type SaveReceiptScanMutation,
  UndoReceiptScanSaveDocument,
} from '@motovault/graphql';
import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import type { TFunction } from 'i18next';
import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { AnalyticsEvent, captureException, trackEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryClient } from '../../lib/query-client';
import { queryKeys } from '../../lib/query-keys';
import { triggerNotification } from '../../utils/haptics';
import { deleteDurablePhoto } from './durable-receipt-photo';
import { unparkScan } from './parked-scan-store';
import {
  clearReceiptSaveUndo,
  pushReceiptSaveUndo,
  type ReceiptSaveUndoEntry,
} from './receipt-scan-undo-store';
import {
  DUPLICATE_AMOUNT_EPSILON,
  RECEIPT_REVIEW_TYPE,
  type ReceiptReviewHandoff,
  type ReceiptReviewPayload,
} from './scan-flow-constants';

/**
 * Save / undo wiring for the review card (U7d).
 *
 * The review card hands a confirmed `ReceiptReviewPayload` to `onSave`; this hook
 * turns it into the real `saveReceiptScan` mutation, dispatches on the union
 * result (`SaveReceiptScanSuccess | ReceiptScanError`), invalidates the caches the
 * created record feeds, writes a durable undo entry that outlives the toast, and
 * fires the flow-duration telemetry. A pre-save duplicate soft-warn runs first and
 * NEVER blocks. The compound rollback itself is server-side — undo just calls
 * `undoReceiptScanSave` and refreshes the same keys.
 */

// --- pure mappers / helpers --------------------------------------------------

/** `ReceiptReviewPayload` (nullable) → `SaveReceiptScanInput` (optional). */
function toSaveInput(payload: ReceiptReviewPayload): SaveReceiptScanInput {
  // Tax + line items are maintenance-only structure; the expense path ignores
  // them, so don't send them for an expense save.
  const isMaintenance = payload.type === RECEIPT_REVIEW_TYPE.MAINTENANCE;
  const lineItems =
    isMaintenance && payload.lineItems.length > 0
      ? payload.lineItems.map((li) => ({
          label: li.label,
          serviceType: li.serviceType ?? undefined,
          partRef: li.partRef ?? undefined,
          quantity: li.quantity ?? undefined,
          unitPrice: li.unitPrice ?? undefined,
          lineTotal: li.lineTotal ?? undefined,
        }))
      : undefined;
  return {
    motorcycleId: payload.motorcycleId,
    type: payload.type,
    amount: payload.amount ?? undefined,
    currency: payload.currency ?? undefined,
    date: payload.date ?? undefined,
    vendor: payload.vendor ?? undefined,
    itemName: payload.itemName ?? undefined,
    category: payload.category ?? undefined,
    partsCost: payload.partsCost ?? undefined,
    laborCost: payload.laborCost ?? undefined,
    taxAmount: isMaintenance ? (payload.taxAmount ?? undefined) : undefined,
    taxRate: isMaintenance ? (payload.taxRate ?? undefined) : undefined,
    lineItems,
    applyOdometer: payload.applyOdometer,
    odometerValue: payload.odometerValue ?? undefined,
    odometerUnit: payload.odometerUnit ?? undefined,
  };
}

function isSameCalendarDay(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

/**
 * Refresh every list the saved record (or its undo) can appear in. Maintenance
 * completed-with-cost also spawns a linked expense (U3), so expenses are always
 * refreshed. Odometer writes move `currentMileage`, so the bike list is too.
 */
function invalidateForRecord(recordType: string, motorcycleId: string, odometerTouched: boolean) {
  queryClient.invalidateQueries({ queryKey: queryKeys.receiptScans.quota });
  queryClient.invalidateQueries({ queryKey: queryKeys.receiptScans.unreviewed });
  queryClient.invalidateQueries({ queryKey: queryKeys.expenses.byMotorcycle(motorcycleId) });
  if (recordType === RECEIPT_REVIEW_TYPE.MAINTENANCE) {
    queryClient.invalidateQueries({
      queryKey: queryKeys.maintenanceTasks.byMotorcycle(motorcycleId),
    });
    queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceTasks.history(motorcycleId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceTasks.spending(motorcycleId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceTasks.allUser });
  }
  if (odometerTouched) {
    queryClient.invalidateQueries({ queryKey: queryKeys.motorcycles.all });
  }
}

/**
 * Pre-save duplicate soft-warn: an expense on the same bike with the same amount
 * + calendar day (+ vendor substring when present). Reads the year-0 expense list
 * (same cache key the bike hub warms). Fail-open — a query error never blocks Save.
 */
async function isLikelyDuplicate(payload: ReceiptReviewPayload): Promise<boolean> {
  if (payload.amount == null || !payload.date) return false;
  const data = await queryClient.fetchQuery<ExpensesByMotorcycleQuery>({
    queryKey: [...queryKeys.expenses.byMotorcycle(payload.motorcycleId), 0],
    queryFn: () =>
      gqlFetcher(ExpensesByMotorcycleDocument, { motorcycleId: payload.motorcycleId, year: 0 }),
    staleTime: 30_000,
  });
  const vendorNeedle = payload.vendor?.trim().toLowerCase();
  const target = payload.amount;
  const targetDate = payload.date;
  return data.expenses.categories
    .flatMap((c) => c.expenses)
    .some((e) => {
      if (Math.abs(e.amount - target) > DUPLICATE_AMOUNT_EPSILON) return false;
      if (!isSameCalendarDay(e.date, targetDate)) return false;
      if (vendorNeedle) return (e.description ?? '').toLowerCase().includes(vendorNeedle);
      return true;
    });
}

/** Non-blocking soft-warn dialog. Resolves true to proceed, false to keep editing. */
function confirmDuplicate(t: TFunction): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      t('receiptScan.saved.duplicateTitle'),
      t('receiptScan.saved.duplicateBody'),
      [
        {
          text: t('receiptScan.saved.duplicateCancel'),
          style: 'cancel',
          onPress: () => resolve(false),
        },
        { text: t('receiptScan.saved.duplicateConfirm'), onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

// --- save hook ---------------------------------------------------------------

export interface UseReceiptScanSaveParams {
  bikeName: string;
  /** Free-tier scans left this month (snapshot); null for Pro. */
  freeScansLeft: number | null;
  /** Flow-start timestamp (ms) for the <20s Goal-1 measurement; null if unknown. */
  scanStartedAt: number | null;
  /** Called after a successful save so the caller can dismiss the modal. */
  onSaved: () => void;
}

export function useReceiptScanSave(params: UseReceiptScanSaveParams) {
  const { t } = useTranslation();
  const { bikeName, freeScansLeft, scanStartedAt, onSaved } = params;

  const saveMutation = useMutation({
    mutationFn: (vars: { scanId: string; input: SaveReceiptScanInput }) =>
      gqlFetcher(SaveReceiptScanDocument, vars),
  });

  // Guards against a double-tap saving twice — the whole flow (duplicate Alert +
  // mutation) is longer than the button is disabled, so a ref covers all of it.
  const inFlightRef = useRef(false);

  const save = useCallback(
    async (handoff: ReceiptReviewHandoff, payload: ReceiptReviewPayload) => {
      if (inFlightRef.current) return; // double-tap guard
      inFlightRef.current = true;
      try {
        // Duplicate soft-warn — always dismissible, never a hard block.
        const duplicate = await isLikelyDuplicate(payload).catch(() => false);
        if (duplicate && !(await confirmDuplicate(t))) return; // keep the card open

        let data: SaveReceiptScanMutation;
        try {
          data = await saveMutation.mutateAsync({
            scanId: handoff.scanId,
            input: toSaveInput(payload),
          });
        } catch (err) {
          captureException(err, { source: 'receipt-scan.save' });
          Alert.alert(t('receiptScan.saved.saveFailed'), t('receiptScan.saved.saveFailedBody'));
          return;
        }

        const result = data.saveReceiptScan;
        // ReceiptScanError arm — surface the reason, keep the card open.
        if (result.__typename !== 'SaveReceiptScanSuccess') {
          Alert.alert(t('receiptScan.saved.saveFailed'), result.reason);
          return;
        }

        // SaveReceiptScanSuccess arm.
        const recordType = result.refs.recordType || payload.type;
        const odometerTouched = result.refs.odometer != null;
        invalidateForRecord(recordType, payload.motorcycleId, odometerTouched);

        // P7: user-confirmed next-service reminders. Best-effort and non-blocking —
        // the record is already saved, so a reminder failure must never surface as a
        // save failure. Each creates a fresh recurring pending task server-side.
        if (payload.reminderServiceTypes.length > 0) {
          await Promise.allSettled(
            payload.reminderServiceTypes.map((serviceType) =>
              gqlFetcher(CreateServiceReminderDocument, {
                // Reminder types originate from the canonical taxonomy (review card),
                // so they are valid MaintenanceServiceType members.
                input: {
                  motorcycleId: payload.motorcycleId,
                  serviceType: serviceType as MaintenanceServiceType,
                },
              }),
            ),
          );
          // The new reminders are pending maintenance tasks — refresh the same keys.
          invalidateForRecord(RECEIPT_REVIEW_TYPE.MAINTENANCE, payload.motorcycleId, false);
        }

        // Local artifacts are now redundant — the record lives server-side.
        unparkScan(handoff.scanId);
        deleteDurablePhoto(handoff.scanId);

        // Durable undo entry — outlives the toast (U8's home card reads the same store).
        pushReceiptSaveUndo({
          scanId: handoff.scanId,
          motorcycleId: payload.motorcycleId,
          bikeName,
          recordType,
          savedAt: new Date().toISOString(),
          freeScansLeft,
        });

        triggerNotification(Haptics.NotificationFeedbackType.Success);
        trackEvent(AnalyticsEvent.RECEIPT_SCAN_SAVE_COMPLETED, {
          route: recordType,
          ms: scanStartedAt != null ? Date.now() - scanStartedAt : null,
        });
        if (payload.applyOdometer) {
          // G3 odometer-freshness signal: the rider accepted the scanned reading,
          // advancing the bike's known mileage. NOTE: this is captured for the R8
          // funnel but is NOT yet surfaced as a mileage-freshness status anywhere —
          // that consumer lands with the §11 mileage-aware-status epic.
          trackEvent(AnalyticsEvent.RECEIPT_SCAN_ODOMETER_ACCEPTED, { unit: payload.odometerUnit });
        }

        onSaved();
      } finally {
        inFlightRef.current = false;
      }
    },
    [t, saveMutation, bikeName, freeScansLeft, scanStartedAt, onSaved],
  );

  return { save, saving: saveMutation.isPending };
}

// --- undo hook (global snackbar host / home card) ----------------------------

export function useUndoReceiptSave() {
  const { t } = useTranslation();

  const undoMutation = useMutation({
    mutationFn: (scanId: string) => gqlFetcher(UndoReceiptScanSaveDocument, { scanId }),
  });

  const undo = useCallback(
    async (entry: ReceiptSaveUndoEntry): Promise<boolean> => {
      try {
        const data = await undoMutation.mutateAsync(entry.scanId);
        const result = data.undoReceiptScanSave;
        if (result.__typename !== 'UndoReceiptScanSuccess') {
          Alert.alert(t('receiptScan.saved.undoFailed'), result.reason);
          return false;
        }
        // Reversal happened server-side; odometer may have been reverted → refresh bikes.
        invalidateForRecord(entry.recordType, entry.motorcycleId, true);
        clearReceiptSaveUndo(entry.scanId);
        trackEvent(AnalyticsEvent.RECEIPT_SCAN_SAVE_UNDONE, { route: entry.recordType });
        return true;
      } catch (err) {
        captureException(err, { source: 'receipt-scan.undo' });
        Alert.alert(t('receiptScan.saved.undoFailed'), t('receiptScan.saved.saveFailedBody'));
        return false;
      }
    },
    [t, undoMutation],
  );

  return { undo, undoing: undoMutation.isPending };
}
