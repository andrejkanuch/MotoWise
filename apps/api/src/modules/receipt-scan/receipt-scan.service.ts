import {
  classifyServiceType,
  EXPENSE_CATEGORIES,
  MaintenanceServiceType,
  MaintenanceTaskStatus,
  type MeasurementSystem,
  mileageToDisplayUnit,
  milesToKm,
  RECEIPT_LINE_ITEM_LABEL_MAX,
  RECEIPT_LINE_ITEMS_MAX,
  RECEIPT_SCAN_SCHEMA_VERSION,
  type ReceiptExtraction,
} from '@motovault/types';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { deleteReceiptsPhotoObjects, PHOTO_BUCKETS } from '../../common/storage/photo-storage';
import { costCentsFor } from '../../config/constants';
import { AiBudgetService } from '../ai-budget/ai-budget.service';
import { ExpensesService } from '../expenses/expenses.service';
import {
  type MaintenanceLineItemInput,
  MaintenanceTasksService,
} from '../maintenance-tasks/maintenance-tasks.service';
import { MotorcyclesService } from '../motorcycles/motorcycles.service';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import type { CancelReceiptScanSuccess } from './dto/receipt-scan-cancel.dto';
import type { ReceiptScanQuota } from './dto/receipt-scan-quota.dto';
import type {
  ReceiptExtractionResult,
  ReceiptScanError,
  ReceiptScanSuccess,
} from './dto/receipt-scan-result.dto';
import type { SaveReceiptScanInput, SaveReceiptScanSuccess } from './dto/save-receipt-scan.dto';
import type { UndoReceiptScanSuccess } from './dto/undo-receipt-scan.dto';
import type { UnreviewedScan } from './dto/unreviewed-scan.dto';
import {
  DEFAULT_EXPENSE_CATEGORY,
  DEFAULT_MAINTENANCE_TITLE,
  DEFAULT_MEASUREMENT_SYSTEM,
  GENERATION_LOG_STATUS,
  MAINTENANCE_SOURCE_RECEIPT_SCAN,
  MAX_PLAUSIBLE_ODOMETER_JUMP,
  MAX_PLAUSIBLE_RECEIPT_YEAR_DRIFT,
  MAX_RECEIPT_SCAN_ATTEMPTS_PER_DAY,
  MAX_RECEIPT_SCANS_PER_MONTH,
  ODOMETER_SYNC_SOURCE_MANUAL,
  ODOMETER_UNITS,
  PAYWALL_WOULD_HAVE_SHOWN,
  RECEIPT_OBJECT_EXT,
  RECEIPT_SCAN_CONTENT_TYPE,
  RECEIPT_SCAN_ERROR_CODES,
  RECEIPT_SCAN_STATUS,
  RECEIPTS_BUCKET,
  RECORD_TYPES,
  type SavedOdometerRef,
  type SavedRecordRefs,
  SCAN_ID_UUID_REGEX,
  STALE_PENDING_MS,
  UNDO_STATUS,
} from './receipt-scan.constants';
import { ReceiptScanAiService } from './receipt-scan-ai.service';

const RECEIPT_SCANS_TABLE = 'receipt_scans';
const CONTENT_GENERATION_LOG_TABLE = 'content_generation_log';
const EXPENSES_TABLE = 'expenses';
const MOTORCYCLES_TABLE = 'motorcycles';
const USERS_TABLE = 'users';
const PRO_TIER = 'pro';

/**
 * A compensating-saga cleanup thunk, run in reverse order on a mid-save throw.
 * Return value is ignored (some reversal helpers report a success boolean used
 * by the undo path); the compensation stack only cares that each step ran.
 */
type Compensation = () => Promise<unknown>;

type ScanErrorArm = { code: string; reason: string };

/** Human-facing reasons for each union error code. */
const ERROR_REASONS = {
  [RECEIPT_SCAN_ERROR_CODES.SCAN_DISABLED]:
    'Receipt scanning is temporarily unavailable. Please enter the details manually.',
  [RECEIPT_SCAN_ERROR_CODES.IMAGE_INVALID]:
    'That image could not be read as a receipt. Please retake the photo.',
  [RECEIPT_SCAN_ERROR_CODES.SCAN_QUOTA_EXCEEDED]:
    'You have used all of your free receipt scans this month. Upgrade to Pro for more.',
  [RECEIPT_SCAN_ERROR_CODES.SCAN_RATE_LIMITED]:
    'You have scanned a lot today. Please try again tomorrow, or enter this receipt by hand.',
  [RECEIPT_SCAN_ERROR_CODES.EXTRACTION_FAILED]:
    'We could not read this receipt. You can enter the details manually.',
  [RECEIPT_SCAN_ERROR_CODES.ALREADY_COMPLETED]:
    'This scan already completed — the credit was used and it is now waiting for review.',
  [RECEIPT_SCAN_ERROR_CODES.SCAN_NOT_REVIEWABLE]:
    'This scan is no longer available to save. Please rescan the receipt.',
  [RECEIPT_SCAN_ERROR_CODES.SAVE_FAILED]:
    'We could not save this receipt. Nothing was changed — please try again.',
  [RECEIPT_SCAN_ERROR_CODES.UNDO_FAILED]: 'We could not fully undo this receipt. Please try again.',
} as const satisfies Record<string, string>;

@Injectable()
export class ReceiptScanService {
  private readonly logger = new Logger(ReceiptScanService.name);

  constructor(
    private readonly configService: ConfigService,
    @Inject(SUPABASE_ADMIN) private readonly adminClient: SupabaseClient,
    private readonly aiBudgetService: AiBudgetService,
    private readonly aiService: ReceiptScanAiService,
    private readonly expensesService: ExpensesService,
    private readonly maintenanceTasksService: MaintenanceTasksService,
    private readonly motorcyclesService: MotorcyclesService,
  ) {}

