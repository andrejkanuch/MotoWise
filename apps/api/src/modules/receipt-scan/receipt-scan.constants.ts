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
