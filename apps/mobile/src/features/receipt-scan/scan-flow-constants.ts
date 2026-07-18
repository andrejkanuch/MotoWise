import type { ScanReceiptMutation } from '@motovault/graphql';
import type { ParseKeys } from 'i18next';

/** A valid, statically-checked translation key (from the generated en.json type). */
export type TranslationKey = ParseKeys;

/**
 * Receipt-scan flow — shared `as const` constants and types (U6).
 *
 * No magic strings anywhere in the flow: phases, error codes, cancel statuses and
 * the notification kind all live here as typed `as const` maps.
 */

/** Finite phases of the capture → upload → analyzing → review/error state machine. */
export const SCAN_PHASE = {
  /** Waiting on the quota gate before anything (paywall-before-camera). */
  GATING: 'gating',
  /** Multi-bike accounts pick a bike before capture. */
  BIKE_PICK: 'bikePick',
  /** First-ever scan shows the AI-consent disclosure. */
  CONSENT: 'consent',
  /** Camera / library capture. */
  CAPTURE: 'capture',
  /** Explicit upload phase (progress / timeout / retry). */
  UPLOADING: 'uploading',
  /** Captured offline — durably queued, uploads on reconnect. */
  OFFLINE_QUEUED: 'offlineQueued',
  /** Single scanReceipt request in flight; staged labels are cosmetic. */
  ANALYZING: 'analyzing',
  /** Extraction succeeded — hand off to the review card (U7c). */
  REVIEW: 'review',
  /** Terminal error surface with a typed escape. */
  ERROR: 'error',
  /** Parked post-extraction (review later) — brief confirmation. */
  PARKED: 'parked',
  /** Cancel raced and LOST — the scan finalized and is now an unreviewed scan. */
  ALREADY_PROCESSED: 'alreadyProcessed',
} as const;

export type ScanPhase = (typeof SCAN_PHASE)[keyof typeof SCAN_PHASE];

/**
 * Server union error codes (`ReceiptScanError.code`) plus the cancel-race
 * `ALREADY_COMPLETED` (from the CancelReceiptScan union). Kept as strings so an
 * unknown server code degrades to the EXTRACTION_FAILED fallback rather than
 * crashing the dispatch.
 */
export const SCAN_ERROR_CODE = {
  EXTRACTION_FAILED: 'EXTRACTION_FAILED',
  IMAGE_INVALID: 'IMAGE_INVALID',
  SCAN_QUOTA_EXCEEDED: 'SCAN_QUOTA_EXCEEDED',
  SCAN_DISABLED: 'SCAN_DISABLED',
  /** From cancelReceiptScan — the finalizer won the CAS race (KTD-4). */
  ALREADY_COMPLETED: 'ALREADY_COMPLETED',
} as const;

export type ScanErrorCode = (typeof SCAN_ERROR_CODE)[keyof typeof SCAN_ERROR_CODE];

/** cancelReceiptScan success `status`. */
export const CANCEL_STATUS = {
  CANCELLED: 'cancelled',
} as const;

/**
 * How the flow recovers from each server error. `noCreditUsed` drives the
 * reassuring "No credit used" line; `retainPhoto` decides whether the captured
 * photo is salvaged into manual entry.
 */
export type ErrorRecovery = 'retry' | 'manual' | 'paywall';

export interface ErrorOutcome {
  code: ScanErrorCode;
  recovery: ErrorRecovery;
  /** i18n key under `receiptScan.error.*` for the title. */
  titleKey: TranslationKey;
  /** i18n key under `receiptScan.error.*` for the body. */
  bodyKey: TranslationKey;
  noCreditUsed: boolean;
  retainPhoto: boolean;
}

/**
 * Typed error-code → recovery dispatch (KTD-4 / R7). No if/else ladder — the
 * analyzing controller looks the outcome up and renders the matching escape.
 */
export const ERROR_OUTCOMES: Record<ScanErrorCode, ErrorOutcome> = {
  [SCAN_ERROR_CODE.EXTRACTION_FAILED]: {
    code: SCAN_ERROR_CODE.EXTRACTION_FAILED,
    recovery: 'manual',
    titleKey: 'receiptScan.error.extractionFailedTitle',
    bodyKey: 'receiptScan.error.extractionFailedBody',
    noCreditUsed: true,
    retainPhoto: true,
  },
  [SCAN_ERROR_CODE.IMAGE_INVALID]: {
    code: SCAN_ERROR_CODE.IMAGE_INVALID,
    recovery: 'manual',
    titleKey: 'receiptScan.error.imageInvalidTitle',
    bodyKey: 'receiptScan.error.imageInvalidBody',
    noCreditUsed: true,
    retainPhoto: true,
  },
  [SCAN_ERROR_CODE.SCAN_QUOTA_EXCEEDED]: {
    code: SCAN_ERROR_CODE.SCAN_QUOTA_EXCEEDED,
    recovery: 'paywall',
    titleKey: 'receiptScan.error.quotaExceededTitle',
    bodyKey: 'receiptScan.error.quotaExceededBody',
    noCreditUsed: true,
    retainPhoto: true,
  },
  [SCAN_ERROR_CODE.SCAN_DISABLED]: {
    code: SCAN_ERROR_CODE.SCAN_DISABLED,
    recovery: 'manual',
    titleKey: 'receiptScan.error.disabledTitle',
    bodyKey: 'receiptScan.error.disabledBody',
    noCreditUsed: true,
    retainPhoto: true,
  },
  [SCAN_ERROR_CODE.ALREADY_COMPLETED]: {
    code: SCAN_ERROR_CODE.ALREADY_COMPLETED,
    recovery: 'manual',
    titleKey: 'receiptScan.error.alreadyCompletedTitle',
    bodyKey: 'receiptScan.error.alreadyCompletedBody',
    // Finalizer won → the credit WAS consumed; do not claim otherwise.
    noCreditUsed: false,
    retainPhoto: false,
  },
};