  // ===========================================================================
  // scanReceipt — orchestration (KTD-1/2/3/4/5/6/12)
  // ===========================================================================
  async scanReceipt(
    user: AuthUser,
    scanId: string,
    isOnboarding = false,
  ): Promise<ReceiptScanSuccess | ReceiptScanError> {
    // 1. Kill switch (KTD-12).
    if (!this.isEnabled()) {
      return this.err(RECEIPT_SCAN_ERROR_CODES.SCAN_DISABLED);
    }

    // 2. Strict UUID validation BEFORE building any path (C1 traversal guard).
    if (!SCAN_ID_UUID_REGEX.test(scanId)) {
      this.logger.warn(`Rejected non-UUID scanId (traversal guard) user=${user.id}`);
      return this.err(RECEIPT_SCAN_ERROR_CODES.IMAGE_INVALID);
    }

    // 3. Derive the storage path server-side from the authenticated uid (C1).
    const path = this.buildPath(user.id, scanId);

    // 3b. Idempotency guard (at-least-once retries). scanId is client-supplied and
    // stable across a retry/queue-redrain of the SAME physical receipt, so it maps
    // deterministically to `path`. If a prior call for this exact object already
    // SUCCEEDED, return it instead of minting a second reservation — closes the
    // lost-response double-charge (a second OpenAI bill, a second consumed credit,
    // and a duplicate unreviewed scan). A genuinely new scan uses a fresh scanId.
    const duplicate = await this.findSucceededByPath(user.id, path);
    if (duplicate) return duplicate;

    // 3c. Per-user daily attempt cap (abuse backstop, tier-independent). Distinct
    // from the dormant monthly quota: it bounds runaway paid vision calls — FAILED
    // extractions included — so one account can't exhaust the global spend cap.
    // Checked here (a duplicate short-circuits above and does NOT count).
    if ((await this.countTodaysAttempts(user.id)) >= MAX_RECEIPT_SCAN_ATTEMPTS_PER_DAY) {
      this.logger.warn(`receipt-scan daily attempt cap reached user=${user.id}`);
      return this.err(RECEIPT_SCAN_ERROR_CODES.SCAN_RATE_LIMITED);
    }

    // 4. Global budget / circuit-breaker gate (throws on a genuine spend stop).
    await this.aiBudgetService.checkBudgetForUser(user.id);

    // 5. Reserve — always inserts a pending row, returns over_quota (KTD-5).
    const { reservationId, overQuota } = await this.reserve(user.id, isOnboarding);

    // 6. Enforce vs shadow (KTD-3): only reject when the flag is on AND the user
    // is genuinely free-tier; otherwise proceed (shadow mode).
    if (overQuota && this.isEnforced() && user.tier !== PRO_TIER) {
      await this.finalize(reservationId, RECEIPT_SCAN_STATUS.FAILED);
      return this.err(RECEIPT_SCAN_ERROR_CODES.SCAN_QUOTA_EXCEEDED);
    }
    if (overQuota) {
      this.logger.log(
        `${PAYWALL_WOULD_HAVE_SHOWN} user=${user.id} scan=${reservationId} tier=${user.tier}`,
      );
    }

    // Record the derived path on the (proceeding) row so cancel-by-path works
    // during the analyzing window and the object is not orphan-swept.
    await this.writeStoragePath(reservationId, path);

    // 7. Fetch the uploaded bytes via the admin client (path derived from uid).
    const bytes = await this.download(path);
    const mime = bytes ? this.aiService.detectImageMime(bytes) : null;

    // 8. Magic-byte validation — no model call, no credit on failure.
    if (!bytes || !mime) {
      await this.finalize(reservationId, RECEIPT_SCAN_STATUS.FAILED);
      return this.err(RECEIPT_SCAN_ERROR_CODES.IMAGE_INVALID);
    }

    // 9. Vision extraction.
    const outcome = await this.aiService.extract(bytes, mime);
    if (!outcome.ok) {
      await this.finalize(reservationId, RECEIPT_SCAN_STATUS.FAILED);
      await this.logGeneration(user.id, reservationId, GENERATION_LOG_STATUS.FAILED, 0, 0);
      return this.err(RECEIPT_SCAN_ERROR_CODES.EXTRACTION_FAILED);
    }

    // 9b. The model responded, but if it read NONE of the money-bearing fields
    // (amount / currency / date all null) there is nothing usable to review — do
    // not count an empty extraction as a success. Log the (real) spend as failed.
    const ext = outcome.extraction;
    if (ext.amount == null && ext.currency == null && ext.date == null) {
      await this.finalize(reservationId, RECEIPT_SCAN_STATUS.FAILED);
      await this.logGeneration(
        user.id,
        reservationId,
        GENERATION_LOG_STATUS.FAILED,
        outcome.inputTokens,
        outcome.outputTokens,
      );
      return this.err(RECEIPT_SCAN_ERROR_CODES.EXTRACTION_FAILED);
    }

    // 10. Build the persisted payload (VIN stripped KTD-9, category coerced,
    //     odometer kept KTD-7).
    const { result, payload } = this.buildResult(outcome.extraction);

    // 11. Finalize idempotently — success only from pending (KTD-5). The CAS
    // matches 0 rows when the reservation was cancelled/reaped mid-extraction.
    const finalized = await this.finalize(reservationId, RECEIPT_SCAN_STATUS.SUCCESS, payload);

    // 12. If the success transition matched no row the durable reservation is
    // gone (cancelled/reaped) — there is no success row to review. The model DID
    // run and incur spend, so log the ACTUAL outcome (FAILED) rather than a
    // SUCCESS row pointing at a now-cancelled content_id, then bail.
    if (finalized === 0) {
      this.logger.warn(
        `finalize(success) matched 0 rows for scan=${reservationId} — reservation lost (cancelled/reaped)`,
      );
      await this.logGeneration(
        user.id,
        reservationId,
        GENERATION_LOG_STATUS.FAILED,
        outcome.inputTokens,
        outcome.outputTokens,
      );
      return this.err(RECEIPT_SCAN_ERROR_CODES.EXTRACTION_FAILED);
    }

    // 13. Record spend for content_generation_log accounting (a real success).
    await this.logGeneration(
      user.id,
      reservationId,
      GENERATION_LOG_STATUS.SUCCESS,
      outcome.inputTokens,
      outcome.outputTokens,
    );

    // 14.
    return { scanId: reservationId, result };
  }

  // ===========================================================================
  // cancelReceiptScan — CAS pending→cancelled, loses to the finalizer (KTD-4)
  // ===========================================================================
  async cancelReceiptScan(
    user: AuthUser,
    scanId: string,
  ): Promise<CancelReceiptScanSuccess | ReceiptScanError> {
    if (!SCAN_ID_UUID_REGEX.test(scanId)) {
      return this.err(RECEIPT_SCAN_ERROR_CODES.IMAGE_INVALID);
    }
    const path = this.buildPath(user.id, scanId);

    // CAS: flip the still-pending row for this path to cancelled.
    const { data: cancelled } = await this.adminClient
      .from(RECEIPT_SCANS_TABLE)
      .update({ status: RECEIPT_SCAN_STATUS.CANCELLED })
      .eq('user_id', user.id)
      .eq('storage_path', path)
      .eq('status', RECEIPT_SCAN_STATUS.PENDING)
      .select('id');

    if (cancelled && cancelled.length > 0) {
      return { scanId: cancelled[0].id, status: RECEIPT_SCAN_STATUS.CANCELLED };
    }

    // Nothing pending to cancel — the finalizer already won iff a success row
    // exists at this path (credit consumed; scan is now unreviewed).
    const { data: existing } = await this.adminClient
      .from(RECEIPT_SCANS_TABLE)
      .select('id, status')
      .eq('user_id', user.id)
      .eq('storage_path', path)
      .order('created_at', { ascending: false })
      .limit(1);

    const latest = existing?.[0];
    if (latest?.status === RECEIPT_SCAN_STATUS.SUCCESS) {
      return this.err(RECEIPT_SCAN_ERROR_CODES.ALREADY_COMPLETED);
    }

    // Already cancelled / failed / not found — idempotently report cancelled
    // (nothing is consumable).
    return { scanId: latest?.id ?? scanId, status: RECEIPT_SCAN_STATUS.CANCELLED };
  }

