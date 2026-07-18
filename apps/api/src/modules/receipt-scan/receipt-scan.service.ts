import {
  EXPENSE_CATEGORIES,
  MaintenanceTaskStatus,
  type MeasurementSystem,
  mileageToDisplayUnit,
  milesToKm,
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
import { MaintenanceTasksService } from '../maintenance-tasks/maintenance-tasks.service';
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
  UNDO_STATUS,
} from './receipt-scan.constants';
import { ReceiptScanAiService } from './receipt-scan-ai.service';

const RECEIPT_SCANS_TABLE = 'receipt_scans';
const CONTENT_GENERATION_LOG_TABLE = 'content_generation_log';
const EXPENSES_TABLE = 'expenses';
const MOTORCYCLES_TABLE = 'motorcycles';
const USERS_TABLE = 'users';
const PRO_TIER = 'pro';

/** A compensating-saga cleanup thunk, run in reverse order on a mid-save throw. */
type Compensation = () => Promise<void>;

type ScanErrorArm = { code: string; reason: string };

/** Human-facing reasons for each union error code. */
const ERROR_REASONS = {
  [RECEIPT_SCAN_ERROR_CODES.SCAN_DISABLED]:
    'Receipt scanning is temporarily unavailable. Please enter the details manually.',
  [RECEIPT_SCAN_ERROR_CODES.IMAGE_INVALID]:
    'That image could not be read as a receipt. Please retake the photo.',
  [RECEIPT_SCAN_ERROR_CODES.SCAN_QUOTA_EXCEEDED]:
    'You have used all of your free receipt scans this month. Upgrade to Pro for more.',
  [RECEIPT_SCAN_ERROR_CODES.EXTRACTION_FAILED]:
    'We could not read this receipt. You can enter the details manually.',
  [RECEIPT_SCAN_ERROR_CODES.ALREADY_COMPLETED]:
    'This scan already completed — the credit was used and it is now waiting for review.',
  [RECEIPT_SCAN_ERROR_CODES.SCAN_NOT_REVIEWABLE]:
    'This scan is no longer available to save. Please rescan the receipt.',
  [RECEIPT_SCAN_ERROR_CODES.SAVE_FAILED]:
    'We could not save this receipt. Nothing was changed — please try again.',
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

    // 4. Global budget / circuit-breaker gate (throws on a genuine spend stop).
    await this.aiBudgetService.checkBudgetForUser(user.id);

    // 5. Reserve — always inserts a pending row, returns over_quota (KTD-5).
    const { reservationId, overQuota } = await this.reserve(user.id);

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

    // 10. Build the persisted payload (VIN stripped KTD-9, category coerced,
    //     odometer kept KTD-7).
    const { result, payload } = this.buildResult(outcome.extraction);

    // 11. Finalize idempotently — success only from pending (KTD-5).
    await this.finalize(reservationId, RECEIPT_SCAN_STATUS.SUCCESS, payload);

    // 12. Record spend for content_generation_log accounting.
    await this.logGeneration(
      user.id,
      reservationId,
      GENERATION_LOG_STATUS.SUCCESS,
      outcome.inputTokens,
      outcome.outputTokens,
    );

    // 13.
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

    // Idempotency: already saved → return the existing refs (no double-write).
    if (scan.saved_at) {
      return { scanId, refs: this.refsForDto(scan.saved_record_refs) };
    }

    const compensations: Compensation[] = [];
    try {
      // 1. Record write — dispatch on type.
      const refs =
        input.type === RECORD_TYPES.EXPENSE
          ? await this.writeExpenseRecord(user.id, input, compensations)
          : await this.writeMaintenanceRecord(user.id, input, compensations);

      // 2. Photo link — reuse the uploaded receipts object, NO re-upload.
      if (scan.storage_path) {
        refs.photoId = await this.linkReceiptPhoto(user.id, refs, scan.storage_path);
        const objectPath = scan.storage_path;
        compensations.push(() => this.deleteReceiptObject(user.id, objectPath));
      }

      // 3. Odometer (optional, KTD-7).
      const odometer = await this.maybeApplyOdometer(user.id, input);
      if (odometer) {
        refs.odometer = odometer;
        compensations.push(() => this.revertOdometer(user.id, odometer));
      }

      // 4. Full success — stamp the row (throws → compensate).
      await this.stampSaved(scanId, user.id, refs);
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

    // Record (expense OR task). A task delete must ALSO remove its auto-expense —
    // the soft_delete_maintenance_task RPC does not cascade to it (U3 link row).
    if (remaining.expenseId) {
      await this.reverseExpense(user.id, remaining.expenseId);
      remaining = await this.clearRef(scanId, user.id, remaining, 'expenseId');
    }
    if (remaining.taskId) {
      await this.reverseTask(user.id, remaining.taskId);
      remaining = await this.clearRef(scanId, user.id, remaining, 'taskId');
    }

    // Receipts storage OBJECT (U7a helper) — delete the object, not just the link.
    if (remaining.photoId) {
      if (scan.storage_path) await this.deleteReceiptObject(user.id, scan.storage_path);
      remaining = await this.clearRef(scanId, user.id, remaining, 'photoId');
    }

    // Guarded odometer revert — only if current still equals the applied value.
    if (remaining.odometer) {
      await this.revertOdometer(user.id, remaining.odometer);
      remaining = await this.clearRef(scanId, user.id, remaining, 'odometer');
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
   * Maintenance path: create a COMPLETED task with costs — this fires the linked
   * auto-expense (U3). The cost components are additive in the auto-expense total,
   * so we back the misc `cost` out of the receipt total minus the parts/labor
   * breakdown, keeping the auto-expense equal to the receipt amount.
   */
  private async writeMaintenanceRecord(
    userId: string,
    input: SaveReceiptScanInput,
    compensations: Compensation[],
  ): Promise<SavedRecordRefs> {
    const amount = input.amount ?? 0;
    const partsCost = input.partsCost ?? undefined;
    const laborCost = input.laborCost ?? undefined;
    const cost = Math.max(amount - (partsCost ?? 0) - (laborCost ?? 0), 0);

    const task = await this.maintenanceTasksService.create(userId, {
      motorcycleId: input.motorcycleId,
      title: input.itemName || input.vendor || DEFAULT_MAINTENANCE_TITLE,
      status: MaintenanceTaskStatus.COMPLETED,
      completedAt: input.date ?? undefined,
      cost,
      partsCost,
      laborCost,
      currency: input.currency ?? undefined,
      source: MAINTENANCE_SOURCE_RECEIPT_SCAN,
    });
    compensations.push(() => this.reverseTask(userId, task.id));
    return { recordType: RECORD_TYPES.MAINTENANCE, taskId: task.id };
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
    if (!input.applyOdometer || input.odometerValue == null) return null;

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

  /** Soft-delete an expense (also purges its linked receipts object). Tolerant. */
  private async reverseExpense(userId: string, expenseId: string): Promise<void> {
    try {
      await this.expensesService.softDelete(userId, expenseId);
    } catch (err) {
      // Already soft-deleted (idempotent re-run) or a best-effort failure.
      this.logger.warn(`reverseExpense no-op/failed for ${expenseId}: ${err}`);
    }
  }

  /**
   * Reverse a completed task: soft-delete its auto-expense (U3 link — the
   * soft_delete_maintenance_task RPC does NOT cascade to it) THEN the task
   * (which purges its receipts photo object). Tolerant of already-reverted state.
   */
  private async reverseTask(userId: string, taskId: string): Promise<void> {
    const { data } = await this.adminClient
      .from(EXPENSES_TABLE)
      .select('id')
      .eq('maintenance_task_id', taskId)
      .eq('user_id', userId)
      .is('deleted_at', null);
    for (const row of data ?? []) {
      await this.reverseExpense(userId, row.id as string);
    }
    try {
      await this.maintenanceTasksService.softDelete(userId, taskId);
    } catch (err) {
      this.logger.warn(`reverseTask no-op/failed for ${taskId}: ${err}`);
    }
  }

  /** Delete the receipts storage OBJECT (U7a helper). Best-effort, idempotent. */
  private async deleteReceiptObject(userId: string, storagePath: string): Promise<void> {
    await deleteReceiptsPhotoObjects({
      rows: [{ storage_path: storagePath, bucket: PHOTO_BUCKETS.RECEIPTS, user_id: userId }],
      ownerUserId: userId,
      adminClient: this.adminClient,
      logger: this.logger,
    });
  }

  /**
   * Guarded compensating revert (KTD-11): atomically restore current_mileage to
   * `previous` ONLY if it still equals the scan-applied value — a CAS that never
   * clobbers a newer reading. previous=null (first-set) reverts back to null.
   */
  private async revertOdometer(userId: string, ref: SavedOdometerRef): Promise<void> {
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
    if (error) this.logger.warn(`revertOdometer failed for ${ref.motorcycleId}: ${error.message}`);
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

  /** Stamp the successful save (idempotency-guarded: only from an unsaved row). */
  private async stampSaved(scanId: string, userId: string, refs: SavedRecordRefs): Promise<void> {
    const { error } = await this.adminClient
      .from(RECEIPT_SCANS_TABLE)
      .update({ saved_at: new Date().toISOString(), saved_record_refs: refs })
      .eq('id', scanId)
      .eq('user_id', userId)
      .is('saved_at', null);
    if (error) throw new Error(`stampSaved failed: ${error.message}`);
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

  private async reserve(userId: string): Promise<{ reservationId: string; overQuota: boolean }> {
    const { data, error } = await this.adminClient.rpc('reserve_receipt_scan', {
      p_user_id: userId,
      p_is_onboarding: false,
      // TODO(U5): FREE_TIER_LIMITS.MAX_RECEIPT_SCANS_PER_MONTH (added in U5).
      p_monthly_limit: MAX_RECEIPT_SCANS_PER_MONTH,
    });

    if (error || !data || data.length === 0) {
      this.logger.error('reserve_receipt_scan RPC failed', error);
      throw new Error('Unable to reserve receipt scan');
    }

    const row = data[0];
    return { reservationId: row.reservation_id, overQuota: row.over_quota };
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
  ): Promise<void> {
    const patch: Record<string, unknown> = { status };
    if (payload) patch.extraction_payload = payload;

    const { error } = await this.adminClient
      .from(RECEIPT_SCANS_TABLE)
      .update(patch)
      .eq('id', reservationId)
      .eq('status', RECEIPT_SCAN_STATUS.PENDING);

    if (error) this.logger.error(`Failed to finalize scan ${reservationId} → ${status}`, error);
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
    const needsCheck: string[] = [];

    const rawCategory = extraction.category;
    const category =
      rawCategory && (EXPENSE_CATEGORIES as readonly string[]).includes(rawCategory)
        ? rawCategory
        : DEFAULT_EXPENSE_CATEGORY;
    if (category !== rawCategory) needsCheck.push('category');

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
      odometerValue: extraction.odometerValue,
      odometerUnit: extraction.odometerUnit,
      fuelLitres: extraction.fuelLitres,
      partsNeeded: extraction.partsNeeded,
      fieldConfidence: extraction.fieldConfidence,
      legibilityNote: extraction.legibilityNote,
      needsCheck,
    };

    // Persist payload = result + schema version. VIN never enters this object.
    const payload: Record<string, unknown> = {
      ...result,
      schemaVersion: RECEIPT_SCAN_SCHEMA_VERSION,
    };

    return { result, payload };
  }

  /** Rehydrate a persisted extraction_payload into the GraphQL result shape. */
  private payloadToResult(payload: unknown): ReceiptExtractionResult | null {
    if (!payload || typeof payload !== 'object') return null;
    const p = payload as Record<string, unknown>;
    if (typeof p.type !== 'string' || !p.fieldConfidence) return null;
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
      odometerValue: (p.odometerValue as number | null) ?? null,
      odometerUnit: (p.odometerUnit as string | null) ?? null,
      fuelLitres: (p.fuelLitres as number | null) ?? null,
      partsNeeded: (p.partsNeeded as string[]) ?? [],
      fieldConfidence: p.fieldConfidence as ReceiptExtractionResult['fieldConfidence'],
      legibilityNote: (p.legibilityNote as string | null) ?? null,
      needsCheck: (p.needsCheck as string[]) ?? [],
    };
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