/** Local upload/network failure (no server reservation happened → always free). */
export const LOCAL_ERROR_OUTCOME: ErrorOutcome = {
  code: SCAN_ERROR_CODE.EXTRACTION_FAILED,
  recovery: 'retry',
  titleKey: 'receiptScan.error.uploadFailedTitle',
  bodyKey: 'receiptScan.error.uploadFailedBody',
  noCreditUsed: true,
  retainPhoto: true,
};

/**
 * scanReceipt transport failure (the request threw before we saw a union result).
 * Retrying is safe: the server finalizer is idempotent, so a retry consumes at
 * most one credit and never before extraction succeeds — so "No credit used"
 * holds at the error moment.
 */
export const ANALYZE_ERROR_OUTCOME: ErrorOutcome = {
  code: SCAN_ERROR_CODE.EXTRACTION_FAILED,
  recovery: 'retry',
  titleKey: 'receiptScan.error.analyzeFailedTitle',
  bodyKey: 'receiptScan.error.analyzeFailedBody',
  noCreditUsed: true,
  retainPhoto: true,
};

/** Resolve an outcome from an arbitrary server code, defaulting to EXTRACTION_FAILED. */
export function resolveErrorOutcome(code: string): ErrorOutcome {
  return ERROR_OUTCOMES[code as ScanErrorCode] ?? ERROR_OUTCOMES[SCAN_ERROR_CODE.EXTRACTION_FAILED];
}

// --- Handoff to the review card (U7c) ---

/** The `ReceiptScanSuccess.result` payload, narrowed from the generated union. */
export type ReceiptExtraction = Extract<
  ScanReceiptMutation['scanReceipt'],
  { __typename: 'ReceiptScanSuccess' }
>['result'];

/**
 * Everything U7c's review card needs. U6 builds the flow up to and including
 * mounting the card with this payload; U7c consumes it and owns persistence.
 */
export interface ReceiptReviewHandoff {
  scanId: string;
  bikeId: string;
  storagePath: string;
  result: ReceiptExtraction;
  /**
   * The locally-captured photo URI (pre-save). The private `receipts` bucket
   * isn't signed until after save, so the review card shows THIS uri for the
   * tappable/zoomable receipt thumbnail. Null on a resumed/parked scan whose
   * durable cache copy is gone — the card degrades to no thumbnail.
   */
  imageUri: string | null;
}

// --- Review card confirmation contract (U7c → U7d) ---

/**
 * The two record interpretations the review card can save as. AI pre-selects
 * from `result.type`; the user can toggle live without a new extraction.
 */
export const RECEIPT_REVIEW_TYPE = {
  MAINTENANCE: 'maintenance',
  EXPENSE: 'expense',
} as const;

export type ReceiptReviewType = (typeof RECEIPT_REVIEW_TYPE)[keyof typeof RECEIPT_REVIEW_TYPE];

/**
 * The human-confirmed payload the review card hands to `onSave`. Shape mirrors
 * U7b's `SaveReceiptScanInput` (the server converts the printed `odometerUnit`
 * to the owner's stored unit — KTD-7 — so the ORIGINAL extracted odometer is
 * sent, never the display-converted value).
 */
export interface ReceiptReviewPayload {
  motorcycleId: string;
  type: ReceiptReviewType;
  amount: number | null;
  currency: string | null;
  date: string | null;
  vendor: string | null;
  itemName: string | null;
  category: string | null;
  partsCost: number | null;
  laborCost: number | null;
  applyOdometer: boolean;
  odometerValue: number | null;
  odometerUnit: string | null;
}

// --- Timing ---

/** Upload is wrapped in a race with this timeout before it is treated as failed. */
export const UPLOAD_TIMEOUT_MS = 30_000;

/** The "Skip — enter manually" affordance appears this long into analyzing (KTD-4). */
export const SKIP_AFFORDANCE_DELAY_MS = 3_000;

/** Cosmetic analyzing labels cycled over the single scanReceipt response (per U4). */
export const ANALYZING_STAGE_KEYS = [
  'receiptScan.analyzing.stageReading',
  'receiptScan.analyzing.stageExtracting',
  'receiptScan.analyzing.stageChecking',
] as const;

export const ANALYZING_STAGE_INTERVAL_MS = 1_800;