  // ===========================================================================
  // receiptScanQuota — tier-INDEPENDENT raw used-count (KTD-3)
  // ===========================================================================
  async receiptScanQuota(user: AuthUser): Promise<ReceiptScanQuota> {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const resetDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    // Reap this user's abandoned pendings BEFORE counting (mirrors the reserve RPC).
    // The paywall gate reads this count and runs BEFORE scanReceipt, so the RPC's
    // own reaper never fires to clear a stale pending — without this sweep, three
    // app-killed/interrupted in-flight scans would count toward the cap and lock a
    // free user out of scanning for the rest of the month.
    await this.reapStalePendings(user.id);

    const { count } = await this.adminClient
      .from(RECEIPT_SCANS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_onboarding', false)
      .not('status', 'in', `(${RECEIPT_SCAN_STATUS.FAILED},${RECEIPT_SCAN_STATUS.CANCELLED})`)
      .gte('created_at', monthStart.toISOString());

    return {
      used: count ?? 0,
      limit: MAX_RECEIPT_SCANS_PER_MONTH,
      resetDate: resetDate.toISOString(),
    };
  }

  // ===========================================================================
  // unreviewedReceiptScans — status=success AND saved_at IS NULL (resume/home)
  // ===========================================================================
  async unreviewedReceiptScans(user: AuthUser): Promise<UnreviewedScan[]> {
    const { data } = await this.adminClient
      .from(RECEIPT_SCANS_TABLE)
      .select('id, storage_path, created_at, extraction_payload')
      .eq('user_id', user.id)
      .eq('status', RECEIPT_SCAN_STATUS.SUCCESS)
      .is('saved_at', null)
      .order('created_at', { ascending: false });

    return (data ?? []).map((row) => ({
      scanId: row.id,
      storagePath: row.storage_path,
      createdAt: row.created_at,
      result: this.payloadToResult(row.extraction_payload),
    }));
  }

  // ===========================================================================
  // saveReceiptScan — compound write as a COMPENSATING SAGA (KTD-11)
  //
  // Supabase JS has no cross-call DB transaction, so we run the writes in order,
  // pushing a cleanup thunk after each success onto a stack. If any step throws
  // we run the stack in reverse (compensating rollback) and return SAVE_FAILED —
  // no partial state, saved_at never stamped. Only on full success do we stamp
  // saved_at + saved_record_refs.
  // ===========================================================================
  async saveReceiptScan(
    user: AuthUser,
    scanId: string,
    input: SaveReceiptScanInput,
  ): Promise<SaveReceiptScanSuccess | ScanErrorArm> {
    if (!SCAN_ID_UUID_REGEX.test(scanId)) {
      return this.err(RECEIPT_SCAN_ERROR_CODES.SCAN_NOT_REVIEWABLE);
    }
    if (input.type !== RECORD_TYPES.EXPENSE && input.type !== RECORD_TYPES.MAINTENANCE) {
      return this.err(RECEIPT_SCAN_ERROR_CODES.SCAN_NOT_REVIEWABLE);
    }

    // Guard: must be the caller's own success-status scan.
    const scan = await this.loadScanForSave(user.id, scanId);
    if (!scan) return this.err(RECEIPT_SCAN_ERROR_CODES.SCAN_NOT_REVIEWABLE);

    // Idempotency fast-path: already saved → return the existing refs (no re-write).
    if (scan.saved_at) {
      return { scanId, refs: this.refsForDto(scan.saved_record_refs) };
    }

    // Ownership: the target motorcycle must belong to the caller. The record-write
    // services enforce user_id on the row they create but NOT on the referenced
    // motorcycleId (only the odometer sub-step did), so a crafted save with a
    // foreign motorcycleId would otherwise create a record pointing at another
    // user's bike. Assert up front, before claiming or writing anything. A lookup
    // error fails closed (SAVE_FAILED) rather than throwing a 500.
    const owned = await this.motorcyclesService
      .findById(user.id, input.motorcycleId)
      .catch(() => null);
    if (!owned) return this.err(RECEIPT_SCAN_ERROR_CODES.SAVE_FAILED);

    // Atomically CLAIM the scan BEFORE creating any records — a CAS stamp of
    // saved_at guarded by `saved_at IS NULL` so two concurrent saves cannot both
    // pass the check-then-write and double-book an expense/task (KTD-11).
    const claimed = await this.claimScan(scanId, user.id);
    if (!claimed) {
      // Lost the race: another save already claimed this scan. Return the
      // winner's refs if it has finished (idempotent), else do NOT create a
      // duplicate — report not-reviewable.
      const latest = await this.loadScanForSave(user.id, scanId);
      if (latest?.saved_at) {
        return { scanId, refs: this.refsForDto(latest.saved_record_refs) };
      }
      return this.err(RECEIPT_SCAN_ERROR_CODES.SCAN_NOT_REVIEWABLE);
    }

    // The claim is released LAST (runs last in the reversed stack) so a mid-save
    // throw returns the row to success-unsaved and a retry can re-claim it.
    const compensations: Compensation[] = [() => this.clearSaved(scanId, user.id)];
    try {
      // 1. Record write — dispatch on type.
      const refs =
        input.type === RECORD_TYPES.EXPENSE
          ? await this.writeExpenseRecord(user.id, input, compensations)
          : await this.writeMaintenanceRecord(user.id, input, compensations);

      // 2. Photo link — reuse the uploaded receipts object, NO re-upload. On
      // rollback we remove only the LINK row, NEVER the source receipt object —
      // it is the user's uploaded receipt and must survive for a retry (the
      // object is only deleted post-successful-save, in undoReceiptScanSave).
      if (scan.storage_path) {
        refs.photoId = await this.linkReceiptPhoto(user.id, refs, scan.storage_path);
        const linkedRefs = refs;
        compensations.push(() => this.unlinkPhoto(linkedRefs));
      }

      // 3. Odometer (optional, KTD-7).
      const odometer = await this.maybeApplyOdometer(user.id, input);
      if (odometer) {
        refs.odometer = odometer;
        compensations.push(() => this.revertOdometer(user.id, odometer));
      }

      // 4. Full success — persist the refs onto the already-claimed row.
      await this.persistRefs(scanId, user.id, refs);
      return { scanId, refs: this.refsForDto(refs) };
    } catch (err) {
      this.logger.error(`saveReceiptScan failed for scan=${scanId}: ${err}`);
      await this.runCompensations(compensations);
      return this.err(RECEIPT_SCAN_ERROR_CODES.SAVE_FAILED);
    }
  }

  // ===========================================================================
  // undoReceiptScanSave — reverse from saved_record_refs (KTD-11)
  //
  // Idempotent + resumable: each ref is reversed then cleared from the persisted
  // refs, so a mid-undo kill leaves a consistent partial state and a re-run only
  // finishes the leftovers. Per-step reversals are individually tolerant of
  // already-reverted state (best-effort, logged — mirrors the storage-purge
  // philosophy). Only after every ref is reversed do we clear saved_at (back to
  // success-unreviewed).
  // ===========================================================================
  async undoReceiptScanSave(
    user: AuthUser,
    scanId: string,
  ): Promise<UndoReceiptScanSuccess | ScanErrorArm> {
    if (!SCAN_ID_UUID_REGEX.test(scanId)) {
      return this.err(RECEIPT_SCAN_ERROR_CODES.SCAN_NOT_REVIEWABLE);
    }

    const scan = await this.loadScanForUndo(user.id, scanId);
    if (!scan) return this.err(RECEIPT_SCAN_ERROR_CODES.SCAN_NOT_REVIEWABLE);

    const refs = this.parseRefs(scan.saved_record_refs);
    if (!scan.saved_at || !refs) {
      // Never saved, or already fully undone — idempotent no-op.
      return { scanId, status: UNDO_STATUS.NOTHING_TO_UNDO };
    }

    let remaining: SavedRecordRefs = { ...refs };
    // Each ref is cleared ONLY after its reversal is confirmed — a failed step
    // leaves its ref (and saved_at) intact so a re-run resumes the leftover
    // (KTD-11 resumable undo). We never report REVERTED with work outstanding.
    let allReversed = true;

    // Record (expense OR task). A task delete must ALSO remove its auto-expense —
    // the soft_delete_maintenance_task RPC does not cascade to it (U3 link row).
    if (remaining.expenseId) {
      if (await this.reverseExpense(user.id, remaining.expenseId)) {
        remaining = await this.clearRef(scanId, user.id, remaining, 'expenseId');
      } else {
        allReversed = false;
      }
    }
    if (remaining.taskId) {
      if (await this.reverseTask(user.id, remaining.taskId)) {
        remaining = await this.clearRef(scanId, user.id, remaining, 'taskId');
      } else {
        allReversed = false;
      }
    }

    // Receipts storage OBJECT (U7a helper) — delete the object, not just the link.
    // A null storage_path means there is nothing to delete (treat as reversed).
    if (remaining.photoId) {
      const objectRemoved = scan.storage_path
        ? await this.deleteReceiptObject(user.id, scan.storage_path)
        : true;
      if (objectRemoved) {
        remaining = await this.clearRef(scanId, user.id, remaining, 'photoId');
      } else {
        allReversed = false;
      }
    }

    // Guarded odometer revert — only if current still equals the applied value.
    if (remaining.odometer) {
      if (await this.revertOdometer(user.id, remaining.odometer)) {
        remaining = await this.clearRef(scanId, user.id, remaining, 'odometer');
      } else {
        allReversed = false;
      }
    }

    if (!allReversed) {
      // Uncleared refs + saved_at remain, so a subsequent undo retries just the
      // leftovers. Do not clear saved_at or claim a full reversal.
      return this.err(RECEIPT_SCAN_ERROR_CODES.UNDO_FAILED);
    }

    await this.clearSaved(scanId, user.id);
    return { scanId, status: UNDO_STATUS.REVERTED };
  }

  // ===========================================================================
  // U7b helpers — saga steps, compensations, odometer (KTD-7), persistence
  // ===========================================================================

  /** Loads a caller-owned success scan for save (idempotency fields included). */
  private async loadScanForSave(
    userId: string,
    scanId: string,
  ): Promise<{
    storage_path: string | null;
    saved_at: string | null;
    saved_record_refs: unknown;
  } | null> {
    const { data } = await this.adminClient
      .from(RECEIPT_SCANS_TABLE)
      .select('id, storage_path, saved_at, saved_record_refs')
      .eq('id', scanId)
      .eq('user_id', userId)
      .eq('status', RECEIPT_SCAN_STATUS.SUCCESS)
      .maybeSingle();
    return data ?? null;
  }

  /** Loads a caller-owned scan for undo (no status filter — a saved scan stays success). */
  private async loadScanForUndo(
    userId: string,
    scanId: string,
  ): Promise<{
    storage_path: string | null;
    saved_at: string | null;
    saved_record_refs: unknown;
  } | null> {
    const { data } = await this.adminClient
      .from(RECEIPT_SCANS_TABLE)
      .select('id, storage_path, saved_at, saved_record_refs')
      .eq('id', scanId)
      .eq('user_id', userId)
      .maybeSingle();
    return data ?? null;
  }

  /** Expense path: logExpense write; pushes its soft-delete compensation. */
  private async writeExpenseRecord(
    userId: string,
    input: SaveReceiptScanInput,
    compensations: Compensation[],
  ): Promise<SavedRecordRefs> {
    const expense = await this.expensesService.create(userId, {
      motorcycleId: input.motorcycleId,
      amount: input.amount ?? 0,
      category: input.category ?? DEFAULT_EXPENSE_CATEGORY,
      date: this.saveDate(input.date),
      description: input.vendor ?? undefined,
      itemName: input.itemName ?? undefined,
      currency: input.currency ?? undefined,
    });
    compensations.push(() => this.reverseExpense(userId, expense.id));
    return { recordType: RECORD_TYPES.EXPENSE, expenseId: expense.id };
  }

  /**
   * Maintenance path: create a COMPLETED task as the authoritative financial
   * wrapper for the service visit (structure redesign). `total_amount` is the
   * gross paid — the single source of truth for the linked auto-expense (U3) —
   * and tax is stored explicitly (`tax_amount`) rather than hidden in the misc
   * `cost` bucket. parts/labor stay NET as printed.
   *
   * Reconcile-or-total-only (never throws): if the NET breakdown (parts + labor
   * + tax) exceeds the gross total it cannot be a faithful decomposition, so we
   * drop the breakdown and keep the total alone rather than misreport or block
   * the save. The service mileage and structured line items are recorded too.
   */
  private async writeMaintenanceRecord(
    userId: string,
    input: SaveReceiptScanInput,
    compensations: Compensation[],
  ): Promise<SavedRecordRefs> {
    const total = input.amount ?? 0;
    const parts = input.partsCost ?? undefined;
    const labor = input.laborCost ?? undefined;
    const tax = input.taxAmount ?? undefined;
    // Total-only fallback: keep the breakdown only when it plausibly reconciles
    // to the gross total (epsilon absorbs FP noise); otherwise show the total
    // alone. Either way total_amount is authoritative for the auto-expense.
    const breakdown = (parts ?? 0) + (labor ?? 0) + (tax ?? 0);
    const reconciles = breakdown <= total + 0.001;

    const completedMileage = await this.serviceMileage(userId, input);

    const task = await this.maintenanceTasksService.create(userId, {
      motorcycleId: input.motorcycleId,
      title: input.itemName || input.vendor || DEFAULT_MAINTENANCE_TITLE,
      status: MaintenanceTaskStatus.COMPLETED,
      completedAt: input.date ?? undefined,
      completedMileage,
      totalAmount: total,
      partsCost: reconciles ? parts : undefined,
      laborCost: reconciles ? labor : undefined,
      taxAmount: reconciles ? tax : undefined,
      // taxRate is a printed percentage (metadata), independent of whether the
      // money breakdown reconciles — keep it even in the total-only fallback.
      taxRate: input.taxRate ?? undefined,
      currency: input.currency ?? undefined,
      source: MAINTENANCE_SOURCE_RECEIPT_SCAN,
    });
    // reverseTask also purges line items, so a single compensation covers both.
    compensations.push(() => this.reverseTask(userId, task.id));

    const lineItems = this.buildLineItems(input.lineItems);
    if (lineItems.length > 0) {
      await this.maintenanceTasksService.addLineItems(userId, task.id, lineItems);
    }

    return { recordType: RECORD_TYPES.MAINTENANCE, taskId: task.id };
  }

  /**
   * Convert the receipt's printed odometer to the owner's stored unit for the
   * task's completed_mileage (the mileage AT the service). Independent of the
   * apply-to-bike toggle — a past service's reading is valid history even when
   * it is lower than the bike's current odometer. Skips when absent or the
   * printed unit is unknown (KTD-7 — never assume km).
   */
  private async serviceMileage(
    userId: string,
    input: SaveReceiptScanInput,
  ): Promise<number | undefined> {
    if (input.odometerValue == null) return undefined;
    if (input.odometerUnit !== ODOMETER_UNITS.KM && input.odometerUnit !== ODOMETER_UNITS.MI) {
      return undefined;
    }
    const system = await this.loadMeasurementSystem(userId);
    const km =
      input.odometerUnit === ODOMETER_UNITS.MI
        ? milesToKm(input.odometerValue)
        : input.odometerValue;
    return Math.round(mileageToDisplayUnit(km, system));
  }

  /** Resolve reviewed line items into persistable rows, classifying service_type server-side. */
  private buildLineItems(items: SaveReceiptScanInput['lineItems']): MaintenanceLineItemInput[] {
    if (!items || items.length === 0) return [];
    const valid = new Set<string>(Object.values(MaintenanceServiceType));
    return items
      .filter((item) => item.label?.trim())
      .map((item) => ({
        // Trust a client-supplied canonical type; otherwise derive it from the label.
        serviceType:
          item.serviceType && valid.has(item.serviceType)
            ? item.serviceType
            : classifyServiceType(item.label),
        label: item.label,
        partRef: item.partRef ?? null,
        quantity: item.quantity ?? null,
        unitPrice: item.unitPrice ?? null,
        lineTotal: item.lineTotal ?? null,
      }));
  }

  /** Links the already-uploaded receipts object to the created record (no re-upload). */
  private async linkReceiptPhoto(
    userId: string,
    refs: SavedRecordRefs,
    storagePath: string,
  ): Promise<string> {
    if (refs.recordType === RECORD_TYPES.EXPENSE && refs.expenseId) {
      const photo = await this.expensesService.addPhoto(
        userId,
        refs.expenseId,
        storagePath,
        undefined,
        PHOTO_BUCKETS.RECEIPTS,
      );
      return photo.id;
    }
    const photo = await this.maintenanceTasksService.addPhoto(
      userId,
      refs.taskId ?? '',
      storagePath,
      undefined,
      PHOTO_BUCKETS.RECEIPTS,
    );
    return photo.id;
  }

  /**
   * KTD-7 odometer write. Convert the PRINTED reading to the owner's stored unit:
   * a miles-printed value → km → owner unit; a km-printed value → owner unit.
   * Guards (all SKIP, never fail): never write a decrease (unless current is null
   * → first-set is OK); skip an implausibly large jump.
   */
  private async maybeApplyOdometer(
    userId: string,
    input: SaveReceiptScanInput,
  ): Promise<SavedOdometerRef | null> {
    if (!input.applyOdometer || input.odometerValue == null || input.odometerUnit == null) {
      return null;
    }
    // KTD-7: the unit is NEVER assumed. Without a known printed unit we cannot
    // convert safely (a miles reading stored as km is a ~1.61x error), so skip.
    if (input.odometerUnit !== ODOMETER_UNITS.KM && input.odometerUnit !== ODOMETER_UNITS.MI) {
      this.logger.warn(`odometer skip: unrecognized/absent unit '${input.odometerUnit}'`);
      return null;
    }

    const bike = await this.motorcyclesService.findById(userId, input.motorcycleId);
    if (!bike) {
      this.logger.warn(`odometer skip: motorcycle ${input.motorcycleId} not owned by ${userId}`);
      return null;
    }

    const system = await this.loadMeasurementSystem(userId);
    const km =
      input.odometerUnit === ODOMETER_UNITS.MI
        ? milesToKm(input.odometerValue)
        : input.odometerValue;
    const applied = Math.round(mileageToDisplayUnit(km, system));
    const current = bike.currentMileage ?? null;

    if (current != null && applied <= current) {
      this.logger.log(`odometer skip: ${applied} not greater than current ${current}`);
      return null;
    }
    if (current != null && applied - current > MAX_PLAUSIBLE_ODOMETER_JUMP) {
      this.logger.warn(`odometer skip: implausible jump ${current} → ${applied} (flagged)`);
      return null;
    }

    await this.motorcyclesService.update(userId, input.motorcycleId, { currentMileage: applied });
    return { motorcycleId: input.motorcycleId, previous: current, applied };
  }

  /** Owner's global measurement system (users read is service-role only, 00141). */
  private async loadMeasurementSystem(userId: string): Promise<MeasurementSystem> {
    const { data } = await this.adminClient
      .from(USERS_TABLE)
      .select('measurement_system')
      .eq('id', userId)
      .single();
    return (data?.measurement_system as MeasurementSystem | null) ?? DEFAULT_MEASUREMENT_SYSTEM;
  }

  /**
   * Soft-delete an expense (also purges its linked receipts object). Returns
   * true on success (or idempotent already-deleted), false on a genuine failure
   * so an undo caller retains the ref for a resumable retry.
   */
  private async reverseExpense(userId: string, expenseId: string): Promise<boolean> {
    try {
      await this.expensesService.softDelete(userId, expenseId);
      return true;
    } catch (err) {
      // Already soft-deleted (idempotent re-run) or a best-effort failure.
      this.logger.warn(`reverseExpense no-op/failed for ${expenseId}: ${err}`);
      return false;
    }
  }

  /**
   * Reverse a completed task: soft-delete its auto-expense (U3 link — the
   * soft_delete_maintenance_task RPC does NOT cascade to it) THEN the task
   * (which purges its receipts photo object). Returns false if any sub-step
   * failed so the undo caller retains the ref for a resumable retry.
   */
  private async reverseTask(userId: string, taskId: string): Promise<boolean> {
    let ok = true;
    const { data } = await this.adminClient
      .from(EXPENSES_TABLE)
      .select('id')
      .eq('maintenance_task_id', taskId)
      .eq('user_id', userId)
      .is('deleted_at', null);
    for (const row of data ?? []) {
      if (!(await this.reverseExpense(userId, row.id as string))) ok = false;
    }
    // Purge structured line items (soft-deleting the task does not cascade to
    // them). Best-effort — mirrors the storage-purge philosophy.
    await this.maintenanceTasksService.deleteLineItems(userId, taskId);
    try {
      await this.maintenanceTasksService.softDelete(userId, taskId);
    } catch (err) {
      this.logger.warn(`reverseTask no-op/failed for ${taskId}: ${err}`);
      ok = false;
    }
    return ok;
  }

  /**
   * Delete the receipts storage OBJECT (U7a helper). Returns true when the object
   * was removed (or confirmed absent), false on a storage failure so an undo
   * caller retains the photo ref for a resumable retry.
   */
  private async deleteReceiptObject(userId: string, storagePath: string): Promise<boolean> {
    const { removedPaths } = await deleteReceiptsPhotoObjects({
      rows: [{ storage_path: storagePath, bucket: PHOTO_BUCKETS.RECEIPTS, user_id: userId }],
      ownerUserId: userId,
      adminClient: this.adminClient,
      logger: this.logger,
    });
    return removedPaths.includes(storagePath);
  }

  /**
   * Remove ONLY the photo LINK row (not the storage object) — the save-rollback
   * compensation for a linked receipt. The source object is the user's uploaded
   * receipt and must survive for a retry (finding: never delete it on rollback).
   */
  private async unlinkPhoto(refs: SavedRecordRefs): Promise<void> {
    if (!refs.photoId) return;
    const table =
      refs.recordType === RECORD_TYPES.EXPENSE ? 'expense_photos' : 'maintenance_task_photos';
    const { error } = await this.adminClient.from(table).delete().eq('id', refs.photoId);
    if (error) this.logger.warn(`unlinkPhoto failed for ${refs.photoId}: ${error.message}`);
  }

  /**
   * Guarded compensating revert (KTD-11): atomically restore current_mileage to
   * `previous` ONLY if it still equals the scan-applied value — a CAS that never
   * clobbers a newer reading. previous=null (first-set) reverts back to null.
   *
   * DELIBERATE service-role footgun-exception (CLAUDE.md): this is an RLS-bypassing
   * write to the RLS-protected motorcycles table. It is safe ONLY because of the
   * mandatory `.eq('user_id', userId)` filter below (userId is always the
   * authenticated caller) plus the current_mileage CAS. Do NOT remove either
   * filter — dropping the user_id predicate turns this into a cross-tenant write.
   * The apply path routes through motorcyclesService.update (user client); this
   * compensation keeps the admin client for the CAS.
   */
  private async revertOdometer(userId: string, ref: SavedOdometerRef): Promise<boolean> {
    const { error } = await this.adminClient
      .from(MOTORCYCLES_TABLE)
      .update({
        current_mileage: ref.previous,
        odometer_sync_source: ODOMETER_SYNC_SOURCE_MANUAL,
        odometer_last_ride_id: null,
        mileage_updated_at: new Date().toISOString(),
      })
      .eq('id', ref.motorcycleId)
      .eq('user_id', userId)
      .eq('current_mileage', ref.applied);
    // A 0-row match (a newer reading superseded ours) is NOT a failure — the CAS
    // guard intentionally declines to clobber it. Only a DB error is a failure.
    if (error) {
      this.logger.warn(`revertOdometer failed for ${ref.motorcycleId}: ${error.message}`);
      return false;
    }
    return true;
  }

  /** Runs the compensation stack in reverse; each step is isolated (logs, never throws). */
  private async runCompensations(compensations: Compensation[]): Promise<void> {
    for (const compensate of compensations.reverse()) {
      try {
        await compensate();
      } catch (err) {
        this.logger.error(`compensation step failed: ${err}`);
      }
    }
  }

  /**
   * Atomically CLAIM the scan for save: CAS-stamp saved_at guarded by
   * `saved_at IS NULL` (+ owner + success status). Returns true iff THIS call
   * won the claim — concurrent saves see 0 rows and must not proceed (KTD-11).
   */
  private async claimScan(scanId: string, userId: string): Promise<boolean> {
    const { data, error } = await this.adminClient
      .from(RECEIPT_SCANS_TABLE)
      .update({ saved_at: new Date().toISOString() })
      .eq('id', scanId)
      .eq('user_id', userId)
      .eq('status', RECEIPT_SCAN_STATUS.SUCCESS)
      .is('saved_at', null)
      .select('id');
    if (error) {
      this.logger.error(`claimScan failed for scan=${scanId}: ${error.message}`);
      return false;
    }
    return (data?.length ?? 0) > 0;
  }

  /** Persist the saved_record_refs onto the already-claimed row (throws → compensate). */
  private async persistRefs(scanId: string, userId: string, refs: SavedRecordRefs): Promise<void> {
    const { error } = await this.adminClient
      .from(RECEIPT_SCANS_TABLE)
      .update({ saved_record_refs: refs })
      .eq('id', scanId)
      .eq('user_id', userId);
    if (error) throw new Error(`persistRefs failed: ${error.message}`);
  }

  /** Persist the shrinking refs mid-undo so a re-run only finishes leftovers. */
  private async clearRef(
    scanId: string,
    userId: string,
    refs: SavedRecordRefs,
    key: 'expenseId' | 'taskId' | 'photoId' | 'odometer',
  ): Promise<SavedRecordRefs> {
    const next: SavedRecordRefs = { ...refs };
    delete next[key];
    await this.adminClient
      .from(RECEIPT_SCANS_TABLE)
      .update({ saved_record_refs: next })
      .eq('id', scanId)
      .eq('user_id', userId);
    return next;
  }

  /** Return the row to success-unreviewed after a full undo. */
  private async clearSaved(scanId: string, userId: string): Promise<void> {
    await this.adminClient
      .from(RECEIPT_SCANS_TABLE)
      .update({ saved_at: null, saved_record_refs: null })
      .eq('id', scanId)
      .eq('user_id', userId);
  }

  private saveDate(date?: string | null): string {
    return date ?? new Date().toISOString().split('T')[0];
  }

  /** Narrow a persisted saved_record_refs JSONB into the typed ref shape. */
  private parseRefs(value: unknown): SavedRecordRefs | null {
    if (!value || typeof value !== 'object') return null;
    const r = value as Record<string, unknown>;
    if (r.recordType !== RECORD_TYPES.EXPENSE && r.recordType !== RECORD_TYPES.MAINTENANCE) {
      return null;
    }
    return r as unknown as SavedRecordRefs;
  }

  /** Refs → GraphQL SaveReceiptScanSuccess.refs (identical shape). */
  private refsForDto(value: unknown): SaveReceiptScanSuccess['refs'] {
    const refs = this.parseRefs(value) ?? { recordType: RECORD_TYPES.EXPENSE };
    return refs as unknown as SaveReceiptScanSuccess['refs'];
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  /** KTD-12: enabled unless RECEIPT_SCAN_ENABLED is explicitly 'false'. */
  private isEnabled(): boolean {
    return this.configService.get<string>('RECEIPT_SCAN_ENABLED', 'true') !== 'false';
  }

  /** Dormant server enforcement layer — mirrors the GqlAuthGuard flag read. */
  private isEnforced(): boolean {
    return this.configService.get<string>('ENTITLEMENTS_ENFORCED', 'false') === 'true';
  }

  private buildPath(userId: string, scanId: string): string {
    return `${userId}/${scanId}.${RECEIPT_OBJECT_EXT}`;
  }

  private err(code: keyof typeof ERROR_REASONS): ScanErrorArm {
    return { code, reason: ERROR_REASONS[code] };
  }

  private async reserve(
    userId: string,
    isOnboarding: boolean,
  ): Promise<{ reservationId: string; overQuota: boolean }> {
    const { data, error } = await this.adminClient.rpc('reserve_receipt_scan', {
      p_user_id: userId,
      p_is_onboarding: isOnboarding,
      p_monthly_limit: MAX_RECEIPT_SCANS_PER_MONTH,
    });

    if (error || !data || data.length === 0) {
      this.logger.error('reserve_receipt_scan RPC failed', error);
      throw new Error('Unable to reserve receipt scan');
    }

    const row = data[0];
    return { reservationId: row.reservation_id, overQuota: row.over_quota };
  }

  /**
   * Idempotency probe: the most recent SUCCESS reservation for this exact uploaded
   * object (storage_path), if any. Returns the reviewable success payload so a
   * retried scanReceipt for the same object short-circuits instead of re-charging.
   * Returns null when there is no prior success or the payload is unrehydratable.
   */
  private async findSucceededByPath(
    userId: string,
    path: string,
  ): Promise<ReceiptScanSuccess | null> {
    const { data } = await this.adminClient
      .from(RECEIPT_SCANS_TABLE)
      .select('id, extraction_payload')
      .eq('user_id', userId)
      .eq('storage_path', path)
      .eq('status', RECEIPT_SCAN_STATUS.SUCCESS)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data || Array.isArray(data)) return null;
    const result = this.payloadToResult(data.extraction_payload);
    return result ? { scanId: data.id, result } : null;
  }

  /** Count of this user's non-cancelled receipt scans since UTC midnight (daily cap). */
  private async countTodaysAttempts(userId: string): Promise<number> {
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const { count } = await this.adminClient
      .from(RECEIPT_SCANS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('status', 'in', `(${RECEIPT_SCAN_STATUS.CANCELLED})`)
      .gte('created_at', dayStart.toISOString());
    return count ?? 0;
  }

  /** Sweeps this user's abandoned (>15 min) pendings to failed (reserve-RPC parity). */
  private async reapStalePendings(userId: string): Promise<void> {
    const staleBefore = new Date(Date.now() - STALE_PENDING_MS).toISOString();
    await this.adminClient
      .from(RECEIPT_SCANS_TABLE)
      .update({ status: RECEIPT_SCAN_STATUS.FAILED })
      .eq('user_id', userId)
      .eq('status', RECEIPT_SCAN_STATUS.PENDING)
      .lt('created_at', staleBefore);
  }

  private async writeStoragePath(reservationId: string, path: string): Promise<void> {
    await this.adminClient
      .from(RECEIPT_SCANS_TABLE)
      .update({ storage_path: path })
      .eq('id', reservationId)
      .eq('status', RECEIPT_SCAN_STATUS.PENDING);
  }

  /**
   * Idempotent finalize — only ever transitions a row OUT of `pending`, so a slow
   * success cannot resurrect a reaped/cancelled row (KTD-5).
   */
  private async finalize(
    reservationId: string,
    status: typeof RECEIPT_SCAN_STATUS.SUCCESS | typeof RECEIPT_SCAN_STATUS.FAILED,
    payload?: Record<string, unknown>,
  ): Promise<number> {
    const patch: Record<string, unknown> = { status };
    if (payload) patch.extraction_payload = payload;

    // `.select('id')` exposes the affected-row count so the caller can detect a
    // lost reservation (cancelled/reaped won the pending→success CAS first).
    const { data, error } = await this.adminClient
      .from(RECEIPT_SCANS_TABLE)
      .update(patch)
      .eq('id', reservationId)
      .eq('status', RECEIPT_SCAN_STATUS.PENDING)
      .select('id');

    if (error) {
      this.logger.error(`Failed to finalize scan ${reservationId} → ${status}`, error);
      return 0;
    }
    return data?.length ?? 0;
  }

  private async download(path: string): Promise<Buffer | null> {
    const { data, error } = await this.adminClient.storage.from(RECEIPTS_BUCKET).download(path);
    if (error || !data) {
      this.logger.warn(`Failed to download receipt object ${path}: ${error?.message}`);
      return null;
    }
    return Buffer.from(await data.arrayBuffer());
  }

  /**
   * Strip VIN (KTD-9), coerce out-of-enum category → 'other' + needs-check, keep
   * odometer (KTD-7). Returns the GraphQL result AND the JSONB persist payload
   * from a single canonical shape.
   */
  private buildResult(extraction: ReceiptExtraction): {
    result: ReceiptExtractionResult;
    payload: Record<string, unknown>;
  } {
    const needsCheck = new Set<string>();

    const rawCategory = extraction.category;
    const category =
      rawCategory && (EXPENSE_CATEGORIES as readonly string[]).includes(rawCategory)
        ? rawCategory
        : DEFAULT_EXPENSE_CATEGORY;
    if (category !== rawCategory) needsCheck.add('category');

    // Date hardening: a service invoice carries several dates (issue vs sale vs
    // registration), so ALWAYS ask the rider to confirm a maintenance date. And
    // for ANY receipt, flag a date whose year is implausibly far from now — the
    // model reported 2022 at confidence 1.0 on a 2026 invoice, so confidence
    // alone cannot be trusted here.
    if (extraction.type === RECORD_TYPES.MAINTENANCE) needsCheck.add('date');
    if (this.hasFarOffYear(extraction.date)) needsCheck.add('date');

    // Clamp line items to the save-contract limits so a parsed extraction can
    // never fail the downstream save-schema validation: drop overflow beyond
    // RECEIPT_LINE_ITEMS_MAX and truncate any label past RECEIPT_LINE_ITEM_LABEL_MAX.
    const lineItems = extraction.lineItems.slice(0, RECEIPT_LINE_ITEMS_MAX).map((li) => ({
      ...li,
      label: li.label.slice(0, RECEIPT_LINE_ITEM_LABEL_MAX),
    }));

    const result: ReceiptExtractionResult = {
      type: extraction.type,
      amount: extraction.amount,
      currency: extraction.currency,
      date: extraction.date,
      vendor: extraction.vendor,
      itemName: extraction.itemName,
      category,
      partsCost: extraction.partsCost,
      laborCost: extraction.laborCost,
      taxAmount: extraction.taxAmount,
      taxRate: extraction.taxRate,
      lineItems,
      odometerValue: extraction.odometerValue,
      odometerUnit: extraction.odometerUnit,
      fuelLitres: extraction.fuelLitres,
      partsNeeded: extraction.partsNeeded,
      fieldConfidence: extraction.fieldConfidence,
      legibilityNote: extraction.legibilityNote,
      needsCheck: [...needsCheck],
    };

    // Persist payload = result + schema version. VIN never enters this object.
    const payload: Record<string, unknown> = {
      ...result,
      schemaVersion: RECEIPT_SCAN_SCHEMA_VERSION,
    };

    return { result, payload };
  }

  /**
   * True when an ISO date's YEAR is implausibly far from the current year (either
   * direction), beyond MAX_PLAUSIBLE_RECEIPT_YEAR_DRIFT. Powers the date-hardening
   * needs-check hint. A null/unparseable date is not "far off" (the missing-date
   * amber is driven elsewhere).
   */
  private hasFarOffYear(date: string | null): boolean {
    if (!date) return false;
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return false;
    const currentYear = new Date().getUTCFullYear();
    return Math.abs(parsed.getUTCFullYear() - currentYear) > MAX_PLAUSIBLE_RECEIPT_YEAR_DRIFT;
  }

  /** Rehydrate a persisted extraction_payload into the GraphQL result shape. */
  private payloadToResult(payload: unknown): ReceiptExtractionResult | null {
    if (!payload || typeof payload !== 'object') return null;
    const p = payload as Record<string, unknown>;
    // fieldConfidence is a NON-NULL GraphQL object with six required Float subfields.
    // Validate the shape before casting — a partial payload (e.g. a future schema
    // version) would otherwise pass the truthy check and then null a subfield at
    // GraphQL resolution, silently dropping the whole scan from the home card.
    if (typeof p.type !== 'string' || !this.isValidFieldConfidence(p.fieldConfidence)) {
      return null;
    }
    return {
      type: p.type,
      amount: (p.amount as number | null) ?? null,
      currency: (p.currency as string | null) ?? null,
      date: (p.date as string | null) ?? null,
      vendor: (p.vendor as string | null) ?? null,
      itemName: (p.itemName as string | null) ?? null,
      category: (p.category as string | null) ?? null,
      partsCost: (p.partsCost as number | null) ?? null,
      laborCost: (p.laborCost as number | null) ?? null,
      // v2 fields — default for legacy (v1) payloads that predate them.
      taxAmount: (p.taxAmount as number | null) ?? null,
      taxRate: (p.taxRate as number | null) ?? null,
      lineItems: (p.lineItems as ReceiptExtractionResult['lineItems']) ?? [],
      odometerValue: (p.odometerValue as number | null) ?? null,
      odometerUnit: (p.odometerUnit as string | null) ?? null,
      fuelLitres: (p.fuelLitres as number | null) ?? null,
      partsNeeded: (p.partsNeeded as string[]) ?? [],
      fieldConfidence: p.fieldConfidence as ReceiptExtractionResult['fieldConfidence'],
      legibilityNote: (p.legibilityNote as string | null) ?? null,
      needsCheck: (p.needsCheck as string[]) ?? [],
    };
  }

  /** Type guard: a complete fieldConfidence object (six numeric Float subfields). */
  private isValidFieldConfidence(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false;
    const fc = value as Record<string, unknown>;
    return (['amount', 'currency', 'date', 'vendor', 'category', 'odometer'] as const).every(
      (k) => typeof fc[k] === 'number',
    );
  }

  private async logGeneration(
    userId: string,
    reservationId: string,
    status: typeof GENERATION_LOG_STATUS.SUCCESS | typeof GENERATION_LOG_STATUS.FAILED,
    inputTokens: number,
    outputTokens: number,
  ): Promise<void> {
    const model = this.aiService.model;
    const { error } = await this.adminClient.from(CONTENT_GENERATION_LOG_TABLE).insert({
      user_id: userId,
      content_type: RECEIPT_SCAN_CONTENT_TYPE,
      content_id: reservationId,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_cents: costCentsFor(model, inputTokens, outputTokens),
      status,
    });
    if (error) this.logger.error('Failed to log receipt-scan generation', error);
  }
}
