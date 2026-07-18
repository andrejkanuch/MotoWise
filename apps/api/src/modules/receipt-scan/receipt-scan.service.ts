import {
  EXPENSE_CATEGORIES,
  RECEIPT_SCAN_SCHEMA_VERSION,
  type ReceiptExtraction,
} from '@motovault/types';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { costCentsFor } from '../../config/constants';
import { AiBudgetService } from '../ai-budget/ai-budget.service';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import type { CancelReceiptScanSuccess } from './dto/receipt-scan-cancel.dto';
import type { ReceiptScanQuota } from './dto/receipt-scan-quota.dto';
import type {
  ReceiptExtractionResult,
  ReceiptScanError,
  ReceiptScanSuccess,
} from './dto/receipt-scan-result.dto';
import type { UnreviewedScan } from './dto/unreviewed-scan.dto';
import {
  GENERATION_LOG_STATUS,
  MAX_RECEIPT_SCANS_PER_MONTH,
  PAYWALL_WOULD_HAVE_SHOWN,
  RECEIPT_OBJECT_EXT,
  RECEIPT_SCAN_CONTENT_TYPE,
  RECEIPT_SCAN_ERROR_CODES,
  RECEIPT_SCAN_STATUS,
  RECEIPTS_BUCKET,
  SCAN_ID_UUID_REGEX,
} from './receipt-scan.constants';
import { ReceiptScanAiService } from './receipt-scan-ai.service';

const RECEIPT_SCANS_TABLE = 'receipt_scans';
const CONTENT_GENERATION_LOG_TABLE = 'content_generation_log';
const DEFAULT_CATEGORY = 'other';
const PRO_TIER = 'pro';

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
} as const satisfies Record<string, string>;

@Injectable()
export class ReceiptScanService {
  private readonly logger = new Logger(ReceiptScanService.name);

  constructor(
    private readonly configService: ConfigService,
    @Inject(SUPABASE_ADMIN) private readonly adminClient: SupabaseClient,
    private readonly aiBudgetService: AiBudgetService,
    private readonly aiService: ReceiptScanAiService,
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
        : DEFAULT_CATEGORY;
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
