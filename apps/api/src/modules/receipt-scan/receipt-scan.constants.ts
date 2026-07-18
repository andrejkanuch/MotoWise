/**
 * Receipt-scan module constants — no magic strings anywhere in the service.
 */

/** Union-result error codes (KTD-6). Client dispatches on these. */
export const RECEIPT_SCAN_ERROR_CODES = {
  EXTRACTION_FAILED: 'EXTRACTION_FAILED',
  IMAGE_INVALID: 'IMAGE_INVALID',
  SCAN_QUOTA_EXCEEDED: 'SCAN_QUOTA_EXCEEDED',
  SCAN_DISABLED: 'SCAN_DISABLED',
  ALREADY_COMPLETED: 'ALREADY_COMPLETED',
  // U7b / KTD-11 — transactional save/undo.
  /** Scan is not a success-status row owned by the caller (or a bad id). */
  SCAN_NOT_REVIEWABLE: 'SCAN_NOT_REVIEWABLE',
  /** A compound save step threw; the compensating saga rolled everything back. */
  SAVE_FAILED: 'SAVE_FAILED',
} as const;

export type ReceiptScanErrorCode =
  (typeof RECEIPT_SCAN_ERROR_CODES)[keyof typeof RECEIPT_SCAN_ERROR_CODES];

/** receipt_scans.status values (mirrors the 00166 CHECK). */
export const RECEIPT_SCAN_STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type ReceiptScanStatus = (typeof RECEIPT_SCAN_STATUS)[keyof typeof RECEIPT_SCAN_STATUS];

/** content_generation_log.content_type for receipt-scan spend (00166 CHECK). */
export const RECEIPT_SCAN_CONTENT_TYPE = 'receipt_scan' as const;

/** content_generation_log.status values used by this module. */
export const GENERATION_LOG_STATUS = {
  SUCCESS: 'success',
  FAILED: 'failed',
} as const;

/** Private storage bucket for receipt images (00167). */
export const RECEIPTS_BUCKET = 'receipts' as const;

/** Object extension in the receipts bucket ({uid}/{scanId}.webp). */
export const RECEIPT_OBJECT_EXT = 'webp' as const;

/**
 * Free-tier monthly scan cap. Passed literally to reserve_receipt_scan for now.
 * TODO(U5): source from FREE_TIER_LIMITS.MAX_RECEIPT_SCANS_PER_MONTH (added in U5)
 * so the number has a single owner in @motovault/types.
 */
export const MAX_RECEIPT_SCANS_PER_MONTH = 3 as const;

/** Structured-log token for the dormant shadow-mode paywall signal (U10 wires telemetry). */
export const PAYWALL_WOULD_HAVE_SHOWN = 'paywall_would_have_shown' as const;

/**
 * Strict UUID matcher for scanId. Rejects `/`, `..`, and any non-UUID BEFORE the
 * value is concatenated into a storage path (C1 / KTD-2). Mirrors the storage
 * policy's basename regex in 00167 (variant-agnostic UUID, not v4-only, since the
 * client generates the id).
 */
export const SCAN_ID_UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// =============================================================================
// U7b — transactional save + undo (KTD-11 / KTD-7)
// =============================================================================

/** SaveReceiptScanInput.type / saved_record_refs.recordType. Dispatch key. */
export const RECORD_TYPES = {
  EXPENSE: 'expense',
  MAINTENANCE: 'maintenance',
} as const;

export type RecordType = (typeof RECORD_TYPES)[keyof typeof RECORD_TYPES];

/** Printed odometer unit (KTD-7). Drives the from-printed-unit conversion. */
export const ODOMETER_UNITS = {
  KM: 'km',
  MI: 'mi',
} as const;

/** UndoReceiptScanSuccess.status. */
export const UNDO_STATUS = {
  REVERTED: 'reverted',
  NOTHING_TO_UNDO: 'nothing_to_undo',
} as const;

/**
 * KTD-7 guard: skip (don't fail) an odometer write whose jump above the current
 * reading is implausibly large — a mis-read/typo, not a real reading. Expressed
 * in the owner's stored unit (mi or km); a >100k jump from the current odometer
 * is not a genuine service-invoice reading.
 */
export const MAX_PLAUSIBLE_ODOMETER_JUMP = 100_000 as const;

/** Fallback maintenance-task title when the receipt has no item/vendor. */
export const DEFAULT_MAINTENANCE_TITLE = 'Service' as const;

/** maintenance_tasks.source for a scan-created task (00166 CHECK extension). */
export const MAINTENANCE_SOURCE_RECEIPT_SCAN = 'receipt_scan' as const;

/** Fallback expense category when the receipt has no category. */
export const DEFAULT_EXPENSE_CATEGORY = 'other' as const;

/** Odometer provenance stamped on a scan-driven / reverted current_mileage write. */
export const ODOMETER_SYNC_SOURCE_MANUAL = 'manual' as const;

/** Default measurement system when the owner's users row has none. */
export const DEFAULT_MEASUREMENT_SYSTEM = 'metric' as const;

/**
 * What a successful save wrote, stamped onto receipt_scans.saved_record_refs
 * (KTD-11). Undo reverses exactly these. Keys are optional so undo can clear
 * each as it reverses (resumable — a re-run only finishes leftovers).
 */
export interface SavedOdometerRef {
  motorcycleId: string;
  /** Reading before the scan write; null when the scan was the first-ever set. */
  previous: number | null;
  /** Value the scan wrote (owner's unit). Undo reverts ONLY if still equal. */
  applied: number;
}

export interface SavedRecordRefs {
  recordType: RecordType;
  expenseId?: string;
  taskId?: string;
  photoId?: string;
  odometer?: SavedOdometerRef;
}
